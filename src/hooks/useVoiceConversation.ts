import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  formatScriptureForSpeech,
  formatSearchResultsForSpeech,
  formatErrorForSpeech,
} from '@/utils/voiceResponseFormatter';

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'processing' | 'error';

interface UseVoiceConversationOptions {
  language?: string;
  voice?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAgentResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onScriptureReference?: (reference: string) => void;
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Handle tool calls from the AI
  const handleToolCall = useCallback(async (toolName: string, args: any): Promise<string> => {
    console.log(`Voice tool call: ${toolName}`, args);
    
    try {
      if (toolName === 'get_scripture_passage') {
        const response = await fetch(
          `${MCP_BASE_URL}/api/fetch-scripture?reference=${encodeURIComponent(args.reference)}`
        );
        
        if (response.ok) {
          const text = await response.text();
          options.onScriptureReference?.(args.reference);
          return formatScriptureForSpeech(text, args.reference);
        } else {
          return formatErrorForSpeech('Scripture not found');
        }
      }
      
      if (toolName === 'search_translation_resources') {
        const resourceTypes = args.resource_types || ['tn', 'tq', 'tw', 'ta'];
        const results: any[] = [];
        
        for (const resourceType of resourceTypes) {
          try {
            const url = `${MCP_BASE_URL}/api/search?query=${encodeURIComponent(args.query)}&resource=${resourceType}`;
            const response = await fetch(url);
            
            if (response.ok) {
              const data = await response.json();
              if (data.hits && Array.isArray(data.hits)) {
                results.push(...data.hits.map((r: any) => ({ ...r, resourceType })));
              }
            }
          } catch (error) {
            console.error(`Error searching ${resourceType}:`, error);
          }
        }
        
        return formatSearchResultsForSpeech(results);
      }
      
      return "I'm not sure how to handle that request.";
    } catch (error) {
      console.error('Tool call error:', error);
      return formatErrorForSpeech(String(error));
    }
  }, [options]);

  // Process incoming messages from the data channel
  const handleDataChannelMessage = useCallback(async (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Voice event:', data.type);
      
      switch (data.type) {
        case 'session.created':
          console.log('Voice session created');
          setStatus('connected');
          break;
          
        case 'session.updated':
          console.log('Voice session updated');
          break;
          
        case 'input_audio_buffer.speech_started':
          setStatus('listening');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          setStatus('processing');
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          const transcript = data.transcript || '';
          setUserTranscript(transcript);
          options.onTranscript?.(transcript, true);
          break;
          
        case 'response.audio_transcript.delta':
          setAgentTranscript(prev => prev + (data.delta || ''));
          options.onAgentResponse?.(data.delta || '');
          break;
          
        case 'response.audio_transcript.done':
          // Final transcript complete
          break;
          
        case 'response.audio.delta':
          setIsAgentSpeaking(true);
          setStatus('speaking');
          break;
          
        case 'response.audio.done':
          setIsAgentSpeaking(false);
          setStatus('connected');
          break;
          
        case 'response.function_call_arguments.done':
          // Handle tool call
          const toolName = data.name;
          const toolArgs = JSON.parse(data.arguments || '{}');
          const toolResult = await handleToolCall(toolName, toolArgs);
          
          // Send tool result back
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: data.call_id,
                output: toolResult
              }
            }));
            
            // Request AI to continue with the tool result
            dcRef.current.send(JSON.stringify({
              type: 'response.create'
            }));
          }
          break;
          
        case 'response.done':
          setStatus('connected');
          setAgentTranscript('');
          break;
          
        case 'error':
          console.error('Voice API error:', data.error);
          options.onError?.(data.error?.message || 'Voice conversation error');
          setStatus('error');
          break;
      }
    } catch (error) {
      console.error('Error processing voice message:', error);
    }
  }, [handleToolCall, options]);

  // Start voice conversation
  const startConversation = useCallback(async () => {
    if (status !== 'idle' && status !== 'error') return;
    
    setStatus('connecting');
    
    try {
      // Request microphone permission
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Get ephemeral token from our edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'realtime-voice-token',
        { body: { voice: options.voice || 'alloy', language: options.language } }
      );
      
      if (tokenError || !tokenData?.client_secret?.value) {
        throw new Error(tokenError?.message || 'Failed to get voice token');
      }
      
      const EPHEMERAL_KEY = tokenData.client_secret.value;
      
      // Create peer connection
      pcRef.current = new RTCPeerConnection();
      
      // Set up audio element for remote audio
      audioElRef.current = document.createElement('audio');
      audioElRef.current.autoplay = true;
      
      pcRef.current.ontrack = (e) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = e.streams[0];
        }
      };
      
      // Add local audio track
      const audioTrack = mediaStreamRef.current.getTracks()[0];
      pcRef.current.addTrack(audioTrack);
      
      // Set up data channel for events
      dcRef.current = pcRef.current.createDataChannel('oai-events');
      dcRef.current.addEventListener('message', handleDataChannelMessage);
      
      dcRef.current.onopen = () => {
        console.log('Voice data channel opened');
      };
      
      dcRef.current.onclose = () => {
        console.log('Voice data channel closed');
        setStatus('idle');
      };
      
      // Create and set local description
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      
      // Connect to OpenAI's Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });
      
      if (!sdpResponse.ok) {
        throw new Error('Failed to establish WebRTC connection');
      }
      
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      
      await pcRef.current.setRemoteDescription(answer);
      console.log("Voice WebRTC connection established");
      
    } catch (error) {
      console.error('Error starting voice conversation:', error);
      options.onError?.(error instanceof Error ? error.message : 'Failed to start voice conversation');
      setStatus('error');
      
      // Cleanup on error
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, [status, options, handleDataChannelMessage]);

  // End voice conversation
  const endConversation = useCallback(() => {
    // Stop media tracks
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    // Close data channel
    dcRef.current?.close();
    dcRef.current = null;
    
    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;
    
    // Clear audio element
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    
    setStatus('idle');
    setIsAgentSpeaking(false);
    setUserTranscript('');
    setAgentTranscript('');
  }, []);

  // Send text message during voice conversation
  const sendTextMessage = useCallback((text: string) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      }));
      
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  return {
    status,
    isAgentSpeaking,
    userTranscript,
    agentTranscript,
    startConversation,
    endConversation,
    sendTextMessage,
    isConnected: status === 'connected' || status === 'speaking' || status === 'listening' || status === 'processing',
  };
}
