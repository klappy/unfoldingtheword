import { useEffect, useRef, useCallback, memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, X, ChevronDown } from 'lucide-react';
import { ScripturePassage, ScriptureChapter, ScriptureVerse } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FallbackBadge } from '@/components/FallbackBadge';
import { FallbackState } from '@/hooks/useScriptureData';
import { VersionSelector } from '@/components/VersionSelector';
import { ScriptureVersion, OrganizationOption } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { useVisibleChapters } from '@/hooks/useVisibleChapters';

interface ScriptureCardProps {
  passage: ScripturePassage | null;
  onAddToNotes: (text: string) => void;
  onVerseSelect?: (reference: string) => void;
  verseFilter?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  fallbackState?: FallbackState;
  onTranslateRequest?: () => void;
  isTranslating?: boolean;
  // Version selector props
  versionPreferences?: ScriptureVersion[];
  onVersionSelect?: (version: ScriptureVersion) => void;
  getOrganizationsForLanguage?: (langId: string) => Promise<OrganizationOption[]>;
  currentLanguage?: string;
}

// Memoized chapter component to prevent unnecessary re-renders
const ChapterContent = memo(function ChapterContent({
  chapter,
  bookName,
  selectedVerse,
  onVerseClick
}: {
  chapter: ScriptureChapter;
  bookName: string;
  selectedVerse: { chapter: number; verse: number } | null;
  onVerseClick: (chapter: number, verseNum: number, e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="scripture-text text-lg"
    >
      {chapter.verses.map((verse, index) => {
        const isSelected = selectedVerse?.chapter === chapter.chapter && selectedVerse?.verse === verse.number;
        
        // First verse of chapter gets the drop cap
        if (index === 0) {
          return (
            <span 
              key={`${chapter.chapter}-${verse.number}-${index}`}
              onClick={(e) => onVerseClick(chapter.chapter, verse.number, e)}
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
            onClick={(e) => onVerseClick(chapter.chapter, verse.number, e)}
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
  );
});

// Chapter placeholder for unloaded chapters
const ChapterPlaceholder = memo(function ChapterPlaceholder({ chapter }: { chapter: number }) {
  return (
    <div className="py-8 text-center">
      <Skeleton className="w-12 h-12 mx-auto rounded" />
      <Skeleton className="w-32 h-4 mx-auto mt-4" />
    </div>
  );
});

export function ScriptureCard({ 
  passage, 
  onAddToNotes, 
  onVerseSelect, 
  verseFilter, 
  isLoading, 
  error, 
  onRetry, 
  fallbackState, 
  onTranslateRequest, 
  isTranslating,
  versionPreferences = [],
  onVersionSelect,
  getOrganizationsForLanguage,
  currentLanguage = 'en',
}: ScriptureCardProps) {
  const [isVersionSelectorOpen, setIsVersionSelectorOpen] = useState(false);
  const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  // Use lazy chapter loading
  const totalChapters = passage?.book?.chapters?.length || 0;
  const { containerRef, registerSentinel, shouldRenderChapter, visibleRange } = useVisibleChapters(
    totalChapters,
    passage?.targetChapter
  );
  
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
      if (targetEl && containerRef.current) {
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

  // Skeleton loading component
  const ScriptureSkeleton = () => (
    <div className="flex flex-col h-full">
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>
      <div className="px-6 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-24 h-4" />
        </div>
        <Skeleton className="w-16 h-3" />
      </div>
      <div className="flex-1 overflow-hidden px-6 pb-24">
        <div className="max-w-xl mx-auto pt-2 space-y-8">
          {[1, 2, 3].map((chapter) => (
            <div key={chapter} className="space-y-3">
              {/* Chapter heading skeleton */}
              <div className="flex items-start gap-2">
                <Skeleton className="w-12 h-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
              {/* Verse lines skeleton */}
              {[1, 2, 3, 4].map((line) => (
                <div key={line} className="flex gap-1">
                  <Skeleton className="w-4 h-3 shrink-0" />
                  <Skeleton className={cn("h-4", line % 2 === 0 ? "w-full" : "w-4/5")} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Show skeleton when loading without existing data
  if (isLoading && !passage) {
    return <ScriptureSkeleton />;
  }

  // Show skeleton overlay when refreshing with existing data
  const loadingOverlay = isLoading && passage ? (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
    </div>
  ) : null;

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
      <div className="flex flex-col h-full relative">
        {loadingOverlay}
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

        {/* Header - sticky with background, tappable to open version selector */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 pb-3 bg-background/95 backdrop-blur-sm z-10"
        >
          <button
            onClick={() => onVersionSelect && setIsVersionSelectorOpen(true)}
            className={cn(
              "flex items-center justify-between w-full text-left",
              onVersionSelect && "hover:bg-primary/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
            )}
            disabled={!onVersionSelect}
          >
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Book className="w-4 h-4" />
                <span className="text-sm font-medium">{passage.book.book}</span>
                {onVersionSelect && <ChevronDown className="w-3 h-3 text-primary/60" />}
              </div>
              <span className="text-xs text-muted-foreground">{passage.translation}</span>
            </div>
            {fallbackState?.hasFallback && (
              <div onClick={(e) => e.stopPropagation()}>
                <FallbackBadge 
                  onTranslateClick={onTranslateRequest}
                  showTranslateButton={!!onTranslateRequest}
                  isTranslating={isTranslating}
                />
              </div>
            )}
          </button>
        </motion.div>

        {/* Version Selector */}
        {onVersionSelect && getOrganizationsForLanguage && (
          <VersionSelector
            isOpen={isVersionSelectorOpen}
            onClose={() => setIsVersionSelectorOpen(false)}
            versionPreferences={versionPreferences}
            onVersionSelect={onVersionSelect}
            onReorder={() => {}}
            getOrganizationsForLanguage={getOrganizationsForLanguage}
            currentLanguage={currentLanguage}
          />
        )}

        {/* Scripture content - full book with chapters (lazy loaded) */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 pb-24 fade-edges"
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          <div className="max-w-xl mx-auto pt-2">
            {passage.book.chapters.map((chapter) => {
              const shouldRender = shouldRenderChapter(chapter.chapter);
              
              return (
                <div
                  key={chapter.chapter}
                  ref={(el) => {
                    if (el) {
                      chapterRefs.current.set(chapter.chapter, el);
                      registerSentinel(chapter.chapter, el);
                    }
                  }}
                  className="chapter-section"
                  id={`chapter-${chapter.chapter}`}
                  data-chapter={chapter.chapter}
                >
                  {shouldRender ? (
                    <ChapterContent
                      chapter={chapter}
                      bookName={passage.book!.book}
                      selectedVerse={selectedVerse}
                      onVerseClick={handleVerseClick}
                    />
                  ) : (
                    <ChapterPlaceholder chapter={chapter.chapter} />
                  )}
                </div>
              );
            })}
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