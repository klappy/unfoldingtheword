import { useState, useCallback } from 'react';
import { ScripturePassage, Resource } from '@/types';
import {
  fetchScripture,
  fetchTranslationNotes,
  fetchTranslationQuestions,
  fetchTranslationWordLinks,
  fetchTranslationWord,
  searchResources,
} from '@/services/translationHelpsApi';

export function useScriptureData() {
  const [scripture, setScripture] = useState<ScripturePassage | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScriptureData = useCallback(async (reference: string) => {
    setIsLoading(true);
    setError(null);

    console.log('[useScriptureData] Loading data for:', reference);

    try {
      // Fetch scripture and all related resources in parallel
      const [scriptureData, notes, questions, wordLinks] = await Promise.all([
        fetchScripture(reference).catch(err => {
          console.error('[useScriptureData] Scripture fetch failed:', err);
          return null;
        }),
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

      console.log('[useScriptureData] Fetched data:', {
        scripture: scriptureData,
        notesCount: notes.length,
        questionsCount: questions.length,
        wordLinksCount: wordLinks.length,
      });

      // Set scripture if we got it
      if (scriptureData) {
        setScripture({
          reference: scriptureData.reference,
          text: scriptureData.text,
          verses: scriptureData.verses,
          translation: scriptureData.translation,
        });
      }

      // Build resources array - include ALL resources without artificial limits
      const newResources: Resource[] = [];

      // Add ALL translation notes - no truncation
      notes.forEach((note, index) => {
        if (note.note || note.quote) {
          newResources.push({
            id: `note-${index}`,
            type: 'translation-note',
            title: note.quote || `Note on ${note.reference}`,
            content: note.note, // Full content
            reference: note.reference,
          });
        }
      });

      // Add ALL translation questions - no truncation
      questions.forEach((q, index) => {
        if (q.question) {
          newResources.push({
            id: `question-${index}`,
            type: 'translation-question',
            title: q.question,
            content: q.response, // Full content
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
              content: word.definition || word.content, // Full content, no truncation
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
      setResources(newResources);
    } catch (err) {
      console.error('[useScriptureData] Error loading scripture data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // New function: Search for resources by keyword (for non-scripture queries)
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

      // Parse Translation Words results - prioritize exact keyword matches
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
        const keywordLower = keyword.toLowerCase().split(' ')[0]; // Get first word of query
        
        // Score exact matches higher
        const isExactMatch = pathWord === keywordLower || title.toLowerCase() === keywordLower;

        return { hit, content, title, isExactMatch, originalIndex: index };
      }).filter(r => r.content);

      // Sort: exact matches first, then by original order
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
      // Clear scripture for keyword searches
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
    setError(null);
  }, []);

  return {
    scripture,
    resources,
    isLoading,
    error,
    loadScriptureData,
    loadKeywordResources,
    clearData,
  };
}
