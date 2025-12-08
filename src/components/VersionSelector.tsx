import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Globe, BookOpen } from 'lucide-react';
import { ScriptureVersion } from '@/hooks/useLanguage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface VersionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  versionPreferences: ScriptureVersion[];
  onVersionSelect: (version: ScriptureVersion) => void;
  currentLanguage: string;
  currentReference?: string;
}

// Known scripture resource types
const SCRIPTURE_RESOURCES = [
  { id: 'ult', name: 'Literal Text (ULT)', description: 'Word-for-word translation' },
  { id: 'ust', name: 'Simplified Text (UST)', description: 'Meaning-focused translation' },
  { id: 'ulb', name: 'Unlocked Literal Bible', description: 'Legacy literal translation' },
  { id: 'udb', name: 'Unlocked Dynamic Bible', description: 'Legacy dynamic translation' },
];

export function VersionSelector({
  isOpen,
  onClose,
  versionPreferences,
  onVersionSelect,
  currentLanguage,
  currentReference,
}: VersionSelectorProps) {
  const [availableResources, setAvailableResources] = useState<ScriptureVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available scripture resources when opened
  useEffect(() => {
    if (!isOpen) return;

    const loadResources = async () => {
      setIsLoading(true);
      try {
        // Get the book from current reference for availability check
        const book = currentReference?.split(' ')[0] || 'John';
        
        // Check which resources are available for current language
        const availableForLanguage: ScriptureVersion[] = [];
        
        for (const resource of SCRIPTURE_RESOURCES) {
          // Try to verify if this resource exists for the language
          availableForLanguage.push({
            language: currentLanguage,
            organization: 'unfoldingWord',
            resource: resource.id,
            displayName: resource.name,
            description: resource.description,
            isFallback: false,
          });
        }
        
        // Always add English fallback resources if not English
        if (currentLanguage !== 'en') {
          for (const resource of SCRIPTURE_RESOURCES) {
            availableForLanguage.push({
              language: 'en',
              organization: 'unfoldingWord',
              resource: resource.id,
              displayName: `${resource.name} (English)`,
              description: resource.description,
              isFallback: true,
            });
          }
        }
        
        setAvailableResources(availableForLanguage);
      } catch (error) {
        console.error('[VersionSelector] Failed to load resources:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [isOpen, currentLanguage, currentReference]);

  const handleVersionClick = (version: ScriptureVersion) => {
    onVersionSelect(version);
    onClose();
  };

  const isVersionActive = (version: ScriptureVersion) => {
    const active = versionPreferences[0];
    return active?.language === version.language && 
           active?.organization === version.organization &&
           active?.resource === version.resource;
  };

  // Group versions by language
  const primaryResources = availableResources.filter(v => !v.isFallback);
  const fallbackResources = availableResources.filter(v => v.isFallback);

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
              <h2 className="text-lg font-semibold text-foreground">Scripture Version</h2>
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
                  {primaryResources.length > 0 && (
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
                        {primaryResources.map((version) => (
                          <button
                            key={`${version.language}-${version.resource}`}
                            onClick={() => handleVersionClick(version)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left',
                              'hover:bg-primary/10 active:scale-[0.98]',
                              isVersionActive(version) && 'bg-primary/10 ring-1 ring-primary/30'
                            )}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">
                                {version.displayName}
                              </span>
                              {version.description && (
                                <span className="text-xs text-muted-foreground">
                                  {version.description}
                                </span>
                              )}
                            </div>
                            {isVersionActive(version) && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                        {fallbackResources.map((version) => (
                          <button
                            key={`${version.language}-${version.resource}`}
                            onClick={() => handleVersionClick(version)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left',
                              'hover:bg-muted/50 active:scale-[0.98]',
                              isVersionActive(version) && 'bg-muted/70 ring-1 ring-border'
                            )}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground">
                                {version.displayName}
                              </span>
                              {version.description && (
                                <span className="text-xs text-muted-foreground">
                                  {version.description}
                                </span>
                              )}
                            </div>
                            {isVersionActive(version) && (
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