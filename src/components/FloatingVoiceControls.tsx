import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { VoiceStatus } from '@/hooks/useVoiceConversation';
import { cn } from '@/lib/utils';

interface FloatingVoiceControlsProps {
  status: VoiceStatus;
  isAgentSpeaking: boolean;
  agentTranscript: string;
  onEndCall: () => void;
  onExpand: () => void;
}

export function FloatingVoiceControls({
  status,
  isAgentSpeaking,
  agentTranscript,
  onEndCall,
  onExpand,
}: FloatingVoiceControlsProps) {
  const isActive = status === 'connected' || status === 'speaking' || status === 'listening' || status === 'processing';
  
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="glass-card rounded-full px-4 py-3 flex items-center gap-4 shadow-lg border border-border/30">
          {/* Status indicator */}
          <button
            onClick={onExpand}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              status === 'listening' ? 'bg-primary/20' : 
              status === 'speaking' ? 'bg-accent/20' : 
              'bg-green-500/20'
            )}>
              {status === 'listening' ? (
                <Mic className="w-5 h-5 text-primary animate-pulse" />
              ) : status === 'speaking' ? (
                <Volume2 className="w-5 h-5 text-accent animate-pulse" />
              ) : (
                <Phone className="w-5 h-5 text-green-500" />
              )}
            </div>
            
            {/* Transcript preview */}
            <div className="max-w-[200px]">
              {agentTranscript ? (
                <p className="text-sm text-foreground truncate">
                  {agentTranscript.slice(-50)}...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {status === 'listening' ? 'Listening...' : 
                   status === 'speaking' ? 'Speaking...' : 
                   'Voice active'}
                </p>
              )}
            </div>
          </button>

          {/* End call button */}
          <button
            onClick={onEndCall}
            className="w-10 h-10 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center transition-colors"
          >
            <PhoneOff className="w-5 h-5 text-destructive-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
