import { motion } from 'framer-motion';
import { Book, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';
import { ScripturePassage } from '@/types';
import { Button } from '@/components/ui/button';

interface ScriptureCardProps {
  passage: ScripturePassage | null;
  onAddToNotes: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadFullChapter?: (reference: string) => void;
}

export function ScriptureCard({ passage, onAddToNotes, isLoading, error, onRetry, onLoadFullChapter }: ScriptureCardProps) {
  // Check if this is a partial chapter (not all verses)
  const isPartialChapter = passage && passage.verses.length < 20;
  
  // Extract chapter reference from passage reference (e.g., "John 3:16" -> "John 3")
  const getChapterReference = (ref: string) => {
    const match = ref.match(/^(.+?\s+\d+)/);
    return match ? match[1] : ref;
  };
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      // Show add to notes prompt
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
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
            Fetching from Translation Helps API...
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

  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Header - sticky with background */}
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

      {/* Scripture content - with top padding to prevent overlap */}
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
          {passage.verses.map((verse, index) => {
            const showParagraphBreak = (verse as any).isParagraphStart && index > 0;
            return (
              <span key={verse.number}>
                {showParagraphBreak && <span className="block h-4" />}
                <span className="scripture-verse">{verse.number}</span>
                {verse.text}{' '}
              </span>
            );
          })}
        </motion.div>

        {/* Load full chapter button */}
        {isPartialChapter && onLoadFullChapter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-8 mb-4"
          >
            <button
              onClick={() => onLoadFullChapter(getChapterReference(passage.reference))}
              className="flex items-center gap-2 text-xs text-muted-foreground/70 hover:text-primary transition-colors py-2 px-4 rounded-full border border-border/30 hover:border-primary/30"
            >
              <BookOpen className="w-3 h-3" />
              <span>Read full chapter</span>
            </button>
          </motion.div>
        )}
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
