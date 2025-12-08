import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LANGUAGE_KEY = 'bible-study-language';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName?: string;
  direction?: 'ltr' | 'rtl';
}

// Fallback languages if API fails
const FALLBACK_LANGUAGES: LanguageOption[] = [
  { id: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { id: 'es-419', name: 'Spanish (Latin America)', nativeName: 'Español', direction: 'ltr' },
  { id: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
  { id: 'pt-br', name: 'Portuguese (Brazil)', nativeName: 'Português', direction: 'ltr' },
  { id: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
  { id: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
];

export function useLanguage() {
  const [language, setLanguageState] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  // Fetch available languages from API
  const fetchLanguages = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
        body: { endpoint: 'simple-languages', params: {} },
      });

      if (error) {
        console.error('[useLanguage] Error fetching languages:', error);
        setAvailableLanguages(FALLBACK_LANGUAGES);
        return;
      }

      // Parse the response - it may be an array or have a content property
      let languages: LanguageOption[] = [];
      
      if (Array.isArray(data)) {
        languages = data.map((lang: any) => ({
          id: lang.id || lang.code || lang.languageId,
          name: lang.name || lang.englishName || lang.id,
          nativeName: lang.nativeName || lang.localName || lang.name,
          direction: lang.direction || 'ltr',
        }));
      } else if (data?.languages) {
        languages = data.languages.map((lang: any) => ({
          id: lang.id || lang.code || lang.languageId,
          name: lang.name || lang.englishName || lang.id,
          nativeName: lang.nativeName || lang.localName || lang.name,
          direction: lang.direction || 'ltr',
        }));
      }

      if (languages.length > 0) {
        // Sort by name, but put English first
        languages.sort((a, b) => {
          if (a.id === 'en') return -1;
          if (b.id === 'en') return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableLanguages(languages);
      } else {
        console.warn('[useLanguage] No languages in response, using fallback');
        setAvailableLanguages(FALLBACK_LANGUAGES);
      }
    } catch (error) {
      console.error('[useLanguage] Failed to fetch languages:', error);
      setAvailableLanguages(FALLBACK_LANGUAGES);
    }
  }, []);

  // Initialize language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage) {
      setLanguageState(savedLanguage);
      setNeedsSelection(false);
    } else {
      setNeedsSelection(true);
    }
    
    fetchLanguages().finally(() => setIsLoading(false));
  }, [fetchLanguages]);

  const setLanguage = useCallback((langId: string) => {
    localStorage.setItem(LANGUAGE_KEY, langId);
    setLanguageState(langId);
    setNeedsSelection(false);
  }, []);

  const getCurrentLanguage = useCallback((): LanguageOption | null => {
    if (!language) return null;
    return availableLanguages.find(l => l.id === language) || { 
      id: language, 
      name: language,
      direction: 'ltr' 
    };
  }, [language, availableLanguages]);

  return {
    language,
    setLanguage,
    availableLanguages,
    isLoading,
    needsSelection,
    getCurrentLanguage,
  };
}
