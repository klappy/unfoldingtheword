import { useTTS, PLAYBACK_SPEEDS, PlaybackSpeed } from '@/contexts/TTSContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface PlaybackSpeedSelectorProps {
  className?: string;
}

export function PlaybackSpeedSelector({ className }: PlaybackSpeedSelectorProps) {
  const { playbackSpeed, setPlaybackSpeed } = useTTS();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-md transition-colors',
            'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
            className
          )}
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[80px]">
        {PLAYBACK_SPEEDS.map((speed) => (
          <DropdownMenuItem
            key={speed}
            onClick={() => setPlaybackSpeed(speed as PlaybackSpeed)}
            className={cn(
              'justify-center cursor-pointer',
              playbackSpeed === speed && 'bg-primary/10 text-primary font-medium'
            )}
          >
            {speed}x
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
