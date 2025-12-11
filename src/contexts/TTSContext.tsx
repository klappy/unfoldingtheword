import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
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

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
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
      const audio = e.target as HTMLAudioElement;
      console.error('[TTS] Audio error:', audio.error?.message || 'Unknown error');
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

  const speak = useCallback(async (text: string, id: string) => {
    // If clicking the same item that's playing, stop it
    if (currentId === id && isPlaying) {
      stop();
      return;
    }

    // Stop any current playback
    stop();
    
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

      // Use direct fetch for binary response handling
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      
      // Get response as blob directly
      const blob = await response.blob();
      
      console.log('[TTS] Audio blob received, size:', blob.size, 'type:', blob.type);
      
      // Clean up previous URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      const audioUrl = URL.createObjectURL(blob);
      objectUrlRef.current = audioUrl;
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        // Wait for audio to be ready
        await new Promise<void>((resolve, reject) => {
          const audio = audioRef.current!;
          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Audio load timeout'));
          }, 10000);
          
          const cleanup = () => {
            clearTimeout(timeoutId);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
          };
          
          const onCanPlay = () => {
            cleanup();
            resolve();
          };
          
          const onError = () => {
            cleanup();
            const errorMsg = audio.error?.message || 'Unknown audio error';
            reject(new Error(errorMsg));
          };
          
          audio.addEventListener('canplaythrough', onCanPlay);
          audio.addEventListener('error', onError);
          audio.load();
        });
        
        console.log('[TTS] Audio loaded, playing...');
        await audioRef.current.play();
        setIsPlaying(true);
        console.log('[TTS] Audio playing');
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
