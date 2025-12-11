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
  const animationFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
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
      // Revoke any existing blob URL
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentId(null);
    setProgress(0);
  }, []);

  // Synchronous function to maintain user gesture context
  const speak = useCallback((text: string, id: string, language: string = 'en') => {
    // If clicking the same item that's playing, stop it
    if (currentId === id && isPlaying) {
      stop();
      return;
    }

    // Stop any current playback
    stop();
    
    // CRITICAL: Create audio element synchronously on user gesture
    const audio = new Audio();
    audioRef.current = audio;
    
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

    console.log('[TTS] Fetching audio, text length:', cleanText.length, 'language:', language);

    // Fetch audio - audio element already created synchronously
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: cleanText, language }),
        signal: abortController.signal,
      }
    )
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => {
      console.log('[TTS] Received blob, size:', blob.size, 'type:', blob.type);
      
      if (blob.size === 0) {
        throw new Error('Received empty audio file');
      }
      
      // Check if we were aborted while fetching
      if (abortController.signal.aborted) {
        return;
      }
      
      const audioUrl = URL.createObjectURL(blob);
      console.log('[TTS] Created blob URL:', audioUrl);
      
      // Set up event handlers
      audio.onloadeddata = () => {
        console.log('[TTS] Audio loaded - duration:', audio.duration);
      };
      
      audio.onplay = () => {
        console.log('[TTS] Audio playing');
        setIsPlaying(true);
        setIsLoading(false);
      };
      
      audio.onended = () => {
        console.log('[TTS] Playback ended');
        setIsPlaying(false);
        setCurrentId(null);
        setProgress(0);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        console.error('[TTS] Audio error:', audio.error);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentId(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: 'TTS Error',
          description: `Audio playback failed: ${audio.error?.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      };
      
      // Set source and play
      audio.src = audioUrl;
      audio.volume = 1.0;
      
      console.log('[TTS] Starting playback...');
      audio.play().catch((err) => {
        console.error('[TTS] Play failed:', err);
        setIsLoading(false);
        setCurrentId(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: 'TTS Error',
          description: 'Could not play audio. Try tapping again.',
          variant: 'destructive',
        });
      });
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        console.log('[TTS] Request aborted');
        return;
      }
      console.error('[TTS] Error:', err);
      setIsLoading(false);
      setCurrentId(null);
      toast({
        title: 'TTS Error',
        description: err instanceof Error ? err.message : 'Failed to generate audio',
        variant: 'destructive',
      });
    });
  }, [currentId, isPlaying, stop, toast]);

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
