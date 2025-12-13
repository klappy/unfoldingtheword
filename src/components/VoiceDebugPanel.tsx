import { VoiceStatus } from '@/hooks/useVoiceConversation';

interface VoiceDebugPanelProps {
  status: VoiceStatus;
  isAgentSpeaking: boolean;
  userTranscript: string;
  agentTranscript: string;
}

export const VoiceDebugPanel = ({
  status,
  isAgentSpeaking,
  userTranscript,
  agentTranscript,
}: VoiceDebugPanelProps) => {
  const statusColors: Record<VoiceStatus, string> = {
    idle: 'bg-muted',
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    listening: 'bg-blue-500',
    processing: 'bg-purple-500',
    speaking: 'bg-orange-500',
    error: 'bg-destructive',
  };

  return (
    <div className="fixed top-2 left-2 z-[9999] bg-background/95 border border-border rounded-lg p-3 text-xs font-mono max-w-[300px] shadow-lg">
      <div className="font-bold mb-2 text-foreground">Voice Debug</div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <span className={`px-2 py-0.5 rounded text-white ${statusColors[status]}`}>
            {status}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Speaking:</span>
          <span className={isAgentSpeaking ? 'text-green-400' : 'text-muted-foreground'}>
            {isAgentSpeaking ? 'YES' : 'no'}
          </span>
        </div>
        
        <div className="mt-2">
          <div className="text-muted-foreground">User:</div>
          <div className="text-foreground truncate max-w-full">
            {userTranscript || '(none)'}
          </div>
        </div>
        
        <div className="mt-1">
          <div className="text-muted-foreground">Agent:</div>
          <div className="text-foreground truncate max-w-full">
            {agentTranscript || '(none)'}
          </div>
        </div>
      </div>
    </div>
  );
};
