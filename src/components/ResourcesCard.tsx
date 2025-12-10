import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, BookOpen, GraduationCap, ChevronLeft, ChevronRight, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Resource } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTranslationWord, fetchTranslationAcademy } from '@/services/translationHelpsApi';
import { CopyButton } from '@/components/CopyButton';

interface ResourcesCardProps {
  resources: Resource[];
  onAddToNotes: (text: string) => void;
  onSearch?: (query: string) => void;
  onClearVerseFilter?: () => void;
  verseFilter?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  scrollToType?: Resource['type'] | null;
  onScrollComplete?: () => void;
}

const resourceIcons = {
  'translation-note': FileText,
  'translation-question': HelpCircle,
  'translation-word': BookOpen,
  'academy-article': GraduationCap,
};

const resourceColors = {
  'translation-note': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'translation-question': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'translation-word': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  'academy-article': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
};

const resourceLabels = {
  'translation-note': 'Translation Note',
  'translation-question': 'Checking Question',
  'translation-word': 'Key Term',
  'academy-article': 'Academy Article',
};

const PREVIEW_LENGTH = 150;

// Extract article ID from title for deterministic lookup
// TW titles are often "term, variant1, variant2" - use first term only
function extractArticleId(title: string): string {
  const firstTerm = title.split(',')[0].trim();
  return firstTerm
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

interface ExpandableResourceProps {
  resource: Resource;
  index: number;
  onAddToNotes: (text: string) => void;
  onSearch?: (query: string) => void;
}

function ExpandableResource({ resource, index, onAddToNotes, onSearch }: ExpandableResourceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const Icon = resourceIcons[resource.type];
  const colorClasses = resourceColors[resource.type];
  const label = resourceLabels[resource.type];
  
  // Use full content if loaded, otherwise use preview content
  const displayContent = fullContent || resource.content;
  const contentPreview = displayContent.length > PREVIEW_LENGTH 
    ? displayContent.substring(0, PREVIEW_LENGTH) + '...'
    : displayContent;
  
  // Always allow expansion for word/academy types, or if content is long
  const canExpand = resource.type === 'translation-word' || 
                    resource.type === 'academy-article' || 
                    displayContent.length > PREVIEW_LENGTH;

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  // Fetch full article content on expand for word/academy types
  const handleExpand = useCallback(async () => {
    if (!canExpand) return;
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    // Only fetch if expanding and we haven't fetched yet
    if (newExpanded && !fullContent && !isLoadingFull) {
      const articleId = extractArticleId(resource.title);
      
      if (resource.type === 'translation-word') {
        setIsLoadingFull(true);
        try {
          const wordData = await fetchTranslationWord(articleId);
          if (wordData?.content) {
            setFullContent(wordData.content);
          }
        } catch (err) {
          console.error('[ExpandableResource] Failed to fetch word:', err);
        } finally {
          setIsLoadingFull(false);
        }
      } else if (resource.type === 'academy-article') {
        setIsLoadingFull(true);
        try {
          const academyData = await fetchTranslationAcademy(articleId);
          if (academyData?.content) {
            setFullContent(academyData.content);
          }
        } catch (err) {
          console.error('[ExpandableResource] Failed to fetch academy:', err);
        } finally {
          setIsLoadingFull(false);
        }
      }
    }
  }, [isExpanded, canExpand, fullContent, isLoadingFull, resource.type, resource.title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card rounded-xl overflow-hidden group relative"
    >
      {/* Copy button for the full content */}
      <CopyButton 
        text={`${resource.title}\n\n${displayContent}`}
        className="absolute top-3 right-3 z-10"
      />
      <button
        onClick={handleExpand}
        className={cn(
          "w-full p-4 text-left transition-colors",
          canExpand && "hover:bg-white/5 cursor-pointer"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg border shrink-0', colorClasses)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] uppercase tracking-wider font-medium', colorClasses.split(' ')[0])}>
                {label}
              </span>
              {resource.reference && (
                <span className="text-[10px] text-muted-foreground">• {resource.reference}</span>
              )}
            </div>
            <h3 className="font-medium text-foreground text-sm mb-2 line-clamp-2">
              {resource.title}
            </h3>
            
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
                  {contentPreview}
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
      </button>
      
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
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-muted-foreground">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-muted-foreground">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    h1: ({ children }) => <h1 className="text-base font-bold mb-2 text-foreground">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 text-foreground">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-foreground">{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground">
                        {children}
                      </blockquote>
                    ),
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
                          className="text-primary underline hover:text-primary/80 inline text-left cursor-pointer"
                        >
                          {children}
                        </span>
                      );
                    },
                  }}
                >
                  {isLoadingFull ? 'Loading full article...' : displayContent}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ResourcesCard({ resources, onAddToNotes, onSearch, onClearVerseFilter, verseFilter, isLoading, error, onRetry, scrollToType, onScrollComplete }: ResourcesCardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeType, setActiveType] = useState<string | null>(null);

  // Group resources by type
  const groupedResources = resources.reduce((acc, resource) => {
    if (!acc[resource.type]) acc[resource.type] = [];
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  const resourceTypes = ['translation-note', 'translation-question', 'translation-word', 'academy-article'] as const;
  const availableTypes = resourceTypes.filter(type => groupedResources[type]?.length > 0);

  // Track which section is in view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || availableTypes.length === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      let currentType: string | null = null;
      let closestDistance = Infinity;

      for (const type of availableTypes) {
        const section = sectionRefs.current[type];
        if (section) {
          const sectionRect = section.getBoundingClientRect();
          // Distance from section top to container top
          const distance = sectionRect.top - containerRect.top;
          
          // Find the section closest to (but not below) the top of the container
          if (distance <= 50 && Math.abs(distance) < closestDistance) {
            closestDistance = Math.abs(distance);
            currentType = type;
          }
        }
      }

      // If nothing is close to the top, use the first visible section
      if (!currentType) {
        for (const type of availableTypes) {
          const section = sectionRefs.current[type];
          if (section) {
            const sectionRect = section.getBoundingClientRect();
            if (sectionRect.top < containerRect.bottom && sectionRect.bottom > containerRect.top) {
              currentType = type;
              break;
            }
          }
        }
      }

      setActiveType(currentType || availableTypes[0]);
    };

    // Set initial active type
    setActiveType(availableTypes[0]);

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [availableTypes.join(',')]);

  // Scroll to specific resource type when triggered from chat links
  useEffect(() => {
    if (!scrollToType || !scrollContainerRef.current) return;
    
    // Wait for resources to be available
    if (resources.length === 0) return;
    
    const sectionEl = sectionRefs.current[scrollToType];
    const containerEl = scrollContainerRef.current;
    
    if (sectionEl && containerEl) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const offsetTop = sectionEl.offsetTop - containerEl.offsetTop - 8;
        containerEl.scrollTo({ top: offsetTop, behavior: 'smooth' });
        onScrollComplete?.();
      });
    } else {
      // If section not found, still complete to reset state
      onScrollComplete?.();
    }
  }, [scrollToType, resources.length, onScrollComplete]);

  const scrollToSection = (type: string) => {
    const sectionEl = sectionRefs.current[type];
    const containerEl = scrollContainerRef.current;
    if (sectionEl && containerEl) {
      const offsetTop = sectionEl.offsetTop - containerEl.offsetTop - 8;
      containerEl.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  };

  // Skeleton loading component
  const ResourcesSkeleton = () => (
    <div className="flex flex-col h-full">
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>
      {/* Type filter skeleton */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-20 h-8 rounded-full" />
          ))}
        </div>
      </div>
      {/* Resource cards skeleton */}
      <div className="flex-1 overflow-hidden px-4 pb-24">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-20 h-3" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                  <Skeleton className="w-3/4 h-4" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-full h-3" />
                    <Skeleton className="w-full h-3" />
                    <Skeleton className="w-2/3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Show skeleton when loading without existing data
  if (isLoading && resources.length === 0) {
    return <ResourcesSkeleton />;
  }

  // Subtle loading overlay when refreshing with existing data
  const loadingOverlay = isLoading && resources.length > 0 ? (
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
            Unable to Load Resources
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {error.includes('404') 
              ? 'No resources found for this scripture reference.'
              : error.includes('network') || error.includes('fetch')
              ? 'Network error. Please check your connection.'
              : 'Something went wrong while fetching resources.'}
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

  if (resources.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Resources
          </h2>
          <p className="text-muted-foreground text-sm">
            Translation notes, questions, and articles will appear here
          </p>
        </div>
        
        <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
          <div className="flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>Scripture</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Notes</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {loadingOverlay}
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Verse filter badge */}
      {verseFilter && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pb-2"
        >
          <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
            <span className="text-xs text-primary font-medium">
              Filtered: {verseFilter}
            </span>
            <button
              onClick={onClearVerseFilter}
              className="text-primary/70 hover:text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Type summary - clickable icons with active state */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2 justify-center">
          {availableTypes.map(type => {
            const Icon = resourceIcons[type];
            const count = groupedResources[type].length;
            const isActive = activeType === type;
            return (
              <button 
                key={type}
                onClick={() => scrollToSection(type)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all hover:scale-105 active:scale-95',
                  resourceColors[type],
                  isActive && 'ring-2 ring-offset-1 ring-offset-background scale-110'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resources list - grouped by type with section headers */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-20 fade-edges">
        <div className="max-w-xl mx-auto space-y-6 pt-2">
          {resourceTypes.map(type => {
            const typeResources = groupedResources[type];
            if (!typeResources?.length) return null;
            
            const Icon = resourceIcons[type];
            const label = resourceLabels[type];
            const colorClass = resourceColors[type].split(' ')[0]; // Get just the text color
            
            return (
              <div 
                key={type} 
                ref={el => { sectionRefs.current[type] = el; }}
              >
                {/* Sticky section header */}
                <div className="sticky top-0 z-10 flex items-center gap-2 py-2 px-1 bg-background/95 backdrop-blur-sm -mx-1">
                  <Icon className={cn('w-4 h-4', colorClass)} />
                  <h3 className={cn('text-sm font-medium', colorClass)}>
                    {label}s
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ({typeResources.length})
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                
                {/* Resources in this section */}
                <div className="space-y-3">
                  {typeResources.map((resource, index) => (
                    <ExpandableResource
                      key={resource.id}
                      resource={resource}
                      index={index}
                      onAddToNotes={onAddToNotes}
                      onSearch={onSearch}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
