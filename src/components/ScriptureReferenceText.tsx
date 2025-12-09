import { ReactNode, useMemo } from 'react';
import { segmentTextWithReferences, ScriptureReference } from '@/lib/scriptureReferenceParser';
import { cn } from '@/lib/utils';

interface ScriptureReferenceTextProps {
  text: string;
  onReferenceClick?: (reference: string) => void;
  className?: string;
  variant?: 'default' | 'user'; // 'user' for user message bubbles with primary background
}

export function ScriptureReferenceText({ 
  text, 
  onReferenceClick,
  className,
  variant = 'default'
}: ScriptureReferenceTextProps) {
  const segments = useMemo(() => segmentTextWithReferences(text), [text]);

  const handleClick = (ref: ScriptureReference) => {
    // Construct the reference string: "Book Chapter:Verse" or "Book Chapter"
    let refString = `${ref.book} ${ref.chapter}`;
    if (ref.verse) {
      refString += `:${ref.verse}`;
      if (ref.endVerse) {
        refString += `-${ref.endVerse}`;
      }
    }
    onReferenceClick?.(refString);
  };

  // Different styles for user messages (primary bg) vs assistant messages
  const linkStyles = variant === 'user'
    ? "text-primary-foreground underline decoration-primary-foreground/50 underline-offset-2 hover:decoration-primary-foreground transition-colors cursor-pointer font-medium"
    : "text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary hover:text-primary/80 transition-colors cursor-pointer";

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'reference' && segment.reference) {
          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleClick(segment.reference!);
              }}
              className={linkStyles}
            >
              {segment.content}
            </button>
          );
        }
        return <span key={index}>{segment.content}</span>;
      })}
    </span>
  );
}