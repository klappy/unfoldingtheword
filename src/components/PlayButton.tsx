import { Volume2, Square, Loader2 } from 'lucide-react';
import { useTTS, PLAYBACK_SPEEDS, PlaybackSpeed } from '@/contexts/TTSContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PlayButtonProps {
  text: string;
  id: string;
  className?: string;
  size?: 'sm' | 'md';
  language?: string;
  showSpeedControl?: boolean;
}

// Circular progress ring component
function ProgressRing({ progress, size }: { progress: number; size: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className="absolute inset-0 -rotate-90"
      width={size}
      height={size}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-primary/20"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-100"
      />
    </svg>
  );
}

export function PlayButton({ text, id, className, size = 'sm', language = 'en', showSpeedControl = false }: PlayButtonProps) {
  const { speak, isPlaying, isLoading, currentId, progress, playbackSpeed, setPlaybackSpeed } = useTTS();
  const isActive = currentId === id;
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const buttonSize = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const ringSize = size === 'sm' ? 28 : 32;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    speak(text, id, language);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        disabled={isLoading && isActive}
        className={cn(
          buttonSize,
          'relative rounded-lg transition-all duration-200 flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'hover:bg-primary/10 text-muted-foreground hover:text-primary',
          isActive && isPlaying && 'opacity-100 text-primary',
          isActive && isLoading && 'opacity-100',
          className
        )}
        title={isActive && isPlaying ? 'Stop' : 'Play'}
      >
        {/* Progress ring when playing */}
        {isActive && isPlaying && (
          <ProgressRing progress={progress} size={ringSize} />
        )}
        
        {/* Icon */}
        <span className="relative z-10">
          {isLoading && isActive ? (
            <Loader2 className={cn(iconSize, 'animate-spin')} />
          ) : isPlaying && isActive ? (
            <Square className={cn(iconSize, 'fill-current')} />
          ) : (
            <Volume2 className={iconSize} />
          )}
        </span>
      </button>
      
      {/* Speed control - shown when playing or when showSpeedControl is true */}
      {(showSpeedControl || (isActive && isPlaying)) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors',
                'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
                'opacity-0 group-hover:opacity-100',
                isActive && isPlaying && 'opacity-100'
              )}
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[70px]">
            {PLAYBACK_SPEEDS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={(e) => {
                  e.stopPropagation();
                  setPlaybackSpeed(speed as PlaybackSpeed);
                }}
                className={cn(
                  'justify-center cursor-pointer text-xs',
                  playbackSpeed === speed && 'bg-primary/10 text-primary font-medium'
                )}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
