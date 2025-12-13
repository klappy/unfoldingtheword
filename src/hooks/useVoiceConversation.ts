import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  formatScriptureForSpeech,
  formatSearchResultsForSpeech,
  formatErrorForSpeech,
  formatNotesForVoice,
} from '@/utils/voiceResponseFormatter';
import { filterNotesByScope } from '@/lib/referenceScope';
import { Note } from '@/types';

// Use our proxy to avoid CORS issues
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translation-helps-proxy`;

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
  // Note management callbacks
  onNoteCreated?: (note: Note) => void;
  onNoteUpdated?: (id: string, content: string) => void;
  onNoteDeleted?: (id: string) => void;
  onNotesAccessed?: () => void;
  // Bug report callback for logging errors
  onBugReport?: (errorMessage: string, context: string) => void;
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

  // Keep ref in sync with state
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Update playback speed
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
    console.log('[Voice] Reading resource prefs from localStorage:', prefsJson);
    if (prefsJson) {
      try {
        const prefs = JSON.parse(prefsJson);
        console.log('[Voice] Parsed resource prefs:', prefs);
        if (Array.isArray(prefs) && prefs.length > 0) {
          // Find the first preference with a resource field, or use the first one
          const activePref = prefs.find((p: any) => p.resource) || prefs[0];
          console.log('[Voice] Active preference:', activePref);
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

  // Helper to translate content when using English fallback
  const translateFallbackContent = useCallback(async (
    content: string, 
    targetLanguage: string, 
    contentType: string
  ): Promise<string | null> => {
    if (targetLanguage === 'en') return content; // No need to translate if already English
    
    try {
      console.log(`[Voice] Translating ${contentType} to ${targetLanguage}`);
      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: { content, targetLanguage, contentType }
      });
      
      if (error) {
        console.error('[Voice] Translation error:', error);
        return null;
      }
      
      return data?.translatedContent || null;
    } catch (e) {
      console.error('[Voice] Translation exception:', e);
      return null;
    }
  }, []);

  // Helper to fetch with fallback to English and optional translation
  const fetchWithFallback = useCallback(async (
    endpoint: string,
    primaryParams: Record<string, any>,
    userLanguage: string,
    contentType: string
  ): Promise<{ content: string | null; isFallback: boolean }> => {
    // Try primary language first
    console.log(`[Voice] Trying primary fetch: ${endpoint}`, primaryParams);
    
    const primaryResponse = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: primaryParams })
    });
    
    if (primaryResponse.ok) {
      const data = await primaryResponse.json();
      if (data.content && !data.error) {
        console.log(`[Voice] Primary fetch successful for ${endpoint}`);
        return { content: data.content, isFallback: false };
      }
    }
    
    // If user is already using English, no fallback needed
    if (userLanguage === 'en') {
      console.log(`[Voice] Primary fetch failed, no fallback for English user`);
      return { content: null, isFallback: false };
    }
    
    // Fallback to English/unfoldingWord
    console.log(`[Voice] Falling back to English for ${endpoint}`);
    const fallbackParams = { ...primaryParams, language: 'en', organization: 'unfoldingWord' };
    
    const fallbackResponse = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: fallbackParams })
    });
    
    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (data.content && !data.error) {
        console.log(`[Voice] Fallback fetch successful, translating...`);
        // Translate the English content to user's language
        const translated = await translateFallbackContent(data.content, userLanguage, contentType);
        return { 
          content: translated || data.content, // Use English if translation fails
          isFallback: true 
        };
      }
    }
    
    return { content: null, isFallback: false };
  }, [translateFallbackContent]);

  // Generate fallback notice for voice response
  const getFallbackNotice = (contentType: string): string => {
    return `I found this ${contentType} in English and translated it for you. `;
  };

  // Handle tool calls from the AI - route through proxy to avoid CORS
  const handleToolCall = useCallback(async (toolName: string, args: any): Promise<string> => {
    console.log(`[Voice] Tool call: ${toolName}`, args);
    const prefs = getResourcePrefs();
    console.log(`[Voice] Using resource prefs:`, prefs);
    
    // Merge user prefs with any args provided by the AI (AI args take precedence if specified)
    const mergedParams = {
      language: args.language || prefs.language,
      organization: args.organization || prefs.organization,
      resource: args.resource || prefs.resource,
    };
    
    // Notify UI about tool call for parallel lookups
    options.onToolCall?.(toolName, { ...args, ...mergedParams });
    
    try {
      // ===== SCRIPTURE PASSAGE =====
      if (toolName === 'get_scripture_passage') {
        console.log(`[Voice] Fetching scripture: ${args.reference} with resource: ${mergedParams.resource}`, args.filter ? `filter: ${args.filter}` : '');
        
        const params: Record<string, any> = { 
          reference: args.reference,
          resource: mergedParams.resource,
          language: mergedParams.language,
          organization: mergedParams.organization,
        };
        
        // Add filter if provided
        if (args.filter) {
          params.filter = args.filter;
        }
        
        const { content, isFallback } = await fetchWithFallback(
          'fetch-scripture',
          params,
          mergedParams.language,
          'scripture'
        );
        
        if (content) {
          // Only notify UI for regular scripture (not filter searches)
          if (!args.filter) {
            options.onScriptureReference?.(args.reference, mergedParams.resource);
          }
          const formatted = formatScriptureForSpeech(content, args.reference);
          return isFallback ? getFallbackNotice('passage') + formatted : formatted;
        }
        return formatErrorForSpeech('Scripture not found');
      }
      
      // ===== SEARCH RESOURCES =====
      if (toolName === 'search_resources') {
        const params: Record<string, string> = {
          query: args.query,
          language: mergedParams.language,
          organization: mergedParams.organization,
        };
        if (args.resource) params.resource = args.resource;
        if (args.reference) params.reference = args.reference;
        if (args.article) params.article = args.article;
        
        console.log(`[Voice] Searching resources:`, params);
        
        // Try primary language first
        let response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: 'search', params })
        });
        
        let isFallback = false;
        if (response.ok) {
          const data = await response.json();
          console.log(`[Voice] Search results:`, data);
          if (data.hits && Array.isArray(data.hits) && data.hits.length > 0) {
            return formatSearchResultsForSpeech(data.hits);
          }
        }
        
        // Fallback to English if user's language has no results
        if (mergedParams.language !== 'en') {
          console.log(`[Voice] Falling back to English for search`);
          const fallbackParams = { ...params, language: 'en', organization: 'unfoldingWord' };
          response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: 'search', params: fallbackParams })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.hits && Array.isArray(data.hits) && data.hits.length > 0) {
              isFallback = true;
              const formatted = formatSearchResultsForSpeech(data.hits);
              return getFallbackNotice('search results') + formatted;
            }
          }
        }
        
        return `I searched for "${args.query}" but didn't find any matching resources.`;
      }
      
      // ===== TRANSLATION NOTES =====
      if (toolName === 'get_translation_notes') {
        console.log(`[Voice] Fetching translation notes for: ${args.reference}`);
        
        const { content, isFallback } = await fetchWithFallback(
          'fetch-translation-notes',
          { 
            reference: args.reference,
            language: mergedParams.language,
            organization: mergedParams.organization,
          },
          mergedParams.language,
          'translation notes'
        );
        
        if (content) {
          const formatted = `Here are the translation notes for ${args.reference}: ${content.substring(0, 2000)}`;
          return isFallback ? getFallbackNotice('notes') + formatted : formatted;
        }
        return `I couldn't find translation notes for ${args.reference}.`;
      }
      
      // ===== TRANSLATION QUESTIONS =====
      if (toolName === 'get_translation_questions') {
        console.log(`[Voice] Fetching translation questions for: ${args.reference}`);
        
        const { content, isFallback } = await fetchWithFallback(
          'fetch-translation-questions',
          { 
            reference: args.reference,
            language: mergedParams.language,
            organization: mergedParams.organization,
          },
          mergedParams.language,
          'translation questions'
        );
        
        if (content) {
          const formatted = `Here are the study questions for ${args.reference}: ${content.substring(0, 2000)}`;
          return isFallback ? getFallbackNotice('questions') + formatted : formatted;
        }
        return `I couldn't find study questions for ${args.reference}.`;
      }
      
      // ===== TRANSLATION WORD LINKS =====
      if (toolName === 'get_translation_word_links') {
        console.log(`[Voice] Fetching word links for: ${args.reference}`);
        
        const { content, isFallback } = await fetchWithFallback(
          'fetch-translation-word-links',
          { 
            reference: args.reference,
            language: mergedParams.language,
            organization: mergedParams.organization,
          },
          mergedParams.language,
          'word links'
        );
        
        if (content) {
          const formatted = `Here are the important biblical terms in ${args.reference}: ${content.substring(0, 1500)}`;
          return isFallback ? getFallbackNotice('word studies') + formatted : formatted;
        }
        
        // Also check for links array format
        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'fetch-translation-word-links',
            params: { 
              reference: args.reference,
              language: mergedParams.language,
              organization: mergedParams.organization,
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.links && Array.isArray(data.links)) {
            const terms = data.links.map((l: any) => l.term || l.word).filter(Boolean).join(', ');
            return `The verse ${args.reference} contains these important terms: ${terms}`;
          }
        }
        return `I couldn't find word links for ${args.reference}.`;
      }
      
      // ===== TRANSLATION WORD =====
      if (toolName === 'get_translation_word') {
        console.log(`[Voice] Fetching translation word: ${args.term}`);
        
        // Translation words are typically language-neutral, but content can be translated
        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'fetch-translation-word',
            params: { term: args.term }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            // If user language isn't English, translate the word article
            if (mergedParams.language !== 'en') {
              const translated = await translateFallbackContent(data.content, mergedParams.language, 'word article');
              if (translated) {
                return getFallbackNotice('word article') + `Here's information about the word "${args.term}": ${translated.substring(0, 2000)}`;
              }
            }
            return `Here's information about the word "${args.term}": ${data.content.substring(0, 2000)}`;
          }
        }
        return `I couldn't find information about the word "${args.term}".`;
      }
      
      // ===== TRANSLATION ACADEMY =====
      if (toolName === 'get_translation_academy') {
        console.log(`[Voice] Fetching academy article: ${args.moduleId || args.path}`);
        
        const params: Record<string, string> = {};
        if (args.moduleId) params.moduleId = args.moduleId;
        if (args.path) params.path = args.path;
        
        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'fetch-translation-academy',
            params
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            // If user language isn't English, translate the academy article
            if (mergedParams.language !== 'en') {
              const translated = await translateFallbackContent(data.content, mergedParams.language, 'academy article');
              if (translated) {
                return getFallbackNotice('article') + `Here's the translation academy article: ${translated.substring(0, 2000)}`;
              }
            }
            return `Here's the translation academy article: ${data.content.substring(0, 2000)}`;
          }
        }
        return `I couldn't find the translation academy article "${args.moduleId || args.path}".`;
      }
      
      // ===== NOTE MANAGEMENT TOOLS =====
      
      // CREATE NOTE
      if (toolName === 'create_note') {
        const deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) return "I can't save notes right now. Please try again.";
        
        const { data, error } = await supabase
          .from('notes')
          .insert({
            device_id: deviceId,
            content: args.content,
            source_reference: args.source_reference || null,
            highlighted: true
          })
          .select()
          .single();
          
        if (error) {
          console.error('[Voice] Error creating note:', error);
          return `I couldn't save that note. ${error.message}`;
        }
        
        // Transform to Note type and notify UI
        const newNote: Note = {
          id: data.id,
          content: data.content,
          sourceReference: data.source_reference || undefined,
          createdAt: new Date(data.created_at),
          highlighted: data.highlighted || false,
          noteType: 'note',
        };
        
        options.onNoteCreated?.(newNote);
        
        const refText = args.source_reference ? ` with reference to ${args.source_reference}` : '';
        return `I've saved your note: "${args.content}"${refText}.`;
      }
      
      // GET NOTES (with scope filtering)
      if (toolName === 'get_notes') {
        const deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) return "I can't access notes right now.";
        
        const limit = args.limit || 10;
        const scope = args.scope || 'all';
        
        // Navigate to notes card so user can see notes being read
        options.onNotesAccessed?.();
        
        // Fetch all notes for this device
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('[Voice] Error fetching notes:', error);
          return "I had trouble retrieving your notes. Please try again.";
        }
        
        if (!data || data.length === 0) {
          return "You don't have any saved notes yet. Would you like me to create one?";
        }
        
        // Transform to match filter function expectations
        const transformedNotes = data.map(n => ({
          ...n,
          sourceReference: n.source_reference,
        }));
        
        // Apply scope filtering
        let filteredNotes = transformedNotes;
        if (scope !== 'all' && args.reference) {
          filteredNotes = filterNotesByScope(transformedNotes, args.reference);
        }
        
        if (filteredNotes.length === 0) {
          return `You don't have any notes for ${args.reference}. Would you like to create one?`;
        }
        
        return formatNotesForVoice(filteredNotes.slice(0, limit), args.reference);
      }
      
      // UPDATE NOTE
      if (toolName === 'update_note') {
        const { error } = await supabase
          .from('notes')
          .update({ content: args.content })
          .eq('id', args.note_id);
          
        if (error) {
          console.error('[Voice] Error updating note:', error);
          return `I couldn't update that note. ${error.message}`;
        }
        
        options.onNoteUpdated?.(args.note_id, args.content);
        return `I've updated the note to: "${args.content}"`;
      }
      
      // DELETE NOTE
      if (toolName === 'delete_note') {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', args.note_id);
          
        if (error) {
          console.error('[Voice] Error deleting note:', error);
          return `I couldn't delete that note. ${error.message}`;
        }
        
        options.onNoteDeleted?.(args.note_id);
        return "I've deleted that note for you.";
      }
      
      // ===== LEGACY: search_translation_resources (for backward compatibility) =====
      if (toolName === 'search_translation_resources') {
        const resourceTypes = args.resource_types || ['tn', 'tq', 'tw', 'ta'];
        const results: any[] = [];
        
        for (const resourceType of resourceTypes) {
          try {
            const response = await fetch(PROXY_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: 'search',
                params: { 
                  query: args.query, 
                  resource: resourceType,
                  language: mergedParams.language,
                  organization: mergedParams.organization,
                }
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.hits && Array.isArray(data.hits) && data.hits.length > 0) {
                results.push(...data.hits.map((r: any) => ({ ...r, resourceType })));
              }
            }
          } catch (error) {
            console.error(`[Voice] Error searching ${resourceType}:`, error);
          }
        }
        
        console.log(`[Voice] Total search results: ${results.length}`);
        return formatSearchResultsForSpeech(results);
      }
      
      console.warn(`[Voice] Unknown tool: ${toolName}`);
      return "I couldn't find any resources for that. Could you try rephrasing your question?";
    } catch (error) {
      console.error('[Voice] Tool call error:', error);
      // Create bug report for tool errors
      options.onBugReport?.(
        String(error),
        `Voice AI tool call failed: ${toolName}\nArguments: ${JSON.stringify(args, null, 2)}`
      );
      return formatErrorForSpeech(String(error));
    }
  }, [options, getResourcePrefs, fetchWithFallback, translateFallbackContent]);

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
      
      // Get current user preferences
      const userPrefs = getResourcePrefs();
      console.log('[Voice] Starting conversation with prefs:', userPrefs);
      
      // Get ephemeral token from our edge function with user preferences
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'realtime-voice-token',
        { body: { voice: options.voice || 'alloy', language: options.language, userPrefs } }
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
      audioElRef.current.playbackRate = playbackSpeedRef.current;
      console.log('[Voice] Initial playback speed:', playbackSpeedRef.current);
      
      pcRef.current.ontrack = (e) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = e.streams[0];
          audioElRef.current.playbackRate = playbackSpeedRef.current;
          console.log('[Voice] Applied playback speed on track:', playbackSpeedRef.current);
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
  }, [status, options, handleDataChannelMessage, getResourcePrefs]);

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
    playbackSpeed,
    setPlaybackSpeed,
  };
}
