import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react';
import { useVoiceConversation, VoiceStatus } from '@/hooks/useVoiceConversation';
import { cn } from '@/lib/utils';

interface VoiceConversationProps {
  language?: string;
  onScriptureReference?: (reference: string) => void;
  onClose?: () => void;
}

export function VoiceConversation({ language, onScriptureReference, onClose }: VoiceConversationProps) {
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  
  const {
    status,
    isAgentSpeaking,
    userTranscript,
    agentTranscript,
    startConversation,
    endConversation,
    isConnected,
  } = useVoiceConversation({
    language,
    onTranscript: (text, isFinal) => {
      if (isFinal && text.trim()) {
        setTranscriptHistory(prev => [...prev, { role: 'user', text }]);
      }
    },
    onAgentResponse: () => {
      // Streaming response - handled via agentTranscript state
    },
    onScriptureReference,
    onError: (error) => {
      console.error('Voice error:', error);
    },
  });

  // Add completed agent responses to history
  useEffect(() => {
    if (status === 'connected' && agentTranscript === '' && transcriptHistory.length > 0) {
      const lastEntry = transcriptHistory[transcriptHistory.length - 1];
      // If last entry was user, check if we need to add the agent response
      if (lastEntry?.role === 'user') {
        // Agent response will be added when it completes
      }
    }
  }, [status, agentTranscript, transcriptHistory]);

  const handleEndCall = () => {
    endConversation();
    onClose?.();
  };

  const getStatusText = (status: VoiceStatus): string => {
    switch (status) {
      case 'idle': return 'Tap to start voice conversation';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected - speak anytime';
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Connection error - tap to retry';
      default: return '';
    }
  };

  const getStatusColor = (status: VoiceStatus): string => {
    switch (status) {
      case 'idle': return 'text-muted-foreground';
      case 'connecting': return 'text-primary';
      case 'connected': return 'text-green-500';
      case 'listening': return 'text-primary';
      case 'processing': return 'text-amber-500';
      case 'speaking': return 'text-accent';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <AnimatePresence mode="popLayout">
          {transcriptHistory.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                entry.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto glass-card'
              )}
            >
              <p className="text-sm">{entry.text}</p>
            </motion.div>
          ))}
          
          {/* Current user transcript */}
          {userTranscript && status === 'listening' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[85%] ml-auto rounded-2xl px-4 py-3 bg-primary/50 text-primary-foreground"
            >
              <p className="text-sm">{userTranscript}</p>
            </motion.div>
          )}
          
          {/* Current agent transcript (streaming) */}
          {agentTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[85%] mr-auto glass-card rounded-2xl px-4 py-3"
            >
              <p className="text-sm">
                {agentTranscript}
                <span className="inline-flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Empty state */}
        {transcriptHistory.length === 0 && !agentTranscript && !userTranscript && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6"
            >
              <div className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center',
                isConnected ? 'bg-green-500/20' : 'bg-primary/20'
              )}>
                {status === 'speaking' ? (
                  <Volume2 className="w-12 h-12 text-accent animate-pulse" />
                ) : status === 'listening' ? (
                  <Mic className="w-12 h-12 text-primary animate-pulse" />
                ) : (
                  <Mic className={cn('w-12 h-12', isConnected ? 'text-green-500' : 'text-primary')} />
                )}
              </div>
            </motion.div>
            
            <p className={cn('text-sm mb-2', getStatusColor(status))}>
              {getStatusText(status)}
            </p>
            
            {isConnected && (
              <p className="text-xs text-muted-foreground max-w-xs">
                Ask about any scripture, topic, or translation question. I'll find resources and read them to you.
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Voice controls */}
      <div className="p-6 border-t border-border/30">
        <div className="flex items-center justify-center gap-6">
          {!isConnected ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startConversation}
              disabled={status === 'connecting'}
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-all',
                status === 'connecting'
                  ? 'bg-primary/50'
                  : 'bg-primary hover:bg-primary/90 glow-primary'
              )}
            >
              {status === 'connecting' ? (
                <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
              ) : (
                <Phone className="w-7 h-7 text-primary-foreground" />
              )}
            </motion.button>
          ) : (
            <>
              {/* Mute indicator */}
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                status === 'listening' ? 'bg-primary/20' : 'bg-muted/50'
              )}>
                {status === 'listening' ? (
                  <Mic className="w-6 h-6 text-primary animate-pulse" />
                ) : (
                  <MicOff className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              
              {/* End call button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center"
              >
                <PhoneOff className="w-7 h-7 text-destructive-foreground" />
              </motion.button>
              
              {/* Speaking indicator */}
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                isAgentSpeaking ? 'bg-accent/20' : 'bg-muted/50'
              )}>
                <Volume2 className={cn(
                  'w-6 h-6',
                  isAgentSpeaking ? 'text-accent animate-pulse' : 'text-muted-foreground'
                )} />
              </div>
            </>
          )}
        </div>
        
        {/* Status text */}
        <p className={cn('text-center text-xs mt-4', getStatusColor(status))}>
          {getStatusText(status)}
        </p>
      </div>
    </div>
  );
}
