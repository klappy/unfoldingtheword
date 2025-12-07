import { useState, useCallback } from 'react';
import { ScripturePassage, Resource } from '@/types';
import {
  fetchScripture,
  fetchTranslationNotes,
  fetchTranslationQuestions,
  fetchTranslationWordLinks,
  fetchTranslationWord,
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

      // Build resources array
      const newResources: Resource[] = [];

      // Add translation notes
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

      // Add translation questions
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

      // Fetch word definitions for each word link (limit to avoid too many requests)
      if (wordLinks.length > 0) {
        const wordPromises = wordLinks.slice(0, 5).map((link) => 
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
              content: word.definition || word.content.substring(0, 500),
              reference: link.reference,
            });
          } else if (link.word) {
            // Add the word link even without definition
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
    clearData,
  };
}
