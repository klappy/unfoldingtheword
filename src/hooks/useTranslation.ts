import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TranslationItem {
  id: string;
  content: string;
  contentType: 'scripture' | 'note' | 'question' | 'word' | 'article';
}

export interface TranslationState {
  isTranslating: boolean;
  translatedContent: Map<string, string>;
  pendingTranslation: TranslationItem | null;
  pendingBatch: TranslationItem[] | null;
}

export function useTranslation(targetLanguage: string) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<Map<string, string>>(new Map());
  const [pendingTranslation, setPendingTranslation] = useState<TranslationItem | null>(null);
  const [pendingBatch, setPendingBatch] = useState<TranslationItem[] | null>(null);

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

  const translateBatch = useCallback(async (items: TranslationItem[]) => {
    if (items.length === 0) return {};
    
    setIsTranslating(true);

    try {
      console.log(`[useTranslation] Batch translating ${items.length} items`);
      
      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: { 
          items: items.map(item => ({
            id: item.id,
            content: item.content,
            contentType: item.contentType,
          })),
          targetLanguage 
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Translation Error",
          description: data.error,
          variant: "destructive",
        });
        return {};
      }

      const translations = data.translations as Record<string, string>;
      
      // Update state with all translations
      setTranslatedContent(prev => {
        const newMap = new Map(prev);
        Object.entries(translations).forEach(([id, content]) => {
          newMap.set(id, content);
        });
        return newMap;
      });
      
      toast({
        title: "Translation Complete",
        description: `${Object.keys(translations).length} items translated to ${targetLanguage}`,
      });

      return translations;
    } catch (err) {
      console.error('[useTranslation] Batch error:', err);
      toast({
        title: "Translation Failed",
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      });
      return {};
    } finally {
      setIsTranslating(false);
      setPendingBatch(null);
    }
  }, [targetLanguage]);

  const requestTranslation = useCallback((id: string, content: string, contentType: string) => {
    setPendingTranslation({ id, content, contentType: contentType as TranslationItem['contentType'] });
  }, []);

  const requestBatchTranslation = useCallback((items: TranslationItem[]) => {
    setPendingBatch(items);
  }, []);

  const cancelTranslation = useCallback(() => {
    setPendingTranslation(null);
    setPendingBatch(null);
  }, []);

  const confirmTranslation = useCallback(async () => {
    if (pendingBatch && pendingBatch.length > 0) {
      return translateBatch(pendingBatch);
    }
    if (!pendingTranslation) return null;
    return translateContent(
      pendingTranslation.id,
      pendingTranslation.content,
      pendingTranslation.contentType
    );
  }, [pendingTranslation, pendingBatch, translateContent, translateBatch]);

  const getTranslatedContent = useCallback((id: string): string | undefined => {
    return translatedContent.get(id);
  }, [translatedContent]);

  const hasTranslation = useCallback((id: string): boolean => {
    return translatedContent.has(id);
  }, [translatedContent]);

  const clearTranslations = useCallback(() => {
    setTranslatedContent(new Map());
  }, []);

  return {
    isTranslating,
    pendingTranslation,
    pendingBatch,
    requestTranslation,
    requestBatchTranslation,
    cancelTranslation,
    confirmTranslation,
    getTranslatedContent,
    hasTranslation,
    translateContent,
    translateBatch,
    clearTranslations,
  };
}
