import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, BookOpen, GraduationCap, ChevronLeft, ChevronRight, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Resource } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ResourcesCardProps {
  resources: Resource[];
  onAddToNotes: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
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

interface ExpandableResourceProps {
  resource: Resource;
  index: number;
  onAddToNotes: (text: string) => void;
}

function ExpandableResource({ resource, index, onAddToNotes }: ExpandableResourceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = resourceIcons[resource.type];
  const colorClasses = resourceColors[resource.type];
  const label = resourceLabels[resource.type];
  
  const contentPreview = resource.content.length > PREVIEW_LENGTH 
    ? resource.content.substring(0, PREVIEW_LENGTH) + '...'
    : resource.content;
  
  const hasMoreContent = resource.content.length > PREVIEW_LENGTH;

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card rounded-xl overflow-hidden"
    >
      <button
        onClick={() => hasMoreContent && setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-4 text-left transition-colors",
          hasMoreContent && "hover:bg-white/5 cursor-pointer"
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                {contentPreview}
              </p>
            )}
          </div>
          
          {hasMoreContent && (
            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {resource.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ResourcesCard({ resources, onAddToNotes, isLoading, error, onRetry }: ResourcesCardProps) {
  // Group resources by type
  const groupedResources = resources.reduce((acc, resource) => {
    if (!acc[resource.type]) acc[resource.type] = [];
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  const resourceTypes = ['translation-note', 'translation-question', 'translation-word', 'academy-article'] as const;
  const availableTypes = resourceTypes.filter(type => groupedResources[type]?.length > 0);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Loading Resources
          </h2>
          <p className="text-muted-foreground text-sm">
            Fetching translation notes, questions, and word studies...
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
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Type summary */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2 justify-center">
          {availableTypes.map(type => {
            const Icon = resourceIcons[type];
            const count = groupedResources[type].length;
            return (
              <div 
                key={type}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border',
                  resourceColors[type]
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resources list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 fade-edges">
        <div className="max-w-xl mx-auto space-y-3 pt-2">
          {resources.map((resource, index) => (
            <ExpandableResource
              key={resource.id}
              resource={resource}
              index={index}
              onAddToNotes={onAddToNotes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
