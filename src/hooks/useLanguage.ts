import { useState, useEffect, useCallback } from 'react';

const LANGUAGE_KEY = 'bible-study-language';
const ORGANIZATION_KEY = 'bible-study-organization';
const VERSION_PREFERENCES_KEY = 'bible-study-version-preferences';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName?: string;
  direction?: 'ltr' | 'rtl';
  isGateway?: boolean;
}

export interface OrganizationOption {
  id: string;
  name: string;
  description?: string;
}

export interface ScriptureVersion {
  language: string;
  organization: string;
  resource?: string; // e.g., 'ult', 'ust', 'ulb', 'udb'
  displayName: string;
  description?: string;
  isFallback?: boolean;
}

// CatalogEntry interface removed - using direct API calls now

// Fallback languages if API fails (all gateway languages)
const FALLBACK_LANGUAGES: LanguageOption[] = [
  { id: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isGateway: true },
  { id: 'es-419', name: 'Spanish (Latin America)', nativeName: 'Español', direction: 'ltr', isGateway: true },
  { id: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', isGateway: true },
  { id: 'pt-br', name: 'Portuguese (Brazil)', nativeName: 'Português', direction: 'ltr', isGateway: true },
  { id: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', isGateway: true },
  { id: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', isGateway: true },
];

const FALLBACK_ORGANIZATIONS: OrganizationOption[] = [
  { id: 'unfoldingWord', name: 'unfoldingWord', description: 'Open-licensed Bible resources' },
  { id: 'Door43-Catalog', name: 'Door43 Catalog', description: 'Community translations' },
];

export function useLanguage() {
  const [language, setLanguageState] = useState<string | null>(null);
  const [organization, setOrganizationState] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationOption[]>([]);
  const [versionPreferences, setVersionPreferencesState] = useState<ScriptureVersion[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  // Fetch languages from Door43 API
  const fetchLanguages = useCallback(async () => {
    try {
      console.log('[useLanguage] Fetching languages from Door43 catalog API...');
      const response = await fetch('https://git.door43.org/api/v1/catalog/list/languages');
      
      if (!response.ok) {
        console.error('[useLanguage] Failed to fetch languages:', response.status);
        setAvailableLanguages(FALLBACK_LANGUAGES);
        return;
      }

      const data = await response.json();
      console.log('[useLanguage] Languages response:', data);

      if (data.data && Array.isArray(data.data)) {
        const allLanguages: LanguageOption[] = data.data.map((lang: { lc: string; ln: string; ang: string; ld: string; gw: boolean }) => ({
          id: lang.lc,
          name: lang.ang || lang.ln, // English name or native name
          nativeName: lang.ln,
          direction: lang.ld === 'rtl' ? 'rtl' : 'ltr',
          isGateway: lang.gw === true,
        }));

        // Filter to only gateway languages
        const gatewayLanguages = allLanguages.filter(lang => lang.isGateway);
        
        // Sort: English first, es-419 second, then alphabetically
        gatewayLanguages.sort((a, b) => {
          if (a.id === 'en') return -1;
          if (b.id === 'en') return 1;
          if (a.id === 'es-419') return -1;
          if (b.id === 'es-419') return 1;
          return a.name.localeCompare(b.name);
        });

        console.log(`[useLanguage] Loaded ${gatewayLanguages.length} gateway languages (filtered from ${allLanguages.length} total)`);
        setAvailableLanguages(gatewayLanguages);
      } else {
        console.warn('[useLanguage] Unexpected languages response format');
        setAvailableLanguages(FALLBACK_LANGUAGES);
      }
    } catch (error) {
      console.error('[useLanguage] Failed to fetch languages:', error);
      setAvailableLanguages(FALLBACK_LANGUAGES);
    }
  }, []);

  // Fetch owners for a specific language from Door43 API
  const fetchOwnersForLanguage = useCallback(async (langId: string) => {
    try {
      console.log(`[useLanguage] Fetching owners for language: ${langId}`);
      const response = await fetch(`https://git.door43.org/api/v1/catalog/list/owners?lang=${langId}`);
      
      if (!response.ok) {
        console.error('[useLanguage] Failed to fetch owners:', response.status);
        return FALLBACK_ORGANIZATIONS;
      }

      const data = await response.json();
      console.log('[useLanguage] Owners response:', data);

      if (data.data && Array.isArray(data.data)) {
        const orgs: OrganizationOption[] = data.data.map((owner: { username: string; full_name: string }) => ({
          id: owner.username,
          name: owner.full_name || owner.username,
          description: owner.username === 'unfoldingWord' ? 'Open-licensed Bible resources' : 'Community translations',
        }));

        // Sort: unfoldingWord first
        orgs.sort((a, b) => {
          if (a.id === 'unfoldingWord') return -1;
          if (b.id === 'unfoldingWord') return 1;
          return a.name.localeCompare(b.name);
        });

        console.log(`[useLanguage] Loaded ${orgs.length} owners for ${langId}`);
        return orgs;
      }
      return FALLBACK_ORGANIZATIONS;
    } catch (error) {
      console.error('[useLanguage] Failed to fetch owners:', error);
      return FALLBACK_ORGANIZATIONS;
    }
  }, []);

  // Get organizations available for a specific language (async fetch)
  const getOrganizationsForLanguage = useCallback(async (langId: string): Promise<OrganizationOption[]> => {
    return fetchOwnersForLanguage(langId);
  }, [fetchOwnersForLanguage]);

  // Initialize language, organization, and version preferences from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    const savedOrganization = localStorage.getItem(ORGANIZATION_KEY);
    const savedPreferences = localStorage.getItem(VERSION_PREFERENCES_KEY);
    
    if (savedLanguage && savedOrganization) {
      setLanguageState(savedLanguage);
      setOrganizationState(savedOrganization);
      setNeedsSelection(false);
      
      // Load version preferences or initialize with defaults
      if (savedPreferences) {
        try {
          setVersionPreferencesState(JSON.parse(savedPreferences));
        } catch {
          // Initialize with primary + English fallback
          const defaultPrefs = buildDefaultVersionPreferences(savedLanguage, savedOrganization);
          setVersionPreferencesState(defaultPrefs);
        }
      } else {
        const defaultPrefs = buildDefaultVersionPreferences(savedLanguage, savedOrganization);
        setVersionPreferencesState(defaultPrefs);
      }
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
    
    // Initialize version preferences with primary + English fallback
    const defaultPrefs = buildDefaultVersionPreferences(langId, orgId);
    setVersionPreferencesState(defaultPrefs);
    localStorage.setItem(VERSION_PREFERENCES_KEY, JSON.stringify(defaultPrefs));
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
    return availableOrganizations.find(o => o.id === organization) || {
      id: organization,
      name: organization,
    };
  }, [organization, availableOrganizations]);

  // Set version preferences (ordered list)
  const setVersionPreferences = useCallback((versions: ScriptureVersion[]) => {
    setVersionPreferencesState(versions);
    localStorage.setItem(VERSION_PREFERENCES_KEY, JSON.stringify(versions));
  }, []);

  // Get the active (first) version preference
  const getActiveVersion = useCallback((): ScriptureVersion | null => {
    return versionPreferences.length > 0 ? versionPreferences[0] : null;
  }, [versionPreferences]);

  // Reorder version preferences (move to top)
  const setActiveVersion = useCallback((version: ScriptureVersion) => {
    // Filter out matching version (by language, org, AND resource)
    const filtered = versionPreferences.filter(
      v => !(v.language === version.language && 
             v.organization === version.organization && 
             v.resource === version.resource)
    );
    const newPrefs = [version, ...filtered];
    setVersionPreferences(newPrefs);
  }, [versionPreferences, setVersionPreferences]);

  return {
    language,
    organization,
    setLanguage,
    setOrganization,
    completeSelection,
    availableLanguages,
    availableOrganizations,
    getOrganizationsForLanguage,
    isLoading,
    needsSelection,
    getCurrentLanguage,
    getCurrentOrganization,
    versionPreferences,
    setVersionPreferences,
    getActiveVersion,
    setActiveVersion,
  };
}

// Helper to build default version preferences
function buildDefaultVersionPreferences(langId: string, orgId: string): ScriptureVersion[] {
  const prefs: ScriptureVersion[] = [];
  
  // Primary selection
  prefs.push({
    language: langId,
    organization: orgId,
    displayName: `${orgId} (${langId.toUpperCase()})`,
    isFallback: false,
  });
  
  // Add English/unfoldingWord fallback if not already English
  if (langId !== 'en') {
    prefs.push({
      language: 'en',
      organization: 'unfoldingWord',
      displayName: 'unfoldingWord (EN)',
      isFallback: true,
    });
  }
  
  return prefs;
}