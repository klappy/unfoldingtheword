import { useState, useEffect, useCallback } from 'react';

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

export interface CatalogEntry {
  languageId: string;
  languageName: string;
  nativeName?: string;
  direction: 'ltr' | 'rtl';
  organizationId: string;
  organizationName: string;
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

const FALLBACK_ORGANIZATIONS: OrganizationOption[] = [
  { id: 'unfoldingWord', name: 'unfoldingWord', description: 'Open-licensed Bible resources' },
  { id: 'Door43-Catalog', name: 'Door43 Catalog', description: 'Community translations' },
];

export function useLanguage() {
  const [language, setLanguageState] = useState<string | null>(null);
  const [organization, setOrganizationState] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationOption[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  // Fetch catalog from Door43 API
  const fetchCatalog = useCallback(async () => {
    try {
      console.log('[useLanguage] Fetching Door43 catalog...');
      const response = await fetch('https://api.door43.org/v3/catalog.json');
      
      if (!response.ok) {
        console.error('[useLanguage] Failed to fetch catalog:', response.status);
        setAvailableLanguages(FALLBACK_LANGUAGES);
        setAvailableOrganizations(FALLBACK_ORGANIZATIONS);
        return;
      }

      const catalog = await response.json();
      const entries: CatalogEntry[] = [];
      const languageMap = new Map<string, LanguageOption>();
      const orgMap = new Map<string, OrganizationOption>();

      // Parse the catalog structure: catalog.languages is an array of language objects
      if (catalog.languages && Array.isArray(catalog.languages)) {
        for (const lang of catalog.languages) {
          const langId = lang.identifier || lang.slug;
          const langName = lang.title || lang.identifier;
          const nativeName = lang.title || langName;
          const direction = lang.direction || 'ltr';

          // Each language has resources, each resource has a checking entity (organization)
          if (lang.resources && Array.isArray(lang.resources)) {
            for (const resource of lang.resources) {
              // Get owner from the resource's repo URL or checking entity
              let owner = 'unfoldingWord';
              
              if (resource.checking_entity && resource.checking_entity.length > 0) {
                owner = resource.checking_entity[0];
              } else if (resource.formats && resource.formats.length > 0) {
                // Try to extract owner from URL
                const url = resource.formats[0]?.url || '';
                const match = url.match(/\/([^\/]+)\/[^\/]+\/releases\//);
                if (match) {
                  owner = match[1];
                }
              }

              // Only include resources that have Bible-related content
              const relevantSubjects = ['Bible', 'Translation Notes', 'Translation Words', 'Translation Academy', 'Translation Questions'];
              if (resource.subject && relevantSubjects.some(s => resource.subject.includes(s))) {
                entries.push({
                  languageId: langId,
                  languageName: langName,
                  nativeName: nativeName,
                  direction: direction as 'ltr' | 'rtl',
                  organizationId: owner,
                  organizationName: owner,
                });

                // Track unique languages and organizations
                if (!languageMap.has(langId)) {
                  languageMap.set(langId, {
                    id: langId,
                    name: langName,
                    nativeName: nativeName,
                    direction: direction as 'ltr' | 'rtl',
                  });
                }

                if (!orgMap.has(owner)) {
                  orgMap.set(owner, {
                    id: owner,
                    name: owner === 'unfoldingWord' ? 'unfoldingWord' : owner,
                    description: owner === 'unfoldingWord' ? 'Open-licensed Bible resources' : 'Community translations',
                  });
                }
              }
            }
          }
        }
      }

      console.log(`[useLanguage] Parsed ${entries.length} catalog entries, ${languageMap.size} languages, ${orgMap.size} organizations`);

      if (languageMap.size > 0) {
        // Sort languages: English first, then alphabetically
        const languages = Array.from(languageMap.values()).sort((a, b) => {
          if (a.id === 'en') return -1;
          if (b.id === 'en') return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableLanguages(languages);
        
        // Sort organizations: unfoldingWord first
        const orgs = Array.from(orgMap.values()).sort((a, b) => {
          if (a.id === 'unfoldingWord') return -1;
          if (b.id === 'unfoldingWord') return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableOrganizations(orgs);
        setCatalogEntries(entries);
      } else {
        console.warn('[useLanguage] No entries found in catalog, using fallback');
        setAvailableLanguages(FALLBACK_LANGUAGES);
        setAvailableOrganizations(FALLBACK_ORGANIZATIONS);
      }
    } catch (error) {
      console.error('[useLanguage] Failed to fetch catalog:', error);
      setAvailableLanguages(FALLBACK_LANGUAGES);
      setAvailableOrganizations(FALLBACK_ORGANIZATIONS);
    }
  }, []);

  // Get organizations available for a specific language
  const getOrganizationsForLanguage = useCallback((langId: string): OrganizationOption[] => {
    const orgsForLang = new Set<string>();
    for (const entry of catalogEntries) {
      if (entry.languageId === langId) {
        orgsForLang.add(entry.organizationId);
      }
    }
    
    if (orgsForLang.size === 0) {
      return availableOrganizations;
    }
    
    return availableOrganizations.filter(org => orgsForLang.has(org.id));
  }, [catalogEntries, availableOrganizations]);

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
    
    fetchCatalog().finally(() => setIsLoading(false));
  }, [fetchCatalog]);

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
    return availableOrganizations.find(o => o.id === organization) || {
      id: organization,
      name: organization,
    };
  }, [organization, availableOrganizations]);

  return {
    language,
    organization,
    setLanguage,
    setOrganization,
    completeSelection,
    availableLanguages,
    availableOrganizations,
    getOrganizationsForLanguage,
    catalogEntries,
    isLoading,
    needsSelection,
    getCurrentLanguage,
    getCurrentOrganization,
  };
}