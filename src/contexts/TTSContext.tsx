import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TTSContextType {
  speak: (text: string, id: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  currentId: string | null;
  progress: number;
}

const TTSContext = createContext<TTSContextType | null>(null);

// Tiny silent MP3 (base64) to unlock audio on mobile
const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAARMQVU=';

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isUnlockedRef = useRef(false);
  const { toast } = useToast();

  // Update progress based on audio currentTime
  const updateProgress = useCallback(() => {
    if (audioRef.current && audioRef.current.duration > 0 && !isNaN(audioRef.current.duration)) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
    }
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying]);

  // Start/stop progress tracking
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

  // Create a persistent audio element
  useEffect(() => {
    audioRef.current = new Audio();
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentId(null);
      setProgress(0);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    
    const handleError = (e: Event) => {
      console.error('[TTS] Audio error event:', e);
      setIsPlaying(false);
      setCurrentId(null);
      setProgress(0);
    };
    
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentId(null);
    setProgress(0);
  }, []);

  // Unlock audio on first user interaction
  const unlockAudio = useCallback(async () => {
    if (isUnlockedRef.current || !audioRef.current) return;
    
    try {
      // Play silent audio to unlock
      audioRef.current.src = SILENT_MP3;
      audioRef.current.volume = 0.01;
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
      isUnlockedRef.current = true;
      console.log('[TTS] Audio unlocked successfully');
    } catch (err) {
      console.log('[TTS] Could not unlock audio:', err);
    }
  }, []);

  const speak = useCallback(async (text: string, id: string) => {
    // If clicking the same item that's playing, stop it
    if (currentId === id && isPlaying) {
      stop();
      return;
    }

    // Stop any current playback
    stop();
    
    // Immediately try to unlock audio on user gesture
    await unlockAudio();
    
    setIsLoading(true);
    setCurrentId(id);
    
    try {
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

      console.log('[TTS] Fetching audio for text length:', cleanText.length);

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: cleanText }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to generate speech');
      }
      
      // Clean up previous URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      // Create blob from response
      const blob = new Blob([data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      objectUrlRef.current = audioUrl;
      
      console.log('[TTS] Audio blob created, size:', blob.size);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        // Wait for audio to be ready
        await new Promise<void>((resolve, reject) => {
          const audio = audioRef.current!;
          
          const onCanPlay = () => {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = (e: Event) => {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            reject(new Error('Audio load error'));
          };
          
          audio.addEventListener('canplaythrough', onCanPlay);
          audio.addEventListener('error', onError);
          audio.load();
        });
        
        console.log('[TTS] Audio loaded, attempting play');
        
        // Play the audio
        await audioRef.current.play();
        setIsPlaying(true);
        console.log('[TTS] Audio playing successfully');
      }
    } catch (err) {
      console.error('[TTS] Error:', err);
      setCurrentId(null);
      toast({
        title: 'TTS Error',
        description: err instanceof Error ? err.message : 'Failed to play audio',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentId, isPlaying, stop, toast, unlockAudio]);

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
