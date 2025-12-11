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
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Update progress
  const updateProgress = useCallback(() => {
    if (audioContextRef.current && durationRef.current > 0 && isPlaying) {
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
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
    };
  }, []);

  const gainNodeRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentId(null);
    setProgress(0);
  }, []);

  // Initialize or resume AudioContext - MUST be called in click handler
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 1.0;
      gainNodeRef.current.connect(audioContextRef.current.destination);
      console.log('[TTS] AudioContext created, sample rate:', audioContextRef.current.sampleRate);
    }
    // Resume if suspended (required for mobile)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
      console.log('[TTS] AudioContext resumed');
    }
    return audioContextRef.current;
  }, []);

  const speak = useCallback(async (text: string, id: string) => {
    // If clicking the same item that's playing, stop it
    if (currentId === id && isPlaying) {
      stop();
      return;
    }

    // Stop any current playback
    stop();
    
    // IMPORTANT: Initialize AudioContext immediately on user gesture
    const audioContext = initAudioContext();
    
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

      console.log('[TTS] Fetching audio, text length:', cleanText.length);

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
      
      // Get audio as ArrayBuffer for Web Audio API
      const arrayBuffer = await response.arrayBuffer();
      console.log('[TTS] Received audio buffer, size:', arrayBuffer.byteLength);
      
      // Decode audio data
      console.log('[TTS] Decoding audio...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      console.log('[TTS] Decoded audio - duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels, 'sampleRate:', audioBuffer.sampleRate);
      
      durationRef.current = audioBuffer.duration;
      
      // Create and configure source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      
      // Connect through gain node for volume control
      if (gainNodeRef.current) {
        sourceNode.connect(gainNodeRef.current);
      } else {
        sourceNode.connect(audioContext.destination);
      }
      
      sourceNode.onended = () => {
        console.log('[TTS] Playback ended');
        setIsPlaying(false);
        setCurrentId(null);
        setProgress(0);
        sourceNodeRef.current = null;
      };
      
      sourceNodeRef.current = sourceNode;
      startTimeRef.current = audioContext.currentTime;
      
      // Start playback
      sourceNode.start(0);
      setIsPlaying(true);
      console.log('[TTS] Audio started, context state:', audioContext.state);
      
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
  }, [currentId, isPlaying, stop, toast, initAudioContext]);

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
