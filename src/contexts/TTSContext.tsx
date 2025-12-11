import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TTSContextType {
  speak: (text: string, id: string, language?: string) => void;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  currentId: string | null;
  progress: number;
}

const TTSContext = createContext<TTSContextType | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Update progress based on audio element
  const updateProgress = useCallback(() => {
    if (audioRef.current && audioRef.current.duration > 0 && !isNaN(audioRef.current.duration)) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
      
      if (currentProgress < 100 && isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    } else if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setProgress(0);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stop = useCallback(() => {
    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentId(null);
    setProgress(0);
  }, []);

  const speak = useCallback((text: string, id: string, language: string = 'en') => {
    // If clicking the same item that's playing, stop it
    if (currentId === id && isPlaying) {
      stop();
      return;
    }

    // Stop any current playback
    stop();
    
    setIsLoading(true);
    setCurrentId(id);
    
    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Strip markdown for cleaner TTS
    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '')
      .trim();

    console.log('[TTS] Starting streaming fetch, text length:', cleanText.length, 'language:', language);

    // Check if MediaSource is supported for streaming playback
    const supportsMediaSource = 'MediaSource' in window && MediaSource.isTypeSupported('audio/mpeg');
    
    if (supportsMediaSource) {
      // Use MediaSource API for true streaming playback
      streamWithMediaSource(cleanText, language, abortController);
    } else {
      // Fallback to progressive blob loading
      streamWithFallback(cleanText, language, abortController);
    }
  }, [currentId, isPlaying, stop, toast]);

  const streamWithMediaSource = useCallback(async (
    text: string, 
    language: string, 
    abortController: AbortController
  ) => {
    try {
      const audio = new Audio();
      audioRef.current = audio;
      
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      
      const audioUrl = URL.createObjectURL(mediaSource);
      audioUrlRef.current = audioUrl;
      audio.src = audioUrl;

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          sourceBufferRef.current = sourceBuffer;
          
          console.log('[TTS] MediaSource opened, fetching stream...');
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ text, language }),
              signal: abortController.signal,
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          let chunksReceived = 0;
          let totalBytes = 0;
          let firstChunk = true;

          const processChunk = async () => {
            const { done, value } = await reader.read();
            
            if (abortController.signal.aborted) {
              return;
            }
            
            if (done) {
              console.log('[TTS] Stream complete, total bytes:', totalBytes, 'chunks:', chunksReceived);
              if (mediaSource.readyState === 'open') {
                // Wait for buffer to finish updating before ending stream
                if (sourceBuffer.updating) {
                  sourceBuffer.addEventListener('updateend', () => {
                    if (mediaSource.readyState === 'open') {
                      mediaSource.endOfStream();
                    }
                  }, { once: true });
                } else {
                  mediaSource.endOfStream();
                }
              }
              return;
            }

            chunksReceived++;
            totalBytes += value.length;
            
            if (firstChunk) {
              console.log('[TTS] First chunk received, size:', value.length);
              firstChunk = false;
              setIsLoading(false);
              setIsPlaying(true);
            }

            // Append chunk to source buffer
            if (sourceBuffer.updating) {
              await new Promise(resolve => {
                sourceBuffer.addEventListener('updateend', resolve, { once: true });
              });
            }
            
            try {
              sourceBuffer.appendBuffer(value);
              
              // Start playback after first chunk is appended
              if (chunksReceived === 1 && audio.paused) {
                await new Promise(resolve => {
                  sourceBuffer.addEventListener('updateend', resolve, { once: true });
                });
                audio.play().catch(err => {
                  console.error('[TTS] Play failed:', err);
                  toast({
                    title: 'TTS Error',
                    description: 'Could not play audio. Try tapping again.',
                    variant: 'destructive',
                  });
                });
              }
            } catch (err) {
              console.error('[TTS] Buffer append error:', err);
            }

            // Continue reading
            processChunk();
          };

          processChunk();

        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            console.log('[TTS] Stream aborted');
            return;
          }
          throw err;
        }
      });

      audio.onended = () => {
        console.log('[TTS] Playback ended');
        setIsPlaying(false);
        setCurrentId(null);
        setProgress(0);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        console.error('[TTS] Audio error:', audio.error);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        toast({
          title: 'TTS Error',
          description: `Audio playback failed: ${audio.error?.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      };

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[TTS] Request aborted');
        return;
      }
      console.error('[TTS] MediaSource error:', err);
      // Fallback to blob method
      streamWithFallback(text, language, abortController);
    }
  }, [toast]);

  const streamWithFallback = useCallback(async (
    text: string, 
    language: string, 
    abortController: AbortController
  ) => {
    try {
      console.log('[TTS] Using fallback blob method');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, language }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      if (abortController.signal.aborted) {
        return;
      }

      console.log('[TTS] Received blob, size:', blob.size);
      
      const audioUrl = URL.createObjectURL(blob);
      audioUrlRef.current = audioUrl;
      
      const audio = new Audio();
      audioRef.current = audio;
      
      audio.onloadeddata = () => {
        console.log('[TTS] Audio loaded, duration:', audio.duration);
      };
      
      audio.onplay = () => {
        console.log('[TTS] Playing');
        setIsPlaying(true);
        setIsLoading(false);
      };
      
      audio.onended = () => {
        console.log('[TTS] Playback ended');
        setIsPlaying(false);
        setCurrentId(null);
        setProgress(0);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      
      audio.onerror = () => {
        console.error('[TTS] Audio error:', audio.error);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        toast({
          title: 'TTS Error',
          description: `Audio playback failed: ${audio.error?.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      };
      
      audio.src = audioUrl;
      audio.play().catch(err => {
        console.error('[TTS] Play failed:', err);
        setIsLoading(false);
        setCurrentId(null);
        toast({
          title: 'TTS Error',
          description: 'Could not play audio. Try tapping again.',
          variant: 'destructive',
        });
      });

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[TTS] Request aborted');
        return;
      }
      console.error('[TTS] Fallback error:', err);
      setIsLoading(false);
      setCurrentId(null);
      toast({
        title: 'TTS Error',
        description: err instanceof Error ? err.message : 'Failed to generate audio',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return (
    <TTSContext.Provider value={{ speak, stop, isPlaying, isLoading, currentId, progress }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}
