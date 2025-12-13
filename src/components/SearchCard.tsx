import { SearchResults } from '@/types';
import { Search, Book, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SearchCardProps {
  results: SearchResults | null;
  onClearSearch: () => void;
  onVerseClick: (reference: string) => void;
}

export function SearchCard({ results, onClearSearch, onVerseClick }: SearchCardProps) {
  if (!results) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">No search results</p>
      </div>
    );
  }

  const { query, filter, reference, totalMatches, breakdown, matches } = results;

  // Group matches by book
  const matchesByBook: Record<string, typeof matches> = {};
  for (const match of matches) {
    if (!matchesByBook[match.book]) {
      matchesByBook[match.book] = [];
    }
    matchesByBook[match.book].push(match);
  }

  const highlightTerm = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              "{filter || query}"
              {reference && <span className="text-muted-foreground"> in {reference}</span>}
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">
            {totalMatches} matches
          </Badge>
          {breakdown.byTestament && Object.keys(breakdown.byTestament).length > 0 && (
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
          {/* Book breakdown */}
          {Object.keys(breakdown.byBook).length > 0 && (
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

          {/* Matches by book */}
          {Object.entries(matchesByBook).map(([book, bookMatches]) => (
            <div key={book} className="space-y-2">
              <button
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                onClick={() => onVerseClick(`${book} 1`)}
              >
                <Book className="h-3 w-3" />
                {book}
                <ChevronRight className="h-3 w-3" />
              </button>
              <div className="space-y-2 pl-5">
                {bookMatches.slice(0, 5).map((match, idx) => (
                  <button
                    key={idx}
                    className="block text-left w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => onVerseClick(`${match.book} ${match.chapter}:${match.verse}`)}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {match.book} {match.chapter}:{match.verse}
                    </div>
                    <div className="text-sm line-clamp-2">
                      {highlightTerm(match.text, filter || query)}
                    </div>
                  </button>
                ))}
                {bookMatches.length > 5 && (
                  <p className="text-xs text-muted-foreground pl-2">
                    +{bookMatches.length - 5} more in {book}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
