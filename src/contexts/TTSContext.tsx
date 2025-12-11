import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export const PLAYBACK_SPEEDS = [0.5, 0.7, 1, 1.2, 1.5, 2] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

interface TTSContextType {
  speak: (text: string, id: string, language?: string) => void;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  currentId: string | null;
  progress: number;
  playbackSpeed: PlaybackSpeed;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
}

const TTSContext = createContext<TTSContextType | null>(null);

// Persist speed preference
const SPEED_STORAGE_KEY = 'tts-playback-speed';

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(() => {
    const stored = localStorage.getItem(SPEED_STORAGE_KEY);
    return stored && PLAYBACK_SPEEDS.includes(Number(stored) as PlaybackSpeed) 
      ? Number(stored) as PlaybackSpeed 
      : 1;
  });
  
  // Use AudioContext for better autoplay support
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Get or create AudioContext (lazy init)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    // Resume if suspended (needed after user gesture)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    };
    
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [getAudioContext]);

  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeedState(speed);
    localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
    // Apply to current source if playing
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = speed;
    }
  }, []);

  // Update progress based on AudioContext time
  const updateProgress = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx && durationRef.current > 0 && isPlaying) {
      const elapsed = (ctx.currentTime - startTimeRef.current) * (sourceNodeRef.current?.playbackRate.value || 1);
      const currentProgress = Math.min((elapsed / durationRef.current) * 100, 100);
      setProgress(currentProgress);
      
      if (currentProgress < 100) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
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
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
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
    
    // Stop current audio source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {}
      sourceNodeRef.current = null;
    }
    
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

    console.log('[TTS] Fetching audio, text length:', cleanText.length, 'language:', language);

    // Get AudioContext (will resume if suspended)
    const audioContext = getAudioContext();

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
      return response.arrayBuffer();
    })
    .then(async (arrayBuffer) => {
      console.log('[TTS] Received audio, size:', arrayBuffer.byteLength);
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Received empty audio file');
      }
      
      // Check if we were aborted while fetching
      if (abortController.signal.aborted) {
        return;
      }
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[TTS] Decoded audio - duration:', audioBuffer.duration);
      
      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(audioContext.destination);
      
      sourceNodeRef.current = source;
      durationRef.current = audioBuffer.duration;
      startTimeRef.current = audioContext.currentTime;
      
      source.onended = () => {
        console.log('[TTS] Playback ended');
        setIsPlaying(false);
        setCurrentId(null);
        setProgress(0);
        sourceNodeRef.current = null;
      };
      
      // Start playback
      console.log('[TTS] Starting playback at', playbackSpeed + 'x speed...');
      source.start();
      setIsPlaying(true);
      setIsLoading(false);
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
  }, [currentId, isPlaying, stop, toast, playbackSpeed, getAudioContext]);

  return (
    <TTSContext.Provider value={{ speak, stop, isPlaying, isLoading, currentId, progress, playbackSpeed, setPlaybackSpeed }}>
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
