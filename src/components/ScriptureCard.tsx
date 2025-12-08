import { motion } from 'framer-motion';
import { Book, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, BookOpen, ArrowRight } from 'lucide-react';
import { ScripturePassage } from '@/types';
import { Button } from '@/components/ui/button';

// Bible book chapter counts for navigation
const BOOK_CHAPTERS: Record<string, number> = {
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
  'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
  'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14,
  'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7, 'Nahum': 3,
  'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
  'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6,
  'Ephesians': 6, 'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5,
  '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
  'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
  '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22,
};

const BOOK_ORDER = Object.keys(BOOK_CHAPTERS);

interface ScriptureCardProps {
  passage: ScripturePassage | null;
  onAddToNotes: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadFullChapter?: (reference: string) => void;
}

// Parse reference into book, chapter, and optional verse range
function parseReference(ref: string): { book: string; chapter: number; startVerse?: number; endVerse?: number } | null {
  // Match patterns like "John 3:16", "John 3:16-18", "John 3", "1 John 3:1"
  const match = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) {
    // Try book-only match like "Ruth"
    const bookOnly = ref.match(/^([A-Za-z0-9\s]+)$/);
    if (bookOnly && BOOK_CHAPTERS[bookOnly[1].trim()]) {
      return { book: bookOnly[1].trim(), chapter: 1 };
    }
    return null;
  }
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    startVerse: match[3] ? parseInt(match[3], 10) : undefined,
    endVerse: match[4] ? parseInt(match[4], 10) : undefined,
  };
}

// Get navigation info based on current reference
function getNavigationInfo(ref: string, verseCount: number) {
  const parsed = parseReference(ref);
  if (!parsed) return null;

  const { book, chapter, startVerse } = parsed;
  const totalChapters = BOOK_CHAPTERS[book];
  if (!totalChapters) return null;

  const isPartialChapter = startVerse !== undefined || verseCount < 15;
  const isLastChapter = chapter >= totalChapters;
  const bookIndex = BOOK_ORDER.indexOf(book);
  const isLastBook = bookIndex === BOOK_ORDER.length - 1;
  const nextBook = !isLastBook ? BOOK_ORDER[bookIndex + 1] : null;

  return {
    book,
    chapter,
    totalChapters,
    isPartialChapter,
    isLastChapter,
    isLastBook,
    nextBook,
    fullChapterRef: `${book} ${chapter}`,
    nextChapterRef: !isLastChapter ? `${book} ${chapter + 1}` : null,
    nextBookRef: nextBook ? `${nextBook} 1` : null,
  };
}

export function ScriptureCard({ passage, onAddToNotes, isLoading, error, onRetry, onLoadFullChapter }: ScriptureCardProps) {
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  // Get navigation context
  const navInfo = passage ? getNavigationInfo(passage.reference, passage.verses.length) : null;

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

  // Determine what navigation button to show
  const getNavButton = () => {
    if (!navInfo || !onLoadFullChapter) return null;

    // Partial chapter -> show "Read full chapter"
    if (navInfo.isPartialChapter) {
      return {
        label: 'Read full chapter',
        ref: navInfo.fullChapterRef,
        icon: BookOpen,
      };
    }

    // Full chapter, not last chapter -> show "Read next chapter"
    if (navInfo.nextChapterRef) {
      return {
        label: `Read ${navInfo.book} ${navInfo.chapter + 1}`,
        ref: navInfo.nextChapterRef,
        icon: ArrowRight,
      };
    }

    // Last chapter of book -> show "Read next book"
    if (navInfo.nextBookRef && navInfo.nextBook) {
      return {
        label: `Begin ${navInfo.nextBook}`,
        ref: navInfo.nextBookRef,
        icon: ArrowRight,
      };
    }

    // End of Bible
    return {
      label: 'Return to Genesis',
      ref: 'Genesis 1',
      icon: BookOpen,
    };
  };

  const navButton = getNavButton();

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

        {/* Dynamic navigation button */}
        {navButton && onLoadFullChapter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-8 mb-4"
          >
            <button
              onClick={() => onLoadFullChapter(navButton.ref)}
              className="flex items-center gap-2 text-xs text-muted-foreground/70 hover:text-primary transition-colors py-2 px-4 rounded-full border border-border/30 hover:border-primary/30"
            >
              <navButton.icon className="w-3 h-3" />
              <span>{navButton.label}</span>
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
