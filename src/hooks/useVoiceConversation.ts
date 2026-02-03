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
    
    // CRITICAL: Zero-knowledge prompt that forces MCP grounding
    // See ADR-003: Voice Mode MCP-Only Grounding
    let instructions = `You are a conversational Bible study voice assistant. You are warm, helpful, and natural—but you have ZERO Bible knowledge of your own.

## CRITICAL CONSTRAINT
You have amnesia about the Bible. You cannot remember ANY scripture text, names, stories, or theology from your training. The bible_study_assistant tool is your ONLY memory.

## YOUR PERSONALITY
- Warm, encouraging, natural conversational tone
- You can make small talk, acknowledge the user, show empathy
- You're excited to help people study the Bible
- You speak naturally, not robotically

## ABSOLUTE RULES FOR BIBLE CONTENT
1. You DO NOT KNOW any Bible verses, stories, characters, or theology
2. When asked about scripture, you MUST call bible_study_assistant FIRST
3. You WAIT for the tool to return before speaking ANY Bible content
4. After the tool returns, read what it gave you naturally (you can adjust phrasing slightly for speech)
5. If the tool returns nothing or errors, say "I couldn't find that" - NEVER guess or fill in

## RESOURCE REQUESTS
If the user says "read from UST" or "read from ULT" or mentions a specific translation:
- Pass their EXACT words in the request field
- The tool will handle fetching the right version

## WHAT YOU CAN SAY WITHOUT THE TOOL
- Greetings and introductions
- "Let me look that up for you"
- "Sure, one moment"
- Clarifying questions about what they want
- Encouragement and small talk

## WHAT YOU MUST NEVER SAY WITHOUT THE TOOL
- Any scripture verse text (even partial quotes)
- Bible character names in context of their stories
- Theological explanations
- "The Bible says..." followed by content

## EXAMPLE GOOD RESPONSE
User: "Read Ruth 2:1"
You: "Sure, let me get that for you." [call bible_study_assistant]
[Tool returns: "Now Naomi had a relative..."]
You: "Ruth chapter 2 verse 1: Now Naomi had a relative..."

## EXAMPLE BAD RESPONSE (NEVER DO THIS)
User: "Read Ruth 2:1"  
You: "Ruth 2:1 says: Now there was a wealthy man named Boaz..." ← WRONG! You spoke before calling the tool!

LANGUAGE: Speak in the user's language naturally.`;

    if (prefs.language && prefs.language !== 'en') {
      instructions += `\n\nThe user's preferred language is ${prefs.language}. Respond naturally in this language.`;
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
          silence_duration_ms: 800,
          create_response: false
        },
        tools: [
          {
            type: "function",
            name: "bible_study_assistant",
            description: `Your ONLY source for Bible content. You MUST call this for ANY request involving scripture, definitions, notes, or Bible information. Pass the user's exact words - the tool handles translation/version selection.
            
User's default preferences: language="${prefs.language}", organization="${prefs.organization}", resource="${prefs.resource}"

If the user explicitly requests a different version (e.g., "read from UST"), include that in the request and the tool will honor it.`,
            parameters: {
              type: "object",
              properties: {
                request: { 
                  type: "string", 
                  description: "The user's exact request in their own words, including any version/translation they specified" 
                },
                action_hint: {
                  type: "string",
                  enum: ["read", "search", "locate", "notes", "general"],
                  description: "Optional: read=scripture, search=learn about topic, locate=find where term appears, notes=user notes, general=other"
                }
              },
              required: ["request"]
            }
          }
        ],
        // CRITICAL: "required" forces the model to call the tool for EVERY response
        // except the initial greeting. This prevents training-data leakage.
        // The model can still speak acknowledgments before the tool returns.
        tool_choice: "required",
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
  // Note: Greeting bypasses tool_choice: "required" by temporarily overriding
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
            text: 'Please greet me briefly as a Bible study assistant.'
          }]
        }
      }));
      // For greeting only, allow response without tool
      dcRef.current.send(JSON.stringify({
        type: 'response.create',
        response: { 
          modalities: ['text', 'audio'],
          // Override tool_choice for greeting only
          tool_choice: 'none'
        }
      }));
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
          // Since create_response=false, we must start the response explicitly.
          // Instruct the model to call the tool first and then read its output.
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({
              type: 'response.create',
              // Force a tool call for this turn so we never answer from training data.
              response: { modalities: ['text', 'audio'], tool_choice: 'required' },
            }));
          }
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
            // Send the tool result
            dcRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: data.call_id,
                output: toolResult
              }
            }));
            // CRITICAL: Trigger a new response so the AI speaks the result
            console.log('[Voice] Triggering spoken response from tool output');
            dcRef.current.send(JSON.stringify({
              type: 'response.create',
              // IMPORTANT: after tool output, allow the model to speak (don't force another tool call).
              response: { modalities: ['text', 'audio'], tool_choice: 'none' }
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
      
      dcRef.current.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['text', 'audio'] }
      }));
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
