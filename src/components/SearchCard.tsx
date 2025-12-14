import { Search, X, ChevronDown, ChevronUp, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { createMarkdownComponents } from '@/lib/markdownTransformers';
import type { SearchResults as NewSearchResults } from '@/hooks/useSearchState';
import type { SearchResults as LegacySearchResults, Resource } from '@/types';

// Union type to support both old and new formats during migration
type SearchCardResults = NewSearchResults | LegacySearchResults | null;

interface SearchCardProps {
  results: SearchCardResults;
  onClearSearch: () => void;
  onVerseClick: (reference: string) => void;
  // Legacy props for backwards compatibility
  filterQuery?: string | null;
  filterReference?: string | null;
  resourceMatchCount?: number;
  resourceResults?: Resource[];
}

// Type guard to check if results are in the new format
function isNewFormat(results: SearchCardResults): results is NewSearchResults {
  return results !== null && 'scopeType' in results;
}

export function SearchCard({
  results,
  onClearSearch,
  onVerseClick,
  filterQuery,
  filterReference,
  resourceMatchCount,
  resourceResults,
}: SearchCardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scripture: true,
    notes: false,
    questions: false,
    words: false,
  });

  // Memoize markdown components with current search term and click handler
  const searchQuery = results?.query || filterQuery || '';
  const markdownComponents = useMemo(
    () => createMarkdownComponents(searchQuery, onVerseClick),
    [searchQuery, onVerseClick]
  );

  // Handle empty state
  if (!results && !filterQuery) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">No search results</p>
      </div>
    );
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // New format rendering
  if (isNewFormat(results)) {
    const { query, scope, scripture, notes, questions, words } = results;

    const totalScriptureMatches = scripture?.totalCount || 0;
    const totalNotesMatches = notes?.totalCount || 0;
    const totalQuestionsMatches = questions?.totalCount || 0;
    const totalWordsMatches = words?.totalCount || 0;
    const totalMatches = totalScriptureMatches + totalNotesMatches + totalQuestionsMatches + totalWordsMatches;

    const renderSection = (
      title: string,
      key: string,
      data: { markdown: string; matches: any[]; totalCount: number; breakdown?: any } | null,
      icon: string
    ) => {
      if (!data || data.totalCount === 0) return null;

      const isExpanded = expandedSections[key];

      return (
        <div key={key} className="border border-border/50 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            onClick={() => toggleSection(key)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{icon}</span>
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {data.totalCount}
              </Badge>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {isExpanded && (
            <div className="p-4 border-t border-border/30">
              {/* Show breakdown badges for scripture */}
              {key === 'scripture' && data.breakdown?.byBook && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {Object.entries(data.breakdown.byBook)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 8)
                    .map(([book, count]) => (
                      <Badge
                        key={book}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent text-xs"
                        onClick={() => onVerseClick(`${book} 1`)}
                      >
                        {book}: {count as number}
                      </Badge>
                    ))}
                </div>
              )}

              {/* Render markdown content with transformations */}
              {data.markdown ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown components={markdownComponents}>
                    {data.markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                /* Fallback: render structured matches */
                <div className="space-y-3">
                  {data.matches.slice(0, 50).map((match, idx) => (
                    <button
                      key={idx}
                      className="block text-left w-full p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30"
                      onClick={() => {
                        if (match.book && match.chapter) {
                          onVerseClick(`${match.book} ${match.chapter}${match.verse ? `:${match.verse}` : ''}`);
                        } else if (match.reference) {
                          onVerseClick(match.reference);
                        }
                      }}
                    >
                      <div className="text-xs text-muted-foreground mb-1 font-medium">
                        {match.reference || (match.book ? `${match.book} ${match.chapter}:${match.verse}` : '')}
                      </div>
                      <div className="text-sm line-clamp-3">
                        <HighlightedText text={match.text} term={query} />
                      </div>
                    </button>
                  ))}
                  {data.matches.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Showing first 50 of {data.matches.length} matches
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="h-full w-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                "{query}"
                <span className="text-muted-foreground ml-1">in {scope}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {totalMatches} total matches
            </Badge>
            {totalScriptureMatches > 0 && (
              <span>📖 {totalScriptureMatches}</span>
            )}
            {totalNotesMatches > 0 && (
              <span>📝 {totalNotesMatches}</span>
            )}
            {totalQuestionsMatches > 0 && (
              <span>❓ {totalQuestionsMatches}</span>
            )}
            {totalWordsMatches > 0 && (
              <span>📚 {totalWordsMatches}</span>
            )}
          </div>
        </div>

        {/* Results sections */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3 pb-24">
            {renderSection('Scripture', 'scripture', scripture, '📖')}
            {renderSection('Translation Notes', 'notes', notes, '📝')}
            {renderSection('Translation Questions', 'questions', questions, '❓')}
            {renderSection('Translation Words', 'words', words, '📚')}

            {totalMatches === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No results found for "{query}" in {scope}.</p>
                <p className="text-sm mt-2">Try a different search term or broader scope.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Legacy format rendering (backwards compatible)
  const hasScriptureResults = !!results;
  const displayQuery = results?.query ?? filterQuery ?? '';
  const displayReference = results?.reference ?? filterReference ?? undefined;
  const resourceMatches = resourceMatchCount ?? (resourceResults?.length ?? 0);

  const matches = results?.matches ?? [];
  const resource = results?.resource;
  const totalMatches = results?.totalMatches ?? 0;
  const breakdown = results?.breakdown ?? { byTestament: {}, byBook: {} };

  // Group matches by book
  const matchesByBook: Record<string, typeof matches> = {};
  for (const match of matches) {
    if (!matchesByBook[match.book]) {
      matchesByBook[match.book] = [];
    }
    matchesByBook[match.book].push(match);
  }

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {displayQuery && (
                <>
                  "{displayQuery}"
                  {displayReference && (
                    <span className="text-muted-foreground"> in {displayReference}</span>
                  )}
                </>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {hasScriptureResults && (
            <Badge variant="secondary" className="text-xs">
              {totalMatches} matches
            </Badge>
          )}
          {resource && (
            <Badge variant="outline" className="text-xs uppercase">
              {resource}
            </Badge>
          )}
          {resourceMatches > 0 && (
            <Badge variant="outline" className="text-xs">
              {resourceMatches} resource match{resourceMatches === 1 ? '' : 'es'}
            </Badge>
          )}
          {breakdown.byTestament && Object.keys(breakdown.byTestament).length > 0 && hasScriptureResults && (
            <>
              {breakdown.byTestament['OT'] && (
                <span>OT: {breakdown.byTestament['OT']}</span>
              )}
              {breakdown.byTestament['NT'] && (
                <span>NT: {breakdown.byTestament['NT']}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pb-24">
          {/* Book breakdown - clickable to jump to that book's results */}
          {hasScriptureResults && Object.keys(breakdown.byBook).length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                By Book
              </h3>
              <div className="flex flex-wrap gap-1">
                {Object.entries(breakdown.byBook)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([book, count]) => (
                    <Badge
                      key={book}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onVerseClick(`${book} 1`)}
                    >
                      {book}: {count}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Matches grouped by book */}
          {hasScriptureResults && Object.entries(matchesByBook).map(([book, bookMatches]) => (
            <div key={book} className="space-y-2">
              <button
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                onClick={() => onVerseClick(`${book} 1`)}
              >
                <Book className="h-3 w-3" />
                {book}
              </button>
              <div className="space-y-2 pl-5">
                {bookMatches.map((match, idx) => (
                  <button
                    key={idx}
                    className="block text-left w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => onVerseClick(`${match.book} ${match.chapter}:${match.verse}`)}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {match.book} {match.chapter}:{match.verse}
                    </div>
                    <div className="text-sm line-clamp-2">
                      <HighlightedText text={match.text} term={displayQuery} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!hasScriptureResults && resourceMatches > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No scripture verses were matched directly, but {resourceMatches} resource
                match{resourceMatches === 1 ? ' was' : 'es were'} found.
                {resourceResults && resourceResults.length > 0
                  ? ' Here are those notes and questions:'
                  : ' Swipe to the Resources card to read the notes and questions for this search.'}
              </p>

              {resourceResults && resourceResults.length > 0 && (
                <div className="space-y-2">
                  {resourceResults.slice(0, 50).map((res, idx) => (
                    <div
                      key={res.id ?? idx}
                      className="p-3 rounded-md bg-muted/50 border border-border/40 space-y-1"
                    >
                      <div className="text-xs text-muted-foreground flex justify-between gap-2">
                        <span className="font-medium truncate">
                          {res.reference || 'Resource'}
                        </span>
                        <span className="uppercase text-[10px] tracking-wide">
                          {res.type === 'translation-question' ? 'Question' : 'Note'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground line-clamp-2">
                        {res.title}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-3">
                        <HighlightedText text={res.content} term={displayQuery} />
                      </div>
                    </div>
                  ))}
                  {resourceResults.length > 50 && (
                    <p className="text-xs text-muted-foreground">
                      Showing the first 50 of {resourceResults.length} resource matches. Swipe to the
                      Resources card to read all of the notes and questions for this search.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Simple highlight component for fallback rendering
function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term || !text) return <>{text}</>;

  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
