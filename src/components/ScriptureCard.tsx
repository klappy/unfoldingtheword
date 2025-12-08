import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Book, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { ScripturePassage } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScriptureCardProps {
  passage: ScripturePassage | null;
  onAddToNotes: (text: string) => void;
  onVerseSelect?: (reference: string) => void;
  verseFilter?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ScriptureCard({ passage, onAddToNotes, onVerseSelect, verseFilter, isLoading, error, onRetry }: ScriptureCardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  // Derive selected verse from verseFilter prop
  const selectedVerse = (() => {
    if (!verseFilter) return null;
    // Parse "Book Chapter:Verse" format
    const match = verseFilter.match(/^(.+)\s+(\d+):(\d+)$/);
    if (match) {
      return { chapter: parseInt(match[2]), verse: parseInt(match[3]) };
    }
    return null;
  })();
  // Scroll to target chapter/verse when passage data is fully loaded
  useEffect(() => {
    // Only scroll when we have complete book data with chapters
    if (!passage?.book?.chapters?.length || !passage.targetChapter) return;
    
    console.log('[ScriptureCard] Book loaded, scrolling to chapter:', passage.targetChapter);

    // Use requestAnimationFrame to ensure DOM is painted
    const scrollToTarget = () => {
      const targetEl = chapterRefs.current.get(passage.targetChapter!);
      if (targetEl && scrollContainerRef.current) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('[ScriptureCard] Scrolled to chapter', passage.targetChapter);
        return true;
      }
      return false;
    };

    // First attempt after paint
    requestAnimationFrame(() => {
      if (!scrollToTarget()) {
        // Retry a few times if refs aren't ready
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          if (scrollToTarget() || attempts >= 10) {
            clearInterval(timer);
          }
        }, 50);
      }
    });
  }, [passage?.book?.chapters?.length, passage?.targetChapter, passage?.reference]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  const handleVerseClick = (chapter: number, verseNum: number, e: React.MouseEvent) => {
    // Don't trigger if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) return;
    
    e.stopPropagation();
    
    const bookName = passage?.book?.book || '';
    const reference = `${bookName} ${chapter}:${verseNum}`;
    
    // Toggle selection - if clicking same verse, clear it
    if (selectedVerse?.chapter === chapter && selectedVerse?.verse === verseNum) {
      onVerseSelect?.(`${bookName} ${chapter}`);
    } else {
      onVerseSelect?.(reference);
    }
  };

  const clearVerseSelection = () => {
    if (selectedVerse && passage?.book?.book) {
      onVerseSelect?.(`${passage.book.book} ${selectedVerse.chapter}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Loading Scripture
          </h2>
          <p className="text-muted-foreground text-sm">
            Fetching the complete book...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-8 max-w-sm"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Unable to Load Scripture
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {error.includes('404') 
              ? 'The scripture reference could not be found. Please check the reference format.'
              : error.includes('network') || error.includes('fetch')
              ? 'Network error. Please check your connection and try again.'
              : 'Something went wrong while fetching the scripture data.'}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  if (!passage) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Book className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Scripture Passage
          </h2>
          <p className="text-muted-foreground text-sm">
            Start a conversation to see relevant scripture here
          </p>
        </div>
        
        {/* Navigation hint */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
          <div className="flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>Chat</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Resources</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  // Book view with illuminated drop caps
  if (passage.book && passage.book.chapters.length > 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Swipe indicator */}
        <div className="pt-4 pb-2">
          <div className="swipe-indicator" />
        </div>

        {/* Selected verse indicator */}
        {selectedVerse && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pb-2"
          >
            <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
              <span className="text-xs text-primary font-medium">
                Focused: {passage.book.book} {selectedVerse.chapter}:{selectedVerse.verse}
              </span>
              <button
                onClick={clearVerseSelection}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Header - sticky with background */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 pb-3 bg-background/95 backdrop-blur-sm z-10"
        >
          <div className="flex items-center gap-2 text-primary">
            <Book className="w-4 h-4" />
            <span className="text-sm font-medium">{passage.book.book}</span>
          </div>
          <span className="text-xs text-muted-foreground">{passage.translation}</span>
        </motion.div>

        {/* Scripture content - full book with chapters */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 pb-24 fade-edges"
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          <div className="max-w-xl mx-auto pt-2">
            {passage.book.chapters.map((chapter) => (
              <div
                key={chapter.chapter}
                ref={(el) => {
                  if (el) chapterRefs.current.set(chapter.chapter, el);
                }}
                className="chapter-section"
                id={`chapter-${chapter.chapter}`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(chapter.chapter * 0.02, 0.5) }}
                  className="scripture-text text-lg"
                >
                  {chapter.verses.map((verse, index) => {
                    const isSelected = selectedVerse?.chapter === chapter.chapter && selectedVerse?.verse === verse.number;
                    
                    // First verse of chapter gets the drop cap
                    if (index === 0) {
                      return (
                        <span 
                          key={`${chapter.chapter}-${verse.number}-${index}`}
                          onClick={(e) => handleVerseClick(chapter.chapter, verse.number, e)}
                          className={cn(
                            "cursor-pointer transition-all rounded-sm",
                            isSelected && "bg-primary/20 ring-1 ring-primary/30"
                          )}
                        >
                          <span className="drop-cap-chapter">{chapter.chapter}</span>
                          <sup className="scripture-verse">{verse.number}</sup>
                          {verse.text}
                          {verse.isParagraphEnd && index < chapter.verses.length - 1 && (
                            <span className="block h-4" />
                          )}
                          {!verse.isParagraphEnd && ' '}
                        </span>
                      );
                    }

                    return (
                      <span 
                        key={`${chapter.chapter}-${verse.number}-${index}`}
                        onClick={(e) => handleVerseClick(chapter.chapter, verse.number, e)}
                        className={cn(
                          "cursor-pointer transition-all rounded-sm hover:bg-primary/5",
                          isSelected && "bg-primary/20 ring-1 ring-primary/30"
                        )}
                      >
                        <sup className="scripture-verse">{verse.number}</sup>
                        {verse.text}
                        {verse.isParagraphEnd && index < chapter.verses.length - 1 && (
                          <span className="block h-4" />
                        )}
                        {!verse.isParagraphEnd && ' '}
                      </span>
                    );
                  })}
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* Selection hint */}
        <div className="absolute bottom-20 left-0 right-0 text-center">
          <p className="text-xs text-muted-foreground/50">
            {selectedVerse ? 'Tap verse again to clear filter' : 'Tap a verse to focus resources'}
          </p>
        </div>
      </div>
    );
  }

  // Fallback: single passage view (legacy)
  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-3 bg-background/95 backdrop-blur-sm z-10"
      >
        <div className="flex items-center gap-2 text-primary">
          <Book className="w-4 h-4" />
          <span className="text-sm font-medium">{passage.reference}</span>
        </div>
        <span className="text-xs text-muted-foreground">{passage.translation}</span>
      </motion.div>

      {/* Scripture content */}
      <div 
        className="flex-1 overflow-y-auto px-6 pb-24 fade-edges"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scripture-text text-lg max-w-xl mx-auto pt-2"
        >
          {passage.verses.map((verse, index) => (
            <span key={`${passage.reference}-${verse.number}-${index}`}>
              <sup className="scripture-verse">{verse.number}</sup>
              {verse.text}
              {verse.isParagraphEnd && index < passage.verses.length - 1 && (
                <span className="block h-4" />
              )}
              {!verse.isParagraphEnd && ' '}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Selection hint */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground/50">
          Select text to add to notes
        </p>
      </div>
    </div>
  );
}