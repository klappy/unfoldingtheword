import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Note } from '@/types';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'processing' | 'error';
export type VoicePlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export const VOICE_PLAYBACK_SPEEDS: VoicePlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

const VOICE_SPEED_KEY = 'voice-playback-speed';
const DEVICE_ID_KEY = 'bible-study-device-id';

interface UseVoiceConversationOptions {
  language?: string;
  voice?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAgentResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onScriptureReference?: (reference: string, resource?: string) => void;
  onToolCall?: (toolName: string, args: any) => void;
  onNoteCreated?: (note: Note) => void;
  onNoteUpdated?: (id: string, content: string) => void;
  onNoteDeleted?: (id: string) => void;
  onNotesAccessed?: () => void;
  onBugReport?: (errorMessage: string, context: string) => void;
  // Navigation callback for unified orchestrator - now includes metadata for search
  onNavigate?: (hint: 'scripture' | 'resources' | 'search' | 'notes', metadata?: { scripture_reference?: string; search_query?: string }) => void;
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [playbackSpeed, setPlaybackSpeedState] = useState<VoicePlaybackSpeed>(() => {
    const saved = localStorage.getItem(VOICE_SPEED_KEY);
    return saved ? (parseFloat(saved) as VoicePlaybackSpeed) : 1;
  });
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackSpeedRef = useRef<VoicePlaybackSpeed>(playbackSpeed);
  const userPrefsRef = useRef<{ language: string; organization: string; resource: string } | null>(null);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const setPlaybackSpeed = useCallback((speed: VoicePlaybackSpeed) => {
    setPlaybackSpeedState(speed);
    playbackSpeedRef.current = speed;
    localStorage.setItem(VOICE_SPEED_KEY, speed.toString());
    if (audioElRef.current) {
      audioElRef.current.playbackRate = speed;
      console.log('[Voice] Playback speed updated to:', speed);
    }
  }, []);

  // Get current resource preferences from localStorage
  const getResourcePrefs = useCallback(() => {
    const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
    if (prefsJson) {
      try {
        const prefs = JSON.parse(prefsJson);
        if (Array.isArray(prefs) && prefs.length > 0) {
          const activePref = prefs.find((p: any) => p.resource) || prefs[0];
          return {
            language: activePref.language || 'en',
            organization: activePref.organization || 'unfoldingWord',
            resource: activePref.resource || 'ult',
          };
        }
      } catch (e) {
        console.error('[Voice] Error parsing resource prefs:', e);
      }
    }
    return { language: 'en', organization: 'unfoldingWord', resource: 'ult' };
  }, []);

  // Handle the unified bible_study_assistant tool call with streaming
  const handleBibleStudyAssistant = useCallback(async (args: { request: string; action_hint?: string }): Promise<string> => {
    console.log('[Voice] bible_study_assistant called:', args);
    
    const prefs = userPrefsRef.current || getResourcePrefs();
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    try {
      // Use fetch with streaming to get response faster
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/multi-agent-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: args.request,
          isVoiceRequest: true,
          userPrefs: { ...prefs, deviceId },
          responseLanguage: prefs.language,
          stream: true // Use streaming for faster first token
        })
      });

      if (!response.ok) {
        throw new Error(`Orchestrator error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream and accumulate the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let metadata: any = null;
      let content = '';
      let voiceResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith(':') || line === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.type === 'metadata') {
              metadata = parsed;
              // Handle navigation immediately when metadata arrives - include search data
              if (parsed.navigation_hint) {
                options.onNavigate?.(parsed.navigation_hint, {
                  scripture_reference: parsed.scripture_reference,
                  search_query: parsed.search_query,
                });
                
                if (parsed.navigation_hint === 'scripture' && parsed.scripture_reference) {
                  options.onScriptureReference?.(parsed.scripture_reference, prefs.resource);
                } else if (parsed.navigation_hint === 'notes') {
                  options.onNotesAccessed?.();
                }
              }
            } else if (parsed.type === 'content') {
              content += parsed.content;
            } else if (parsed.type === 'voice_response') {
              voiceResponse = parsed.content;
            }
          } catch {
            // Incomplete JSON, put back
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      console.log('[Voice] Streamed response complete:', { metadata, contentLength: content.length });

      // Notify about tool call for parallel UI updates
      options.onToolCall?.('bible_study_assistant', {
        ...args,
        response: { ...metadata, content, voice_response: voiceResponse }
      });

      // Return voice-optimized response
      return voiceResponse || content || "I found some resources for you.";
      
    } catch (error) {
      console.error('[Voice] Error calling orchestrator:', error);
      options.onBugReport?.(String(error), `Voice request failed: ${args.request}`);
      return "I encountered an error. Please try again.";
    }
  }, [options, getResourcePrefs]);

  // Handle tool calls from the voice AI
  const handleToolCall = useCallback(async (toolName: string, args: any): Promise<string> => {
    console.log(`[Voice] Tool call: ${toolName}`, args);
    
    if (toolName === 'bible_study_assistant') {
      return handleBibleStudyAssistant(args);
    }
    
    // Fallback for any legacy tools
    console.warn(`[Voice] Unknown tool: ${toolName}`);
    return "I'm not sure how to help with that. Could you rephrase?";
  }, [handleBibleStudyAssistant]);

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
          const toolName = data.name;
          const toolArgs = JSON.parse(data.arguments || '{}');
          const toolResult = await handleToolCall(toolName, toolArgs);
          
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: data.call_id,
                output: toolResult
              }
            }));
            
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
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const userPrefs = getResourcePrefs();
      userPrefsRef.current = userPrefs;
      console.log('[Voice] Starting conversation with prefs:', userPrefs);
      
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'realtime-voice-token',
        { body: { voice: options.voice || 'alloy', language: options.language, userPrefs } }
      );
      
      if (tokenError || !tokenData?.client_secret?.value) {
        throw new Error(tokenError?.message || 'Failed to get voice token');
      }
      
      // Store prefs from server response if available
      if (tokenData.userPrefs) {
        userPrefsRef.current = tokenData.userPrefs;
      }
      
      const EPHEMERAL_KEY = tokenData.client_secret.value;
      
      pcRef.current = new RTCPeerConnection();
      
      audioElRef.current = document.createElement('audio');
      audioElRef.current.autoplay = true;
      audioElRef.current.playbackRate = playbackSpeedRef.current;
      
      pcRef.current.ontrack = (e) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = e.streams[0];
          audioElRef.current.playbackRate = playbackSpeedRef.current;
        }
      };
      
      const audioTrack = mediaStreamRef.current.getTracks()[0];
      pcRef.current.addTrack(audioTrack);
      
      dcRef.current = pcRef.current.createDataChannel('oai-events');
      dcRef.current.addEventListener('message', handleDataChannelMessage);
      
      dcRef.current.onopen = () => {
        console.log('[Voice] Data channel opened');
        // Set connected immediately since data channel is ready
        setStatus('connected');
      };
      
      dcRef.current.onclose = () => {
        console.log('[Voice] Data channel closed');
        setStatus('idle');
      };
      
      dcRef.current.onerror = (err) => {
        console.error('[Voice] Data channel error:', err);
        setStatus('error');
      };
      
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      
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
      
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, [status, options, handleDataChannelMessage, getResourcePrefs]);

  const endConversation = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    dcRef.current?.close();
    dcRef.current = null;
    
    pcRef.current?.close();
    pcRef.current = null;
    
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    
    setStatus('idle');
    setIsAgentSpeaking(false);
    setUserTranscript('');
    setAgentTranscript('');
  }, []);

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
    playbackSpeed,
    setPlaybackSpeed,
  };
}
