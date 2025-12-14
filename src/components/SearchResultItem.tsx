import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, BookOpen, GraduationCap, ChevronDown, ChevronUp, Loader2, BookMarked } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/CopyButton';
import { PlayButton } from '@/components/PlayButton';
import { supabase } from '@/integrations/supabase/client';
import { createMarkdownComponents } from '@/lib/markdownTransformers';

export type SearchResultType = 'scripture' | 'notes' | 'questions' | 'words' | 'academy';

interface SearchResultItemProps {
  type: SearchResultType;
  reference: string;
  rawMarkdown: string;
  searchQuery: string;
  onVerseClick: (reference: string) => void;
  onAddToNotes?: (text: string) => void;
  onSearch?: (query: string) => void;
  currentLanguage?: string;
  // For word/academy - allows fetching full content
  articleId?: string;
}

const typeIcons = {
  scripture: BookMarked,
  notes: FileText,
  questions: HelpCircle,
  words: BookOpen,
  academy: GraduationCap,
};

const typeColors = {
  scripture: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  notes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  questions: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  words: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  academy: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
};

const typeLabels = {
  scripture: 'Scripture',
  notes: 'Translation Note',
  questions: 'Checking Question',
  words: 'Key Term',
  academy: 'Academy Article',
};

const PREVIEW_LENGTH = 200;

function SearchResultItemInner({
  type,
  reference,
  rawMarkdown,
  searchQuery,
  onVerseClick,
  onAddToNotes,
  onSearch,
  currentLanguage,
  articleId,
}: SearchResultItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);

  const Icon = typeIcons[type];
  const colorClasses = typeColors[type];
  const label = typeLabels[type];

  // Use full content if fetched, otherwise use raw markdown from search
  const displayContent = fullContent || rawMarkdown;
  const contentPreview = displayContent.length > PREVIEW_LENGTH
    ? displayContent.substring(0, PREVIEW_LENGTH) + '...'
    : displayContent;

  // Can expand if content is long or needs full fetch (word/academy)
  const canExpand = type === 'words' || type === 'academy' || displayContent.length > PREVIEW_LENGTH;

  // Fetch full article content on expand for word/academy types
  const handleExpand = useCallback(async () => {
    if (!canExpand) return;

    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // Fetch full content if expanding and we haven't fetched yet
    if (newExpanded && !fullContent && !isLoadingFull) {
      const id = articleId || reference.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (type === 'words') {
        setIsLoadingFull(true);
        try {
          const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
            body: {
              endpoint: 'fetch-translation-word',
              params: { term: id, language: 'en', organization: 'unfoldingWord' },
            },
          });
          if (!error && data) {
            const content = typeof data === 'string' ? data : (data?.content || data?.definition || '');
            setFullContent(content);
          }
        } catch (err) {
          console.error('Failed to fetch word article:', err);
        } finally {
          setIsLoadingFull(false);
        }
      } else if (type === 'academy') {
        setIsLoadingFull(true);
        try {
          const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
            body: {
              endpoint: 'fetch-translation-academy',
              params: { moduleId: id, language: 'en', organization: 'unfoldingWord' },
            },
          });
          if (!error && data) {
            const content = typeof data === 'string' ? data : (data?.content || '');
            setFullContent(content);
          }
        } catch (err) {
          console.error('Failed to fetch academy article:', err);
        } finally {
          setIsLoadingFull(false);
        }
      }
    }
  }, [isExpanded, canExpand, fullContent, isLoadingFull, type, articleId, reference]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() && onAddToNotes) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  // Create markdown components with search highlighting and reference clicking
  const markdownComponents = createMarkdownComponents(searchQuery, onVerseClick);

  return (
    <div className="glass-card rounded-xl overflow-hidden group relative animate-fade-in border border-border/30">
      {/* Action buttons */}
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <PlayButton
          text={displayContent}
          id={`search-${type}-${reference}`}
          language={currentLanguage}
        />
        <CopyButton text={`${reference}\n\n${displayContent}`} />
      </div>

      {/* Clickable card area */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleExpand}
        onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
        className={cn(
          "w-full p-4 text-left transition-colors",
          canExpand && "hover:bg-white/5 cursor-pointer"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg border shrink-0', colorClasses)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-16">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] uppercase tracking-wider font-medium', colorClasses.split(' ')[0])}>
                {label}
              </span>
              {reference && (
                <span className="text-[10px] text-muted-foreground">• {reference}</span>
              )}
            </div>

            {/* Preview when collapsed */}
            {!isExpanded && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-0 line-clamp-3">{children}</p>,
                    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside text-sm text-muted-foreground mb-0 line-clamp-3">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-muted-foreground mb-0 line-clamp-3">{children}</ol>,
                    li: ({ children }) => <li className="text-sm truncate">{children}</li>,
                    h1: ({ children }) => <span className="text-sm font-semibold text-foreground">{children}</span>,
                    h2: ({ children }) => <span className="text-sm font-medium text-foreground">{children}</span>,
                    h3: ({ children }) => <span className="text-sm font-medium text-foreground">{children}</span>,
                    blockquote: ({ children }) => <span className="italic text-muted-foreground">{children}</span>,
                    a: ({ href, children }) => {
                      const handleClick = (e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const searchTerm = typeof children === 'string' ? children :
                          (href?.split('/').pop()?.replace(/\.md$/, '').replace(/-/g, ' ') || 'topic');
                        onSearch?.(searchTerm);
                      };
                      return (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleClick}
                          onKeyDown={(e) => e.key === 'Enter' && handleClick(e as any)}
                          className="text-primary underline hover:text-primary/80 inline cursor-pointer"
                        >
                          {children}
                        </span>
                      );
                    },
                  }}
                >
                  {contentPreview.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {canExpand && (
            <div className="shrink-0 text-muted-foreground">
              {isLoadingFull ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-0"
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
            >
              <div className="pl-11 prose prose-sm prose-invert max-w-none">
                {isLoadingFull ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading full article...</span>
                  </div>
                ) : (
                  <ReactMarkdown components={markdownComponents}>
                    {displayContent.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const SearchResultItem = memo(SearchResultItemInner);
