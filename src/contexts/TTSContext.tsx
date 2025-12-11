import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TTSContextType {
  speak: (text: string, id: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  currentId: string | null;
}

const TTSContext = createContext<TTSContextType | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Create a persistent audio element to maintain user gesture context
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentId(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    });
    audioRef.current.addEventListener('error', () => {
      console.error('[TTS] Audio playback error');
      setIsPlaying(false);
      setCurrentId(null);
    });
    
    return () => {
      if (audioRef.current) {
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
        .replace(/#{1,6}\s/g, '') // headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1') // italic
        .replace(/`([^`]+)`/g, '$1') // code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
        .replace(/^\s*[-*+]\s/gm, '') // list items
        .replace(/^\s*\d+\.\s/gm, '') // numbered lists
        .trim();

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
      
      // Use the persistent audio element
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        
        // Play with proper error handling
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (playError) {
          console.error('[TTS] Play error:', playError);
          // For mobile browsers, sometimes we need to try again
          toast({
            title: 'Tap to Play',
            description: 'Tap the play button again to start audio',
          });
          setCurrentId(null);
        }
      }
    } catch (err) {
      console.error('[TTS] Error:', err);
      setCurrentId(null);
      toast({
        title: 'TTS Error',
        description: err instanceof Error ? err.message : 'Failed to generate speech',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentId, isPlaying, stop, toast]);

  return (
    <TTSContext.Provider value={{ speak, stop, isPlaying, isLoading, currentId }}>
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
