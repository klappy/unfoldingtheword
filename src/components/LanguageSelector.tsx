import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Check, Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageOption, OrganizationOption } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  languages: LanguageOption[];
  organizations: OrganizationOption[];
  getOrganizationsForLanguage: (langId: string) => Promise<OrganizationOption[]>;
  isLoading: boolean;
  onSelect: (languageId: string, organizationId: string) => void;
  selectedLanguage?: string | null;
  selectedOrganization?: string | null;
}

type Step = 'language' | 'organization';

export function LanguageSelector({ 
  languages, 
  organizations,
  getOrganizationsForLanguage,
  isLoading, 
  onSelect, 
  selectedLanguage,
  selectedOrganization 
}: LanguageSelectorProps) {
  const [step, setStep] = useState<Step>('language');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tempLanguage, setTempLanguage] = useState<string | null>(selectedLanguage || null);
  const [tempOrganization, setTempOrganization] = useState<string | null>(selectedOrganization || null);
  const [availableOrgsForLanguage, setAvailableOrgsForLanguage] = useState<OrganizationOption[]>(organizations);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Fetch organizations when language changes and we're on organization step
  useEffect(() => {
    if (step === 'organization' && tempLanguage) {
      setIsLoadingOrgs(true);
      getOrganizationsForLanguage(tempLanguage)
        .then((orgs) => {
          setAvailableOrgsForLanguage(orgs);
          // Auto-select if only one, or default to first
          if (orgs.length === 1) {
            setTempOrganization(orgs[0].id);
          } else if (!tempOrganization && orgs.length > 0) {
            setTempOrganization(orgs[0].id);
          }
        })
        .finally(() => setIsLoadingOrgs(false));
    }
  }, [step, tempLanguage, getOrganizationsForLanguage]);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return languages;
    const query = searchQuery.toLowerCase();
    return languages.filter(
      lang => 
        lang.name.toLowerCase().includes(query) || 
        lang.nativeName?.toLowerCase().includes(query) ||
        lang.id.toLowerCase().includes(query)
    );
  }, [languages, searchQuery]);

  const handleLanguageSelect = (langId: string) => {
    setTempLanguage(langId);
  };

  const handleOrganizationSelect = (orgId: string) => {
    setTempOrganization(orgId);
  };

  const handleContinue = () => {
    if (step === 'language' && tempLanguage) {
      setStep('organization');
      setSearchQuery('');
    } else if (step === 'organization' && tempLanguage && tempOrganization) {
      onSelect(tempLanguage, tempOrganization);
    }
  };

  const handleBack = () => {
    if (step === 'organization') {
      setStep('language');
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-lg px-6">
        <AnimatePresence mode="wait">
          {step === 'language' ? (
            <motion.div
              key="language-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Header */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Choose Your Language
                </h1>
                <p className="text-muted-foreground text-sm">
                  Select the language for Bible study resources
                </p>
              </motion.div>

              {/* Search */}
              <motion.div 
                className="relative mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </motion.div>

              {/* Language List */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ScrollArea className="h-[50vh] rounded-lg border border-border bg-card/50">
                  <div className="p-2">
                    {isLoading ? (
                      <div className="space-y-2 p-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="h-14 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : filteredLanguages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No languages found matching "{searchQuery}"
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredLanguages.map((lang, index) => (
                          <motion.button
                            key={lang.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * Math.min(index, 10) }}
                            onClick={() => handleLanguageSelect(lang.id)}
                            onMouseEnter={() => setHoveredId(lang.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all',
                              'hover:bg-primary/10 active:scale-[0.98]',
                              tempLanguage === lang.id && 'bg-primary/10 ring-1 ring-primary/20',
                              lang.direction === 'rtl' && 'flex-row-reverse text-right'
                            )}
                          >
                            <div className={cn(
                              'flex flex-col',
                              lang.direction === 'rtl' && 'items-end'
                            )}>
                              <span className="font-medium text-foreground">
                                {lang.nativeName || lang.name}
                              </span>
                              {lang.nativeName && lang.nativeName !== lang.name && (
                                <span className="text-xs text-muted-foreground">
                                  {lang.name}
                                </span>
                              )}
                            </div>
                            <AnimatePresence>
                              {(tempLanguage === lang.id || hoveredId === lang.id) && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <Check className={cn(
                                    'w-5 h-5',
                                    tempLanguage === lang.id ? 'text-primary' : 'text-muted-foreground/50'
                                  )} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>

              {/* Continue Button */}
              {tempLanguage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-4"
                >
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleContinue}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="organization-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Header */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Choose Resource Source
                </h1>
                <p className="text-muted-foreground text-sm">
                  Select the organization providing Bible resources
                </p>
              </motion.div>

              {/* Organization List */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {isLoadingOrgs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                <div className="space-y-3">
                  {availableOrgsForLanguage.map((org, index) => (
                    <motion.button
                      key={org.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      onClick={() => handleOrganizationSelect(org.id)}
                      onMouseEnter={() => setHoveredId(org.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all border',
                        'hover:bg-primary/5 active:scale-[0.99]',
                        tempOrganization === org.id 
                          ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20' 
                          : 'border-border bg-card/50'
                      )}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-foreground">
                          {org.name}
                        </span>
                        {org.description && (
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {org.description}
                          </span>
                        )}
                      </div>
                      <AnimatePresence>
                        {(tempOrganization === org.id || hoveredId === org.id) && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Check className={cn(
                              'w-5 h-5',
                              tempOrganization === org.id ? 'text-primary' : 'text-muted-foreground/50'
                            )} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  ))}
                </div>
                )}
              </motion.div>

              {/* Navigation Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex gap-3"
              >
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={handleBack}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  size="lg"
                  onClick={handleContinue}
                  disabled={!tempOrganization}
                >
                  Get Started
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}