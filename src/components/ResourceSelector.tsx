import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Globe, BookOpen, AlertCircle } from 'lucide-react';
import { ScriptureResource } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ResourceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  resourcePreferences?: ScriptureResource[];
  onResourceSelect: (resource: ScriptureResource) => void;
  currentLanguage?: string;
  currentReference?: string;
}

// Known scripture resource types
const SCRIPTURE_RESOURCES = [
  { id: 'ult', name: 'UnfoldingWord® Literal Text (ULT)', description: 'Word-for-word translation' },
  { id: 'ust', name: 'UnfoldingWord® Simplified Text (UST)', description: 'Meaning-focused translation' },
  { id: 'ulb', name: 'Unlocked Literal Bible', description: 'Legacy literal translation' },
  { id: 'udb', name: 'Unlocked Dynamic Bible', description: 'Legacy dynamic translation' },
];

interface ResourceAvailability extends ScriptureResource {
  isAvailable: boolean;
}

export function ResourceSelector({
  isOpen,
  onClose,
  resourcePreferences = [],
  onResourceSelect,
  currentLanguage = 'en',
  currentReference,
}: ResourceSelectorProps) {
  const [availableResources, setAvailableResources] = useState<ResourceAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check if a specific resource is available by making a test request
  const checkResourceAvailability = async (
    lang: string, 
    resource: string, 
    book: string
  ): Promise<boolean> => {
    try {
      // Normalize book name to English for API calls (e.g., "Rut" -> "Ruth")
      const normalizedBook = normalizeBookName(book);
      
      const { data } = await supabase.functions.invoke('translation-helps-proxy', {
        body: {
          endpoint: 'fetch-scripture',
          params: {
            reference: `${normalizedBook} 1:1`,
            language: lang,
            owner: 'unfoldingWord',
            resource: resource,
          },
        },
      });
      
      // Check if we got actual scripture content (not an error)
      if (data?.error || data?.originalStatus === 404 || data?.originalStatus === 400 || data?.originalStatus === 500) {
        return false;
      }
      
      // If we got content back, consider it available
      return !!data?.content || !!data?.markdown;
    } catch {
      return false;
    }
  };
  
  // Normalize localized book names to English for API calls
  const normalizeBookName = (book: string): string => {
    const bookAliases: Record<string, string> = {
      // Spanish
      'rut': 'Ruth',
      'génesis': 'Genesis',
      'éxodo': 'Exodus',
      'salmos': 'Psalms',
      'proverbios': 'Proverbs',
      'mateo': 'Matthew',
      'marcos': 'Mark',
      'lucas': 'Luke',
      'juan': 'John',
      'hechos': 'Acts',
      'romanos': 'Romans',
      'apocalipsis': 'Revelation',
      // Portuguese
      'gênesis': 'Genesis',
      'êxodo': 'Exodus',
      'salmo': 'Psalms',
      'provérbios': 'Proverbs',
      'mateus': 'Matthew',
      'joão': 'John',
      'atos': 'Acts',
      // French
      'genèse': 'Genesis',
      'exode': 'Exodus',
      'psaumes': 'Psalms',
      'proverbes': 'Proverbs',
      'matthieu': 'Matthew',
      'marc': 'Mark',
      'luc': 'Luke',
      'jean': 'John',
      'actes': 'Acts',
      'romains': 'Romans',
    };
    
    return bookAliases[book.toLowerCase()] || book;
  };

  // Fetch available scripture resources when opened
  useEffect(() => {
    if (!isOpen) return;

    const loadResources = async () => {
      setIsLoading(true);
      try {
        // Get the book from current reference for availability check
        const book = currentReference?.split(' ')[0] || 'John';
        
        console.log('[ResourceSelector] Checking resources for:', { currentLanguage, book });
        
        // Check availability for each resource in the primary language
        const primaryChecks = SCRIPTURE_RESOURCES.map(async (resource) => {
          const isAvailable = await checkResourceAvailability(currentLanguage, resource.id, book);
          console.log(`[ResourceSelector] ${currentLanguage}/${resource.id}: ${isAvailable ? 'available' : 'not available'}`);
          return {
            language: currentLanguage,
            organization: 'unfoldingWord',
            resource: resource.id,
            displayName: resource.name,
            description: resource.description,
            isFallback: false,
            isAvailable,
          } as ResourceAvailability;
        });
        
        // Check English fallback resources if not English
        const fallbackChecks = currentLanguage !== 'en' 
          ? SCRIPTURE_RESOURCES.map(async (resource) => {
              const isAvailable = await checkResourceAvailability('en', resource.id, book);
              return {
                language: 'en',
                organization: 'unfoldingWord',
                resource: resource.id,
                displayName: `${resource.name} (English)`,
                description: resource.description,
                isFallback: true,
                isAvailable,
              } as ResourceAvailability;
            })
          : [];
        
        const [primaryResults, fallbackResults] = await Promise.all([
          Promise.all(primaryChecks),
          Promise.all(fallbackChecks),
        ]);
        
        // Combine and set - filter to only show available resources
        const allResources = [...primaryResults, ...fallbackResults];
        console.log('[ResourceSelector] Available resources:', allResources.filter(r => r.isAvailable).map(r => `${r.language}/${r.resource}`));
        
        setAvailableResources(allResources);
      } catch (error) {
        console.error('[ResourceSelector] Failed to load resources:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [isOpen, currentLanguage, currentReference]);

  const handleResourceClick = (resource: ScriptureResource) => {
    onResourceSelect(resource);
    onClose();
  };

  const isResourceActive = (resource: ScriptureResource) => {
    const active = resourcePreferences[0];
    return active?.language === resource.language && 
           active?.organization === resource.organization &&
           active?.resource === resource.resource;
  };

  // Group resources by language - only show available resources
  const primaryResources = availableResources.filter(r => !r.isFallback && r.isAvailable);
  const fallbackResources = availableResources.filter(r => r.isFallback && r.isAvailable);
  const unavailablePrimary = availableResources.filter(r => !r.isFallback && !r.isAvailable);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl max-h-[70vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Scripture Resource</h2>
              <p className="text-sm text-muted-foreground">
                Select your preferred translation
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading scripture resources...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Primary language resources */}
                  {primaryResources.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {currentLanguage.toUpperCase()} Resources
                        </span>
                        <span className="text-xs text-primary ml-auto">
                          ({primaryResources.length} available)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {primaryResources.map((resource) => (
                          <button
                            key={`${resource.language}-${resource.resource}`}
                            onClick={() => handleResourceClick(resource)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left',
                              'hover:bg-primary/10 active:scale-[0.98]',
                              isResourceActive(resource) && 'bg-primary/10 ring-1 ring-primary/30'
                            )}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">
                                {resource.displayName}
                              </span>
                              {resource.description && (
                                <span className="text-xs text-muted-foreground">
                                  {resource.description}
                                </span>
                              )}
                            </div>
                            {isResourceActive(resource) && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : unavailablePrimary.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {currentLanguage.toUpperCase()} Resources
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          (none available)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground py-2">
                        No scripture resources found for this language. Using English fallback below.
                      </p>
                    </div>
                  ) : null}

                  {/* Fallback (English) resources */}
                  {fallbackResources.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          English Fallback
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          ({fallbackResources.length} available)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {fallbackResources.map((resource) => (
                          <button
                            key={`${resource.language}-${resource.resource}`}
                            onClick={() => handleResourceClick(resource)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left',
                              'hover:bg-muted/50 active:scale-[0.98]',
                              isResourceActive(resource) && 'bg-muted/70 ring-1 ring-border'
                            )}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground">
                                {resource.displayName}
                              </span>
                              {resource.description && (
                                <span className="text-xs text-muted-foreground">
                                  {resource.description}
                                </span>
                              )}
                            </div>
                            {isResourceActive(resource) && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="px-6 pb-6 pt-2 flex-shrink-0 border-t border-border/50">
              <Button
                variant="outline"
                className="w-full"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
