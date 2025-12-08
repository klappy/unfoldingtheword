import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LANGUAGE_KEY = 'bible-study-language';
const ORGANIZATION_KEY = 'bible-study-organization';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName?: string;
  direction?: 'ltr' | 'rtl';
}

export interface OrganizationOption {
  id: string;
  name: string;
  description?: string;
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

// Common organizations that provide Bible resources
const AVAILABLE_ORGANIZATIONS: OrganizationOption[] = [
  { id: 'unfoldingWord', name: 'unfoldingWord', description: 'Open-licensed Bible resources' },
  { id: 'Door43-Catalog', name: 'Door43 Catalog', description: 'Community translations' },
];

export function useLanguage() {
  const [language, setLanguageState] = useState<string | null>(null);
  const [organization, setOrganizationState] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  // Fetch available languages from API
  const fetchLanguages = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
        body: { endpoint: 'catalog-languages', params: {} },
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
          id: lang.id || lang.code || lang.languageId || lang.lc,
          name: lang.name || lang.englishName || lang.ln || lang.id,
          nativeName: lang.nativeName || lang.localName || lang.ln || lang.name,
          direction: lang.direction || lang.ld || 'ltr',
        }));
      } else if (data?.languages) {
        languages = data.languages.map((lang: any) => ({
          id: lang.id || lang.code || lang.languageId || lang.lc,
          name: lang.name || lang.englishName || lang.ln || lang.id,
          nativeName: lang.nativeName || lang.localName || lang.ln || lang.name,
          direction: lang.direction || lang.ld || 'ltr',
        }));
      } else if (data?.content) {
        // Might be markdown/text - use fallback
        console.warn('[useLanguage] Got text response instead of JSON, using fallback');
        setAvailableLanguages(FALLBACK_LANGUAGES);
        return;
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

  // Initialize language and organization from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    const savedOrganization = localStorage.getItem(ORGANIZATION_KEY);
    
    if (savedLanguage && savedOrganization) {
      setLanguageState(savedLanguage);
      setOrganizationState(savedOrganization);
      setNeedsSelection(false);
    } else {
      setNeedsSelection(true);
    }
    
    fetchLanguages().finally(() => setIsLoading(false));
  }, [fetchLanguages]);

  const setLanguage = useCallback((langId: string) => {
    localStorage.setItem(LANGUAGE_KEY, langId);
    setLanguageState(langId);
  }, []);

  const setOrganization = useCallback((orgId: string) => {
    localStorage.setItem(ORGANIZATION_KEY, orgId);
    setOrganizationState(orgId);
  }, []);

  const completeSelection = useCallback((langId: string, orgId: string) => {
    setLanguage(langId);
    setOrganization(orgId);
    setNeedsSelection(false);
  }, [setLanguage, setOrganization]);

  const getCurrentLanguage = useCallback((): LanguageOption | null => {
    if (!language) return null;
    return availableLanguages.find(l => l.id === language) || { 
      id: language, 
      name: language,
      direction: 'ltr' 
    };
  }, [language, availableLanguages]);

  const getCurrentOrganization = useCallback((): OrganizationOption | null => {
    if (!organization) return null;
    return AVAILABLE_ORGANIZATIONS.find(o => o.id === organization) || {
      id: organization,
      name: organization,
    };
  }, [organization]);

  return {
    language,
    organization,
    setLanguage,
    setOrganization,
    completeSelection,
    availableLanguages,
    availableOrganizations: AVAILABLE_ORGANIZATIONS,
    isLoading,
    needsSelection,
    getCurrentLanguage,
    getCurrentOrganization,
  };
}
