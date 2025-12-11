import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceStatus } from '@/hooks/useVoiceConversation';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useToast } from '@/hooks/use-toast';

interface PersistentInputBarProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  language?: string;
  // Voice conversation state
  voiceStatus: VoiceStatus;
  voiceIsConnected: boolean;
  voiceIsAgentSpeaking: boolean;
  voiceAgentTranscript: string;
  onStartVoice: () => void;
  onEndVoice: () => void;
  onShowVoiceMode: () => void;
  // Reset command handling
  onResetCommand?: () => void;
}

export function PersistentInputBar({
  onSendMessage,
  isLoading,
  placeholder = 'Ask anything...',
  language,
  voiceStatus,
  voiceIsConnected,
  voiceIsAgentSpeaking,
  voiceAgentTranscript,
  onStartVoice,
  onEndVoice,
  onShowVoiceMode,
  onResetCommand,
}: PersistentInputBarProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { isRecording, isTranscribing, toggleRecording } = useVoiceRecording({
    onTranscription: (text) => {
      setInput(prev => prev ? `${prev} ${text}` : text);
    },
    onError: (error) => {
      toast({
        title: 'Voice Error',
        description: error,
        variant: 'destructive',
      });
    },
    language,
  });

  // Auto-expand textarea based on content
  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      const trimmedInput = input.trim().toLowerCase();
      // Detect reset command
      if (trimmedInput === 'reset' || trimmedInput === 'reset all' || trimmedInput === 'clear all data') {
        setInput('');
        onResetCommand?.();
        return;
      }
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const voiceIsActive = voiceStatus === 'connected' || voiceStatus === 'speaking' || voiceStatus === 'listening' || voiceStatus === 'processing';

  // Voice mode: show compact voice controls
  if (voiceIsActive) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Status indicator - tap to expand */}
            <button
              onClick={onShowVoiceMode}
              className="flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors"
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                voiceStatus === 'listening' ? 'bg-primary/20' : 
                voiceStatus === 'speaking' ? 'bg-accent/20' : 
                'bg-green-500/20'
              )}>
                {voiceStatus === 'listening' ? (
                  <Mic className="w-5 h-5 text-primary animate-pulse" />
                ) : voiceStatus === 'speaking' ? (
                  <Volume2 className="w-5 h-5 text-accent animate-pulse" />
                ) : (
                  <Phone className="w-5 h-5 text-green-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                {voiceAgentTranscript ? (
                  <p className="text-sm text-foreground truncate">
                    {voiceAgentTranscript.slice(-60)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {voiceStatus === 'listening' ? 'Listening...' : 
                     voiceStatus === 'speaking' ? 'Speaking...' : 
                     voiceStatus === 'processing' ? 'Processing...' :
                     'Voice active - tap to expand'}
                  </p>
                )}
              </div>
            </button>

            {/* End call button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEndVoice}
              className="w-12 h-12 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center transition-colors shrink-0"
            >
              <PhoneOff className="w-5 h-5 text-destructive-foreground" />
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Text mode: show text input with mic and phone buttons
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/30">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 glass-card rounded-2xl p-2 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground 
                         resize-none outline-none px-3 py-2 text-sm max-h-30 transition-[height] duration-150 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={cn(
                'p-2 rounded-xl transition-all duration-200 shrink-0',
                isRecording
                  ? 'bg-primary text-primary-foreground animate-pulse-slow'
                  : isTranscribing
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              {isTranscribing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                'p-2 rounded-xl transition-all duration-200 shrink-0',
                input.trim() && !isLoading
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {/* Voice call button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onStartVoice}
            disabled={voiceStatus === 'connecting'}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
              voiceStatus === 'connecting'
                ? 'bg-primary/50'
                : 'bg-accent/20 hover:bg-accent/30 text-accent'
            )}
          >
            {voiceStatus === 'connecting' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Phone className="w-5 h-5" />
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
