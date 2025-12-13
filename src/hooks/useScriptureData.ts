import { useState, useCallback, useRef } from 'react';
import { ScripturePassage, Resource, ScriptureBook, SearchResults } from '@/types';
import { toast } from '@/hooks/use-toast';
import {
  fetchScripture,
  fetchBook,
  fetchBookWithFallback,
  fetchTranslationNotes,
  fetchTranslationQuestions,
  fetchTranslationWordLinks,
  fetchTranslationWord,
  searchResources,
  searchScripture,
  BookData,
  FallbackInfo,
} from '@/services/translationHelpsApi';

export interface FallbackState {
  hasFallback: boolean;
  fallbackInfo: FallbackInfo | null;
}

// Parse reference to extract book, chapter, verse
function parseReference(ref: string): { book: string; chapter: number; verse?: number } | null {
  // Match patterns like "John 3:16", "John 3", "1 John 3:1"
  const match = ref.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  if (!match) {
    // Try book-only match like "Ruth"
    const bookOnly = ref.match(/^([A-Za-z0-9\s]+)$/);
    if (bookOnly) {
      return { book: bookOnly[1].trim(), chapter: 1 };
    }
    return null;
  }
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verse: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

export function useScriptureData() {
  const [scripture, setScripture] = useState<ScripturePassage | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]); // Store all resources for filtering
  const [verseFilter, setVerseFilter] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false); // Separate loading state for resources
  const [error, setError] = useState<string | null>(null);
  const [fallbackState, setFallbackState] = useState<FallbackState>({ hasFallback: false, fallbackInfo: null });
  
  // Cache for fetched books - keyed by bookName:resource
  const bookCache = useRef<Map<string, ScriptureBook>>(new Map());
  const hasShownFallbackToast = useRef(false);
  const currentResourceRef = useRef<string>('ult');

  // Get current resource from preferences - check new key first, then old for backward compatibility
  const getCurrentResourceFromPrefs = (): string => {
    const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
    if (prefsJson) {
      try {
        const prefs = JSON.parse(prefsJson);
        if (prefs.length > 0 && prefs[0].resource) {
          return prefs[0].resource;
        }
      } catch {}
    }
    return 'ult';
  };

  // Clear cache when resource changes
  const clearBookCache = useCallback(() => {
    bookCache.current.clear();
    console.log('[useScriptureData] Book cache cleared');
  }, []);

  // Load book data in background with fallback support
  // resourceOverride: if provided, use this resource instead of reading from localStorage
  const loadBookInBackground = useCallback(async (bookName: string, resourceOverride?: string): Promise<{ book: ScriptureBook; fallbackInfo: FallbackInfo | null } | null> => {
    const resource = resourceOverride || getCurrentResourceFromPrefs();
    const cacheKey = `${bookName}:${resource}`;
    
    // Check if resource changed - clear cache if so
    if (currentResourceRef.current !== resource) {
      console.log(`[useScriptureData] Resource changed from ${currentResourceRef.current} to ${resource}, clearing cache`);
      bookCache.current.clear();
      currentResourceRef.current = resource;
    }
    
    // Check cache first
    if (bookCache.current.has(cacheKey)) {
      console.log(`[useScriptureData] Book cache hit: ${cacheKey}`);
      return { book: bookCache.current.get(cacheKey)!, fallbackInfo: null };
    }

    console.log(`[useScriptureData] Loading book in background: ${bookName} (resource: ${resource})`);
    try {
      const fetchedBook = await fetchBookWithFallback(bookName, resource);
      const bookData: ScriptureBook = {
        book: fetchedBook.book,
        chapters: fetchedBook.chapters,
        translation: fetchedBook.translation,
        metadata: fetchedBook.metadata,
      };
      bookCache.current.set(cacheKey, bookData);
      return { book: bookData, fallbackInfo: fetchedBook.fallbackInfo };
    } catch (err) {
      console.error(`[useScriptureData] Failed to load book ${bookName}:`, err);
      return null;
    }
  }, []);

  // resourceOverride: if provided, use this resource instead of reading from localStorage
  const loadScriptureData = useCallback(async (reference: string, resourceOverride?: string, retryCount = 0) => {
    const maxRetries = 3;
    
    // Parse reference FIRST, before any state changes
    const parsed = parseReference(reference);
    if (!parsed) {
      console.error('[useScriptureData] Could not parse reference:', reference);
      setError('Invalid scripture reference');
      return;
    }

    const { book, chapter, verse } = parsed;
    
    // Set loading state - but DON'T clear scripture (keep stale content visible)
    // This prevents the card from vanishing during resource switches
    setIsLoading(true);
    setIsResourcesLoading(true);
    setError(null);

    const effectiveResource = resourceOverride || getCurrentResourceFromPrefs();
    console.log('[useScriptureData] Loading data for:', reference, 'resource:', effectiveResource, retryCount > 0 ? `(retry ${retryCount})` : '');

    try {
      // Start ALL fetches in parallel - book AND resources
      const [bookData, notes, questions, wordLinks] = await Promise.all([
        loadBookInBackground(book, resourceOverride),
        fetchTranslationNotes(reference).catch(err => {
          console.error('[useScriptureData] Notes fetch failed:', err);
          return [];
        }),
        fetchTranslationQuestions(reference).catch(err => {
          console.error('[useScriptureData] Questions fetch failed:', err);
          return [];
        }),
        fetchTranslationWordLinks(reference).catch(err => {
          console.error('[useScriptureData] Word links fetch failed:', err);
          return [];
        }),
      ]);

      if (!bookData) {
        throw new Error('Failed to load book data');
      }

      const { book: loadedBook, fallbackInfo } = bookData;

      // Handle fallback notification
      if (fallbackInfo?.usedFallback && !hasShownFallbackToast.current) {
        hasShownFallbackToast.current = true;
        setFallbackState({ hasFallback: true, fallbackInfo });
        toast({
          title: "Using English Resources",
          description: `Scripture for ${fallbackInfo.requestedLanguage} isn't available yet. Showing English with translation option.`,
          duration: 5000,
        });
      }

      console.log('[useScriptureData] Fetched data:', {
        book: loadedBook.book,
        chaptersCount: loadedBook.chapters.length,
        notesCount: notes.length,
        questionsCount: questions.length,
        wordLinksCount: wordLinks.length,
        usedFallback: fallbackInfo?.usedFallback,
      });

      // Build resources array
      const newResources: Resource[] = [];

      // Add ALL translation notes
      notes.forEach((note, index) => {
        if (note.note || note.quote) {
          newResources.push({
            id: `note-${index}`,
            type: 'translation-note',
            title: note.quote || `Note on ${note.reference}`,
            content: note.note,
            reference: note.reference,
          });
        }
      });

      // Add ALL translation questions
      questions.forEach((q, index) => {
        if (q.question) {
          newResources.push({
            id: `question-${index}`,
            type: 'translation-question',
            title: q.question,
            content: q.response,
            reference: q.reference,
          });
        }
      });

      // Fetch word definitions for ALL word links
      if (wordLinks.length > 0) {
        const wordPromises = wordLinks.map((link) => 
          fetchTranslationWord(link.articleId).then((word) => ({
            link,
            word,
          })).catch(() => ({ link, word: null }))
        );
        
        const wordResults = await Promise.all(wordPromises);
        
        wordResults.forEach(({ link, word }, index) => {
          if (word && (word.term || word.definition || word.content)) {
            newResources.push({
              id: `word-${index}`,
              type: 'translation-word',
              title: word.term || link.word,
              content: word.definition || word.content,
              reference: link.reference,
            });
          } else if (link.word) {
            newResources.push({
              id: `word-${index}`,
              type: 'translation-word',
              title: link.word,
              content: `Biblical term from ${link.reference}`,
              reference: link.reference,
            });
          }
        });
      }

      console.log('[useScriptureData] Built resources:', newResources.length);
      setAllResources(newResources);
      setResources(newResources);
      setVerseFilter(null);

      // Set scripture and loading state together to prevent flash
      setScripture({
        reference,
        text: '',
        verses: [],
        translation: loadedBook.translation,
        metadata: loadedBook.metadata,
        book: loadedBook,
        targetChapter: chapter,
        targetVerse: verse,
      });
      setIsLoading(false);
      setIsResourcesLoading(false);

    } catch (err) {
      console.error('[useScriptureData] Error loading scripture data:', err);
      
      // Auto-retry on failure - keep loading state true during retries
      if (retryCount < maxRetries) {
        console.log(`[useScriptureData] Auto-retrying in ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => {
          loadScriptureData(reference, resourceOverride, retryCount + 1);
        }, (retryCount + 1) * 1000);
        return; // Don't set isLoading to false - we're still loading
      }
      
      // Only set error and stop loading when retries exhausted
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsLoading(false);
      setIsResourcesLoading(false);
    }
  }, [loadBookInBackground, scripture?.book?.book]);

  // Search for resources by keyword (for non-scripture queries)
  const loadKeywordResources = useCallback(async (keyword: string) => {
    setIsResourcesLoading(true);
    setError(null);

    console.log('[useScriptureData] Searching for keyword:', keyword);

    try {
      // Search across all resource types
      const [twResults, tnResults, tqResults, taResults] = await Promise.all([
        searchResources(keyword, 'tw').catch(err => {
          console.error('[useScriptureData] TW search failed:', err);
          return [];
        }),
        searchResources(keyword, 'tn').catch(err => {
          console.error('[useScriptureData] TN search failed:', err);
          return [];
        }),
        searchResources(keyword, 'tq').catch(err => {
          console.error('[useScriptureData] TQ search failed:', err);
          return [];
        }),
        searchResources(keyword, 'ta').catch(err => {
          console.error('[useScriptureData] TA search failed:', err);
          return [];
        }),
      ]);

      console.log('[useScriptureData] Search results:', {
        tw: twResults.length,
        tn: tnResults.length,
        tq: tqResults.length,
        ta: taResults.length,
      });

      const newResources: Resource[] = [];

      // Parse Translation Words results
      const parsedTwResults = twResults.map((hit: any, index: number) => {
        let content = '';
        try {
          const blocks = JSON.parse(hit.content || '[]');
          if (Array.isArray(blocks)) {
            content = blocks.map((b: any) => b.text || '').join('\n').trim();
          }
        } catch {
          content = hit.content || '';
        }

        const titleMatch = content.match(/^#\s+([^\n]+)/m);
        const title = titleMatch ? titleMatch[1].trim() : (hit.path?.split('/').pop()?.replace('.md', '') || keyword);
        const pathWord = hit.path?.split('/').pop()?.replace('.md', '')?.toLowerCase() || '';
        const keywordLower = keyword.toLowerCase().split(' ')[0];
        const isExactMatch = pathWord === keywordLower || title.toLowerCase() === keywordLower;

        return { hit, content, title, isExactMatch, originalIndex: index };
      }).filter(r => r.content);

      parsedTwResults.sort((a, b) => {
        if (a.isExactMatch && !b.isExactMatch) return -1;
        if (!a.isExactMatch && b.isExactMatch) return 1;
        return a.originalIndex - b.originalIndex;
      });

      parsedTwResults.slice(0, 10).forEach((parsed, index) => {
        newResources.push({
          id: `tw-${index}`,
          type: 'translation-word',
          title: parsed.title,
          content: parsed.content,
          reference: keyword,
        });
      });

      // Parse Translation Notes results
      tnResults.slice(0, 10).forEach((hit: any, index: number) => {
        let content = '';
        try {
          const blocks = JSON.parse(hit.content || '[]');
          if (Array.isArray(blocks)) {
            content = blocks.map((b: any) => b.text || '').join('\n').trim();
          }
        } catch {
          content = hit.content || '';
        }

        const ref = hit.path?.match(/(\w+)\/(\d+)\/(\d+)/);
        const reference = ref ? `${ref[1]} ${ref[2]}:${ref[3]}` : keyword;

        if (content) {
          newResources.push({
            id: `tn-${index}`,
            type: 'translation-note',
            title: `Note on "${keyword}"`,
            content,
            reference,
          });
        }
      });

      // Parse Translation Questions results
      tqResults.slice(0, 10).forEach((hit: any, index: number) => {
        let content = '';
        try {
          const blocks = JSON.parse(hit.content || '[]');
          if (Array.isArray(blocks)) {
            content = blocks.map((b: any) => b.text || '').join('\n').trim();
          }
        } catch {
          content = hit.content || '';
        }

        const ref = hit.path?.match(/(\w+)\/(\d+)\/(\d+)/);
        const reference = ref ? `${ref[1]} ${ref[2]}:${ref[3]}` : keyword;

        if (content) {
          newResources.push({
            id: `tq-${index}`,
            type: 'translation-question',
            title: `Question about "${keyword}"`,
            content,
            reference,
          });
        }
      });

      // Parse Translation Academy results
      taResults.slice(0, 5).forEach((hit: any, index: number) => {
        let content = '';
        try {
          const blocks = JSON.parse(hit.content || '[]');
          if (Array.isArray(blocks)) {
            content = blocks.map((b: any) => b.text || '').join('\n').trim();
          }
        } catch {
          content = hit.content || '';
        }

        const titleMatch = content.match(/^#\s+([^\n]+)/m);
        const title = titleMatch ? titleMatch[1].trim() : (hit.path?.split('/').pop()?.replace('.md', '') || keyword);

        if (content) {
          newResources.push({
            id: `ta-${index}`,
            type: 'academy-article',
            title,
            content,
            reference: keyword,
          });
        }
      });

      console.log('[useScriptureData] Built keyword resources:', newResources.length);
      setResources(newResources);
      // Note: Scripture is intentionally preserved so users can view search results alongside existing scripture
    } catch (err) {
      console.error('[useScriptureData] Error searching keyword:', err);
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setIsResourcesLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setScripture(null);
    setResources([]);
    setAllResources([]);
    setVerseFilter(null);
    setError(null);
    setFallbackState({ hasFallback: false, fallbackInfo: null });
    hasShownFallbackToast.current = false;
  }, []);

  // Clear verse filter and show all resources
  const clearVerseFilter = useCallback(() => {
    console.log('[useScriptureData] Clearing verse filter');
    setVerseFilter(null);
    setResources(allResources);
  }, [allResources]);

  // Filter resources by verse reference
  const filterByVerse = useCallback((verseReference: string) => {
    console.log('[useScriptureData] Filtering resources for:', verseReference);
    
    // Parse the reference to get chapter and optional verse
    const parsed = parseReference(verseReference);
    if (!parsed) {
      // Clear filter if can't parse
      setVerseFilter(null);
      setResources(allResources);
      return;
    }

    // If no verse specified, clear the filter entirely
    if (!parsed.verse) {
      setVerseFilter(null);
      setResources(allResources);
      return;
    }

    setVerseFilter(verseReference);

    // Filter to specific verse
    const filtered = allResources.filter(r => {
      if (!r.reference) return false;
      
      // Check exact match
      if (r.reference === `${parsed.book} ${parsed.chapter}:${parsed.verse}`) return true;
      
      // Check if verse is in a range (e.g., "John 3:16-18" includes verse 17)
      const rangeMatch = r.reference.match(/(\d+):(\d+)-(\d+)$/);
      if (rangeMatch) {
        const startVerse = parseInt(rangeMatch[2], 10);
        const endVerse = parseInt(rangeMatch[3], 10);
        if (parsed.verse >= startVerse && parsed.verse <= endVerse) return true;
      }
      
      // Check single verse match
      const singleMatch = r.reference.match(/(\d+):(\d+)$/);
      if (singleMatch && parseInt(singleMatch[2], 10) === parsed.verse) return true;
      
      return false;
    });

    console.log('[useScriptureData] Filtered to verse:', filtered.length, 'resources');
    setResources(filtered.length > 0 ? filtered : allResources);
  }, [allResources]);

  // Legacy fallback - kept for compatibility but should not be used
  // All search results should come from orchestrator metadata via setSearchResultsFromMetadata
  const loadFilteredSearch = useCallback(async (reference: string, filter: string) => {
    console.warn('[useScriptureData] loadFilteredSearch called - this is a fallback. Search should come from orchestrator metadata.');
    // Set empty results - orchestrator should provide search_matches
    setSearchResults({
      query: `${filter} in ${reference}`,
      filter,
      reference,
      totalMatches: 0,
      breakdown: { byTestament: {}, byBook: {} },
      matches: [],
    });
  }, []);

  // Clear search results
  const clearSearchResults = useCallback(() => {
    setSearchResults(null);
  }, []);

  // Set search results directly from orchestrator metadata
  const setSearchResultsFromMetadata = useCallback((
    reference: string,
    filter: string,
    matches: { book: string; chapter: number; verse: number; text: string }[],
    resource?: string
  ) => {
    const byBook: Record<string, number> = {};
    const byTestament: Record<string, number> = {};
    
    const OT_BOOKS = new Set([
      'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
      'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
      '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
      'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
      'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah',
      'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
    ]);
    
    for (const match of matches) {
      byBook[match.book] = (byBook[match.book] || 0) + 1;
      const testament = OT_BOOKS.has(match.book) ? 'OT' : 'NT';
      byTestament[testament] = (byTestament[testament] || 0) + 1;
    }
    
    setSearchResults({
      query: `${filter} in ${reference}`,
      filter,
      reference,
      resource,
      totalMatches: matches.length,
      breakdown: { byTestament, byBook },
      matches,
    });
  }, []);

  // Navigate to a specific verse without reloading the book (fast scroll)
  const navigateToVerse = useCallback((reference: string): boolean => {
    const parsed = parseReference(reference);
    if (!parsed) return false;

    // Check if we already have this book loaded
    if (scripture?.book && scripture.book.book.toLowerCase() === parsed.book.toLowerCase()) {
      // Just update the target chapter/verse - no reload needed
      setScripture(prev => prev ? {
        ...prev,
        reference,
        targetChapter: parsed.chapter,
        targetVerse: parsed.verse,
      } : null);
      return true; // Indicate fast navigation was used
    }
    return false; // Book not loaded, caller should use loadScriptureData
  }, [scripture?.book]);

  return {
    scripture,
    resources,
    searchResults,
    isLoading,
    isResourcesLoading,
    error,
    verseFilter,
    fallbackState,
    loadScriptureData,
    loadKeywordResources,
    loadFilteredSearch,
    filterByVerse,
    clearVerseFilter,
    clearSearchResults,
    setSearchResultsFromMetadata,
    navigateToVerse,
    clearData,
    // Expose setters for MCP replay integration
    setScripture,
    setResources,
    setSearchResults,
  };
}