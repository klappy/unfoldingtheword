import { Languages, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FallbackBadgeProps {
  className?: string;
  onTranslateClick?: () => void;
  showTranslateButton?: boolean;
  isTranslating?: boolean;
  itemCount?: number;
}

export function FallbackBadge({ 
  className, 
  onTranslateClick,
  showTranslateButton = true,
  isTranslating = false,
  itemCount,
}: FallbackBadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      className
    )}>
      {isTranslating ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Languages className="w-3 h-3" />
      )}
      <span>
        {isTranslating 
          ? 'Translating...' 
          : itemCount && itemCount > 1 
            ? `English fallback (${itemCount} items)` 
            : 'English fallback'
        }
      </span>
      {showTranslateButton && onTranslateClick && !isTranslating && (
        <button
          onClick={onTranslateClick}
          className="ml-1 underline hover:no-underline font-medium"
        >
          {itemCount && itemCount > 1 ? 'Translate All' : 'Translate'}
        </button>
      )}
    </div>
  );
}
