import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TranslationState {
  isTranslating: boolean;
  translatedContent: Map<string, string>;
  pendingTranslation: {
    id: string;
    content: string;
    contentType: string;
  } | null;
}

export function useTranslation(targetLanguage: string) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<Map<string, string>>(new Map());
  const [pendingTranslation, setPendingTranslation] = useState<TranslationState['pendingTranslation']>(null);

  const translateContent = useCallback(async (
    id: string,
    content: string,
    contentType: 'scripture' | 'note' | 'question' | 'word' | 'article'
  ) => {
    setIsTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: { content, targetLanguage, contentType },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Translation Error",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      const translated = data.translatedContent;
      setTranslatedContent(prev => new Map(prev).set(id, translated));
      
      toast({
        title: "Translation Complete",
        description: `Content translated to ${targetLanguage}`,
      });

      return translated;
    } catch (err) {
      console.error('[useTranslation] Error:', err);
      toast({
        title: "Translation Failed",
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTranslating(false);
      setPendingTranslation(null);
    }
  }, [targetLanguage]);

  const requestTranslation = useCallback((id: string, content: string, contentType: string) => {
    setPendingTranslation({ id, content, contentType });
  }, []);

  const cancelTranslation = useCallback(() => {
    setPendingTranslation(null);
  }, []);

  const confirmTranslation = useCallback(async () => {
    if (!pendingTranslation) return null;
    return translateContent(
      pendingTranslation.id,
      pendingTranslation.content,
      pendingTranslation.contentType as any
    );
  }, [pendingTranslation, translateContent]);

  const getTranslatedContent = useCallback((id: string): string | undefined => {
    return translatedContent.get(id);
  }, [translatedContent]);

  const hasTranslation = useCallback((id: string): boolean => {
    return translatedContent.has(id);
  }, [translatedContent]);

  return {
    isTranslating,
    pendingTranslation,
    requestTranslation,
    cancelTranslation,
    confirmTranslation,
    getTranslatedContent,
    hasTranslation,
    translateContent,
  };
}
