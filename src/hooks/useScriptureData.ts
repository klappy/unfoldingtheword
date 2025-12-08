import { useState, useCallback, useRef } from 'react';
import { ScripturePassage, Resource, ScriptureBook } from '@/types';
import {
  fetchScripture,
  fetchBook,
  fetchTranslationNotes,
  fetchTranslationQuestions,
  fetchTranslationWordLinks,
  fetchTranslationWord,
  searchResources,
  BookData,
} from '@/services/translationHelpsApi';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for fetched books
  const bookCache = useRef<Map<string, ScriptureBook>>(new Map());

  const loadScriptureData = useCallback(async (reference: string, retryCount = 0) => {
    const maxRetries = 3;
    setIsLoading(true);
    setError(null);

    console.log('[useScriptureData] Loading data for:', reference, retryCount > 0 ? `(retry ${retryCount})` : '');

    const parsed = parseReference(reference);
    if (!parsed) {
      console.error('[useScriptureData] Could not parse reference:', reference);
      setError('Invalid scripture reference');
      setIsLoading(false);
      return;
    }

    const { book, chapter, verse } = parsed;

    try {
      // Check cache first
      let bookData: ScriptureBook | undefined = bookCache.current.get(book);
      
      // Fetch resources in parallel while potentially fetching book
      const resourcesPromise = Promise.all([
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

      // Fetch full book if not cached
      if (!bookData) {
        console.log(`[useScriptureData] Fetching full book: ${book}`);
        const fetchedBook = await fetchBook(book);
        bookData = {
          book: fetchedBook.book,
          chapters: fetchedBook.chapters,
          translation: fetchedBook.translation,
          metadata: fetchedBook.metadata,
        };
        bookCache.current.set(book, bookData);
      } else {
        console.log(`[useScriptureData] Using cached book: ${book}`);
      }

      // Wait for resources
      const [notes, questions, wordLinks] = await resourcesPromise;

      console.log('[useScriptureData] Fetched data:', {
        book: bookData.book,
        chaptersCount: bookData.chapters.length,
        notesCount: notes.length,
        questionsCount: questions.length,
        wordLinksCount: wordLinks.length,
      });

      // Set scripture with book data and target position
      setScripture({
        reference,
        text: '', // Not needed for book display
        verses: [], // Use book.chapters instead
        translation: bookData.translation,
        metadata: bookData.metadata,
        book: bookData,
        targetChapter: chapter,
        targetVerse: verse,
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
    } catch (err) {
      console.error('[useScriptureData] Error loading scripture data:', err);
      
      // Auto-retry on failure
      if (retryCount < maxRetries) {
        console.log(`[useScriptureData] Auto-retrying in ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => {
          loadScriptureData(reference, retryCount + 1);
        }, (retryCount + 1) * 1000);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search for resources by keyword (for non-scripture queries)
  const loadKeywordResources = useCallback(async (keyword: string) => {
    setIsLoading(true);
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
      setScripture(null);
    } catch (err) {
      console.error('[useScriptureData] Error searching keyword:', err);
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setScripture(null);
    setResources([]);
    setAllResources([]);
    setVerseFilter(null);
    setError(null);
  }, []);

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

    setVerseFilter(verseReference);

    // If no verse specified, show all resources for that chapter
    if (!parsed.verse) {
      const chapterPrefix = `${parsed.book} ${parsed.chapter}:`;
      const chapterOnly = `${parsed.book} ${parsed.chapter}`;
      const filtered = allResources.filter(r => 
        r.reference?.startsWith(chapterPrefix) || 
        r.reference === chapterOnly ||
        r.reference?.includes(`${parsed.book} ${parsed.chapter}`)
      );
      console.log('[useScriptureData] Filtered to chapter:', filtered.length, 'resources');
      setResources(filtered.length > 0 ? filtered : allResources);
      return;
    }

    // Filter to specific verse
    const versePatterns = [
      `${parsed.book} ${parsed.chapter}:${parsed.verse}`,
      `${parsed.book} ${parsed.chapter}:${parsed.verse}-`,
      `-${parsed.verse}`,
    ];

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

  return {
    scripture,
    resources,
    isLoading,
    error,
    verseFilter,
    loadScriptureData,
    loadKeywordResources,
    filterByVerse,
    clearData,
  };
}