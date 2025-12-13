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
  
  // CRITICAL: Stable refs to avoid stale closures in data channel event listener
  const optionsRef = useRef(options);
  const handleToolCallRef = useRef<(toolName: string, args: any) => Promise<string>>();
  const buildSessionConfigRef = useRef<() => any>();
  const sendInitialGreetingRef = useRef<() => void>();

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  });

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

  // Build session configuration to send after session.created
  const buildSessionConfig = useCallback(() => {
    const prefs = userPrefsRef.current || getResourcePrefs();
    
    let instructions = `You are a natural voice interface for a Bible study assistant. Your job is to speak naturally and conversationally while using a single tool to do all the work.

HOW YOU WORK:
- You have ONE tool: bible_study_assistant
- This tool handles ALL requests: reading scripture, searching resources, finding terms, managing notes
- Just pass the user's request to the tool and speak the response naturally

INITIAL GREETING:
When the conversation starts, introduce yourself briefly:
"Hi! I'm your Bible study assistant. I can help you read scripture passages, find translation resources, look up biblical terms, and save notes. Just ask me naturally - like 'read John 3:16' or 'what does grace mean?' What would you like to explore?"

CONVERSATION STYLE:
- Speak naturally, like a helpful friend
- Keep responses conversational - you're speaking, not reading a document
- Use transitions: "Let me look that up...", "I found something interesting..."
- After sharing content, offer to help more: "Would you like to explore this further?"

WHAT YOU DO:
- Pass ALL requests to bible_study_assistant tool
- Speak the tool's response naturally (it gives you voice-friendly text)
- The tool handles: scripture reading, resource search, word definitions, notes management

WHAT YOU DON'T DO:
- Never answer from your own knowledge
- Never interpret scripture or give theological opinions
- Never act as a pastor or counselor
- Never reference screens or UI elements

LANGUAGE:
Match the user's language naturally. The tool handles translations.`;

    if (prefs.language && prefs.language !== 'en') {
      instructions += `\n\nIMPORTANT: The user's preferred language is ${prefs.language}. Respond naturally in this language.`;
    }

    return {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: options.voice || "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        },
        tools: [
          {
            type: "function",
            name: "bible_study_assistant",
            description: `Your single tool for ALL Bible study tasks. Just pass the user's natural request. 
Handles: reading scripture, searching topics, finding where terms appear, word definitions, translation notes, questions, academy articles, and user notes.
User's preferences: language="${prefs.language}", organization="${prefs.organization}", resource="${prefs.resource}"`,
            parameters: {
              type: "object",
              properties: {
                request: { 
                  type: "string", 
                  description: "The user's natural language request exactly as they said it" 
                },
                action_hint: {
                  type: "string",
                  enum: ["read", "search", "locate", "notes", "general"],
                  description: "Optional hint: read=scripture passage, search=learn concept, locate=find term occurrences, notes=manage notes, general=other"
                }
              },
              required: ["request"]
            }
          }
        ],
        tool_choice: "auto",
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };
  }, [getResourcePrefs, options.voice]);

  // Keep buildSessionConfig ref up to date
  useEffect(() => {
    buildSessionConfigRef.current = buildSessionConfig;
  }, [buildSessionConfig]);

  // Send initial greeting after session is fully configured
  const sendInitialGreeting = useCallback(() => {
    if (dcRef.current?.readyState === 'open') {
      console.log('[Voice] Sending initial greeting request');
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: 'Please introduce yourself briefly as my Bible study assistant and explain how you can help me study the Bible.'
          }]
        }
      }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  // Keep refs up to date
  useEffect(() => {
    sendInitialGreetingRef.current = sendInitialGreeting;
  }, [sendInitialGreeting]);

  useEffect(() => {
    handleToolCallRef.current = handleToolCall;
  }, [handleToolCall]);

  // STABLE message handler - uses refs to avoid stale closures
  // This is attached ONCE to the data channel and reads from refs for latest values
  const handleDataChannelMessage = useCallback(async (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[Voice] Event:', data.type);
      
      switch (data.type) {
        case 'session.created':
          console.log('[Voice] Session created, sending session.update...');
          // Send session configuration AFTER session.created
          if (dcRef.current?.readyState === 'open' && buildSessionConfigRef.current) {
            const sessionConfig = buildSessionConfigRef.current();
            console.log('[Voice] Sending session config:', sessionConfig);
            dcRef.current.send(JSON.stringify(sessionConfig));
          }
          break;
          
        case 'session.updated':
          console.log('[Voice] Session updated successfully, requesting greeting');
          setStatus('connected');
          // Now that session is fully configured, send initial greeting
          sendInitialGreetingRef.current?.();
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
          optionsRef.current.onTranscript?.(transcript, true);
          break;
          
        case 'response.audio_transcript.delta':
          setAgentTranscript(prev => prev + (data.delta || ''));
          optionsRef.current.onAgentResponse?.(data.delta || '');
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
          const toolResult = await handleToolCallRef.current?.(toolName, toolArgs) || 'Error processing request';
          
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
          optionsRef.current.onError?.(data.error?.message || 'Voice conversation error');
          setStatus('error');
          break;
      }
    } catch (error) {
      console.error('Error processing voice message:', error);
    }
  }, []); // Empty deps = STABLE reference, reads from refs

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

      pcRef.current.oniceconnectionstatechange = () => {
        console.log('[Voice] ICE state:', pcRef.current?.iceConnectionState);
      };
      
      const audioTrack = mediaStreamRef.current.getTracks()[0];
      pcRef.current.addTrack(audioTrack);
      
      dcRef.current = pcRef.current.createDataChannel('oai-events');
      dcRef.current.addEventListener('message', handleDataChannelMessage);
      
      dcRef.current.onopen = () => {
        console.log('[Voice] Data channel opened, waiting for session.created...');
        // Don't send anything yet - wait for session.created event
        // The session.update and greeting will be sent in handleDataChannelMessage
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
        const errorText = await sdpResponse.text();
        console.error('[Voice] WebRTC SDP response error:', sdpResponse.status, errorText);
        throw new Error('Failed to establish WebRTC connection');
      }

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      
      await pcRef.current.setRemoteDescription(answer);
      console.log("[Voice] WebRTC connection established");
      // Mark as connected once WebRTC handshake completes so UI can switch out of connecting state
      setStatus('connected');

      // WebRTC handles audio automatically via peer connection - no manual streaming needed
      
    } catch (error) {
      console.error('Error starting voice conversation:', error);
      options.onError?.(error instanceof Error ? error.message : 'Failed to start voice conversation');
      setStatus('error');
      
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, [status, handleDataChannelMessage, getResourcePrefs, options.voice, options.language, options.onError]);

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
