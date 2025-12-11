import { Volume2, Square, Loader2 } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { cn } from '@/lib/utils';

interface PlayButtonProps {
  text: string;
  id: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function PlayButton({ text, id, className, size = 'sm' }: PlayButtonProps) {
  const { speak, isPlaying, isLoading, currentId } = useTTS();
  const isActive = currentId === id;
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2';
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    speak(text, id);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading && isActive}
      className={cn(
        buttonSize,
        'rounded-lg transition-all duration-200',
        'opacity-0 group-hover:opacity-100 focus:opacity-100',
        'hover:bg-primary/10 text-muted-foreground hover:text-primary',
        isActive && isPlaying && 'opacity-100 text-primary bg-primary/10',
        isActive && isLoading && 'opacity-100',
        className
      )}
      title={isActive && isPlaying ? 'Stop' : 'Play'}
    >
      {isLoading && isActive ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : isPlaying && isActive ? (
        <Square className={cn(iconSize, 'fill-current')} />
      ) : (
        <Volume2 className={iconSize} />
      )}
    </button>
  );
}
