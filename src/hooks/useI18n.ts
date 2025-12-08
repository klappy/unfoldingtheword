import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTranslations, hasStaticTranslation, TranslationStrings, translations } from '@/i18n/translations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseI18nReturn {
  t: (key: keyof TranslationStrings) => string;
  isLoading: boolean;
  languageCode: string;
  hasStaticTranslations: boolean;
  translateUiStrings: () => Promise<void>;
}

// Cache for AI-translated UI strings
const translationCache = new Map<string, TranslationStrings>();

export function useI18n(languageCode: string): UseI18nReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [aiTranslations, setAiTranslations] = useState<Partial<TranslationStrings> | null>(null);

  const hasStaticTranslations = useMemo(() => hasStaticTranslation(languageCode), [languageCode]);
  
  // Get base translations (static or English fallback)
  const baseTranslations = useMemo(() => getTranslations(languageCode), [languageCode]);

  // Check cache on mount
  useEffect(() => {
    if (!hasStaticTranslations && translationCache.has(languageCode)) {
      setAiTranslations(translationCache.get(languageCode) || null);
    } else {
      setAiTranslations(null);
    }
  }, [languageCode, hasStaticTranslations]);

  // Translation function
  const t = useCallback((key: keyof TranslationStrings): string => {
    // If we have AI translations for this language, use them
    if (aiTranslations && aiTranslations[key]) {
      return aiTranslations[key]!;
    }
    // Otherwise use static translations
    return baseTranslations[key] || translations['en'][key] || key;
  }, [aiTranslations, baseTranslations]);

  // Translate UI strings using AI (for languages without static translations)
  const translateUiStrings = useCallback(async () => {
    if (hasStaticTranslations) return;
    if (translationCache.has(languageCode)) {
      setAiTranslations(translationCache.get(languageCode) || null);
      return;
    }

    setIsLoading(true);

    try {
      // Get English strings to translate
      const englishStrings = translations['en'];
      const keysToTranslate = Object.keys(englishStrings) as Array<keyof TranslationStrings>;
      
      // Build a compact format for translation
      const stringsToTranslate = keysToTranslate.map(key => ({
        key,
        value: englishStrings[key]
      }));

      const { data, error } = await supabase.functions.invoke('translate-ui', {
        body: {
          strings: stringsToTranslate,
          targetLanguage: languageCode,
        },
      });

      if (error) throw error;

      if (data?.translations) {
        const translatedStrings = data.translations as TranslationStrings;
        translationCache.set(languageCode, translatedStrings);
        setAiTranslations(translatedStrings);
        
        toast({
          title: "UI Translated",
          description: `Interface translated to ${languageCode}`,
        });
      }
    } catch (err) {
      console.error('[useI18n] Error translating UI:', err);
      toast({
        title: "Translation Error",
        description: "Could not translate UI strings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [languageCode, hasStaticTranslations]);

  return {
    t,
    isLoading,
    languageCode,
    hasStaticTranslations,
    translateUiStrings,
  };
}
