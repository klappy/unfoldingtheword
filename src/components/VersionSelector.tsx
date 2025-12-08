import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, GripVertical, Globe } from 'lucide-react';
import { ScriptureVersion, OrganizationOption } from '@/hooks/useLanguage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VersionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  versionPreferences: ScriptureVersion[];
  onVersionSelect: (version: ScriptureVersion) => void;
  onReorder: (versions: ScriptureVersion[]) => void;
  getOrganizationsForLanguage: (langId: string) => Promise<OrganizationOption[]>;
  currentLanguage: string;
}

export function VersionSelector({
  isOpen,
  onClose,
  versionPreferences,
  onVersionSelect,
  onReorder,
  getOrganizationsForLanguage,
  currentLanguage,
}: VersionSelectorProps) {
  const [availableVersions, setAvailableVersions] = useState<ScriptureVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fetch available versions when opened
  useEffect(() => {
    if (!isOpen) return;

    const loadVersions = async () => {
      setIsLoadingVersions(true);
      try {
        // Fetch orgs for current language
        const orgs = await getOrganizationsForLanguage(currentLanguage);
        const versions: ScriptureVersion[] = orgs.map(org => ({
          language: currentLanguage,
          organization: org.id,
          displayName: `${org.name} (${currentLanguage.toUpperCase()})`,
          isFallback: false,
        }));

        // Always add English fallback versions if not English
        if (currentLanguage !== 'en') {
          const enOrgs = await getOrganizationsForLanguage('en');
          enOrgs.forEach(org => {
            versions.push({
              language: 'en',
              organization: org.id,
              displayName: `${org.name} (EN)`,
              isFallback: true,
            });
          });
        }

        setAvailableVersions(versions);
      } catch (error) {
        console.error('[VersionSelector] Failed to load versions:', error);
      } finally {
        setIsLoadingVersions(false);
      }
    };

    loadVersions();
  }, [isOpen, currentLanguage, getOrganizationsForLanguage]);

  const handleVersionClick = (version: ScriptureVersion) => {
    onVersionSelect(version);
    onClose();
  };

  const isVersionActive = (version: ScriptureVersion) => {
    return versionPreferences[0]?.language === version.language && 
           versionPreferences[0]?.organization === version.organization;
  };

  const isVersionInPreferences = (version: ScriptureVersion) => {
    return versionPreferences.some(
      v => v.language === version.language && v.organization === version.organization
    );
  };

  // Group versions by language
  const primaryVersions = availableVersions.filter(v => !v.isFallback);
  const fallbackVersions = availableVersions.filter(v => v.isFallback);

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
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl max-h-[70vh]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4">
              <h2 className="text-lg font-semibold text-foreground">Scripture Version</h2>
              <p className="text-sm text-muted-foreground">
                Select your preferred translation
              </p>
            </div>

            <ScrollArea className="max-h-[50vh] px-6 pb-6">
              {isLoadingVersions ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading versions...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Primary language versions */}
                  {primaryVersions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {currentLanguage.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {primaryVersions.map((version) => (
                          <button
                            key={`${version.language}-${version.organization}`}
                            onClick={() => handleVersionClick(version)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all',
                              'hover:bg-primary/10 active:scale-[0.98]',
                              isVersionActive(version) && 'bg-primary/10 ring-1 ring-primary/30'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">
                                {version.organization}
                              </span>
                            </div>
                            {isVersionActive(version) && (
                              <Check className="w-5 h-5 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback (English) versions */}
                  {fallbackVersions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          English (Fallback)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {fallbackVersions.map((version) => (
                          <button
                            key={`${version.language}-${version.organization}`}
                            onClick={() => handleVersionClick(version)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all',
                              'hover:bg-muted/50 active:scale-[0.98]',
                              isVersionActive(version) && 'bg-muted/70 ring-1 ring-border'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-foreground">
                                {version.organization}
                              </span>
                            </div>
                            {isVersionActive(version) && (
                              <Check className="w-5 h-5 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Close button */}
            <div className="px-6 pb-6 pt-2">
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