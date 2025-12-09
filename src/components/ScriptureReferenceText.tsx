import { ReactNode, useMemo } from 'react';
import { segmentTextWithReferences, ScriptureReference } from '@/lib/scriptureReferenceParser';
import { cn } from '@/lib/utils';

interface ScriptureReferenceTextProps {
  text: string;
  onReferenceClick?: (reference: string) => void;
  className?: string;
}

export function ScriptureReferenceText({ 
  text, 
  onReferenceClick,
  className 
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
              className={cn(
                "text-primary underline decoration-primary/40 underline-offset-2",
                "hover:decoration-primary hover:text-primary/80 transition-colors",
                "cursor-pointer"
              )}
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
