import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, className, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const padding = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'rounded-md transition-all duration-200',
        'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
        'opacity-0 group-hover:opacity-100 focus:opacity-100',
        padding,
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn(iconSize, 'text-emerald-400')} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  );
}
