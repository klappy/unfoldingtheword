import { useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, BookOpen, GraduationCap, ChevronDown, ChevronUp, Loader2, BookMarked, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/CopyButton';
import { PlayButton } from '@/components/PlayButton';
import { supabase } from '@/integrations/supabase/client';
import { createMarkdownComponents } from '@/lib/markdownTransformers';
import type { SearchInteraction } from '@/types/interactions';

export type SearchResultType = 'scripture' | 'notes' | 'questions' | 'words' | 'academy';

interface SearchResultItemProps {
  type: SearchResultType;
  reference: string;
  rawMarkdown: string;
  searchQuery: string;
  onVerseClick?: (reference: string) => void;
  onAddToNotes?: (text: string) => void;
  onSearch?: (query: string) => void;
  // NEW: LLM-driven interaction handler (Prompt over code)
  onInteraction?: (interaction: SearchInteraction) => void;
  currentLanguage?: string;
  // For word/academy - allows fetching full content
  articleId?: string;
  // Optional metadata from search results
  metadata?: Record<string, any>;
}

const typeIcons: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  scripture: BookMarked,
  notes: FileText,
  questions: HelpCircle,
  words: BookOpen,
  academy: GraduationCap,
};

const typeColors: Record<SearchResultType, { text: string; bg: string; border: string }> = {
  scripture: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  notes: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  questions: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  words: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  academy: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
};

const typeLabels: Record<SearchResultType, string> = {
  scripture: 'Scripture',
  notes: 'Note',
  questions: 'Question',
  words: 'Term',
  academy: 'Article',
};

const PREVIEW_LENGTH = 200;

// Extract a prominent display title from metadata or reference
function getDisplayTitle(type: SearchResultType, reference: string, metadata?: Record<string, any>): string {
  if (type === 'words') return metadata?.term || metadata?.title || reference;
  if (type === 'academy') return metadata?.title || metadata?.moduleId || reference;
  if (type === 'questions') return metadata?.question || reference;
  if (type === 'notes') return metadata?.title || reference;
  // Scripture: show reference with resource version if available
  if (type === 'scripture' && metadata?.resource) {
    return `${reference} (${metadata.resource})`;
  }
  return reference;
}

function SearchResultItemInner({
  type,
  reference,
  rawMarkdown,
  searchQuery,
  onVerseClick,
  onAddToNotes,
  onSearch,
  onInteraction,
  currentLanguage,
  articleId,
  metadata,
}: SearchResultItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);

  const Icon = typeIcons[type];
  const colors = typeColors[type];
  const label = typeLabels[type];
  const displayTitle = getDisplayTitle(type, reference, metadata);
  const isScriptureType = type === 'scripture';

  // For scripture: extract verse text from markdown (strip YAML frontmatter)
  const extractScriptureContent = (markdown: string): string => {
    // Remove YAML frontmatter (---...---)
    const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n*/m, '');
    // Remove any remaining metadata lines (lines starting with key:)
    const lines = withoutFrontmatter.split('\n');
    const contentLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip metadata-like lines
      if (/^(reference|book|chapter|verse|resource|language|organization|testament|matches):/i.test(trimmed)) return false;
      return true;
    });
    return contentLines.join('\n').trim();
  };

  // Use full content if fetched, otherwise use raw markdown from search
  const rawContent = fullContent || rawMarkdown;
  const displayContent = isScriptureType ? extractScriptureContent(rawContent) : rawContent;
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

  // Handle click - LLM-driven interactions (Prompt over code)
  const handleClick = () => {
    if (isScriptureType) {
      // Scripture clicks send prompt to LLM: "Read Romans 8:39"
      if (onInteraction) {
        onInteraction({
          type: 'read_scripture',
          reference,
          resource: metadata?.resource,
        });
      } else if (onVerseClick) {
        // Fallback for backwards compatibility
        onVerseClick(reference);
      }
    } else if (type === 'words' || type === 'academy') {
      // Word/academy clicks can either expand locally or send to LLM
      if (onInteraction && !isExpanded) {
        // First click: expand locally for quick preview
        handleExpand();
      } else if (onInteraction && isExpanded) {
        // Second click when expanded: send to LLM for deeper exploration
        onInteraction({
          type: 'expand_article',
          term: displayTitle,
          articleType: type,
        });
      } else {
        handleExpand();
      }
    } else {
      handleExpand();
    }
  };

  // Memoize preview components that include scripture reference parsing
  const previewComponents = useMemo(() => {
    const fullComponents = createMarkdownComponents(searchQuery, onVerseClick);
    return {
      ...fullComponents,
      // Override with line-clamping for preview while keeping reference parsing
      p: ({ children, ...props }: any) => (
        <p className="text-sm text-muted-foreground leading-relaxed mb-0 line-clamp-3" {...props}>
          {typeof children === 'string' ? fullComponents.p({ children }).props.children : children}
        </p>
      ),
      ul: ({ children }: any) => <ul className="list-disc list-inside text-sm text-muted-foreground mb-0 line-clamp-3">{children}</ul>,
      ol: ({ children }: any) => <ol className="list-decimal list-inside text-sm text-muted-foreground mb-0 line-clamp-3">{children}</ol>,
      li: ({ children }: any) => <li className="text-sm truncate">{children}</li>,
      a: ({ href, children }: any) => {
        const handleLinkClick = (e: React.MouseEvent) => {
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
            onClick={handleLinkClick}
            onKeyDown={(e) => e.key === 'Enter' && handleLinkClick(e as any)}
            className="text-primary underline hover:text-primary/80 inline cursor-pointer"
          >
            {children}
          </span>
        );
      },
    };
  }, [searchQuery, onVerseClick, onSearch]);

  return (
    <div className="glass-card rounded-xl overflow-hidden group relative animate-fade-in border border-border/30 max-w-full">
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
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={cn(
          "w-full p-4 text-left transition-colors",
          (canExpand || isScriptureType) && "hover:bg-white/5 cursor-pointer"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg border shrink-0', colors.bg, colors.border, colors.text)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-16 break-words">
            {/* Prominent title */}
            <h3 className="font-medium text-foreground text-sm mb-1 line-clamp-2">
              {displayTitle}
            </h3>
            
            {/* Type label and clickable reference (if different from title) */}
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-[10px] uppercase tracking-wider font-medium', colors.text)}>
                {label}
              </span>
              {reference && reference !== displayTitle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerseClick?.(reference);
                  }}
                  className="text-[10px] text-primary hover:underline truncate"
                >
                  • {reference}
                </button>
              )}
            </div>

            {/* Preview when collapsed - now uses previewComponents with scripture parsing */}
            {!isExpanded && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown components={previewComponents}>
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
              <div className="pl-11 prose prose-sm prose-invert max-w-none break-words">
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
