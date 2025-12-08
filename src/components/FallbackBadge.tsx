import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FallbackBadgeProps {
  className?: string;
  onTranslateClick?: () => void;
  showTranslateButton?: boolean;
}

export function FallbackBadge({ 
  className, 
  onTranslateClick,
  showTranslateButton = true 
}: FallbackBadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      className
    )}>
      <Languages className="w-3 h-3" />
      <span>English fallback</span>
      {showTranslateButton && onTranslateClick && (
        <button
          onClick={onTranslateClick}
          className="ml-1 underline hover:no-underline font-medium"
        >
          Translate
        </button>
      )}
    </div>
  );
}
