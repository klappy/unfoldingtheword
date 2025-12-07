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

    try {
      // Fetch scripture and all related resources in parallel
      const [scriptureData, notes, questions, wordLinks] = await Promise.all([
        fetchScripture(reference),
        fetchTranslationNotes(reference),
        fetchTranslationQuestions(reference),
        fetchTranslationWordLinks(reference),
      ]);

      // Set scripture
      setScripture({
        reference: scriptureData.reference,
        text: scriptureData.text,
        verses: scriptureData.verses,
        translation: scriptureData.translation,
      });

      // Build resources array
      const newResources: Resource[] = [];

      // Add translation notes
      notes.forEach((note, index) => {
        newResources.push({
          id: `note-${index}`,
          type: 'translation-note',
          title: note.quote || `Note on ${note.reference}`,
          content: note.note,
          reference: note.reference,
        });
      });

      // Add translation questions
      questions.forEach((q, index) => {
        newResources.push({
          id: `question-${index}`,
          type: 'translation-question',
          title: q.question,
          content: q.response,
          reference: q.reference,
        });
      });

      // Fetch word definitions for each word link
      const wordPromises = wordLinks.slice(0, 5).map((link) => 
        fetchTranslationWord(link.articleId).then((word) => ({
          link,
          word,
        }))
      );
      
      const wordResults = await Promise.all(wordPromises);
      
      wordResults.forEach(({ link, word }, index) => {
        if (word) {
          newResources.push({
            id: `word-${index}`,
            type: 'translation-word',
            title: `${link.word} - ${word.term}`,
            content: word.definition || word.content.substring(0, 300),
            reference: link.reference,
          });
        }
      });

      setResources(newResources);
    } catch (err) {
      console.error('Error loading scripture data:', err);
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
