import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, Loader2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LanguageOption, OrganizationOption } from '@/hooks/useLanguage';
import { useResetSession } from '@/hooks/useResetSession';
import { cn } from '@/lib/utils';

interface LanguageSelectionChatProps {
  languages: LanguageOption[];
  getOrganizationsForLanguage: (langId: string) => Promise<OrganizationOption[]>;
  isLoading: boolean;
  onComplete: (languageId: string, organizationId: string) => void;
}

type Step = 'language' | 'organization' | 'complete';

// Top gateway languages to show as quick options
const TOP_LANGUAGES = ['en', 'es-419', 'fr', 'pt-br', 'hi', 'ar', 'id', 'bn'];

// Engaging greetings and action phrases in each language
const LANGUAGE_PHRASES: Record<string, { greeting: string; action: string }> = {
  'en': { greeting: 'Welcome!', action: 'Start' },
  'es-419': { greeting: '¡Bienvenido!', action: 'Comenzar' },
  'fr': { greeting: 'Bienvenue!', action: 'Commencer' },
  'pt-br': { greeting: 'Bem-vindo!', action: 'Iniciar' },
  'hi': { greeting: 'स्वागत है!', action: 'शुरू करें' },
  'ar': { greeting: 'أهلاً!', action: 'ابدأ' },
  'id': { greeting: 'Selamat datang!', action: 'Mulai' },
  'bn': { greeting: 'স্বাগতম!', action: 'শুরু করুন' },
};

export function LanguageSelectionChat({
  languages,
  getOrganizationsForLanguage,
  isLoading,
  onComplete,
}: LanguageSelectionChatProps) {
  const [step, setStep] = useState<Step>('language');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { resetSession } = useResetSession();

  // Handle reset command
  const handleReset = async () => {
    setIsResetting(true);
    await resetSession();
    // Page will reload after reset
  };

  // Filter to top languages for quick selection
  const topLanguages = useMemo(() => {
    return TOP_LANGUAGES
      .map(id => languages.find(l => l.id === id))
      .filter(Boolean) as LanguageOption[];
  }, [languages]);

  // Search results when typing
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return languages.filter(
      lang =>
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName?.toLowerCase().includes(query) ||
        lang.id.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [languages, searchQuery]);

  // Handle language selection
  const handleLanguageSelect = async (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    setShowSearch(false);
    setSearchQuery('');
    setIsLoadingOrgs(true);

    try {
      const orgs = await getOrganizationsForLanguage(lang.id);
      setOrganizations(orgs);

      // If only one org (or unfoldingWord is the only real option), auto-select
      if (orgs.length === 1) {
        onComplete(lang.id, orgs[0].id);
        setStep('complete');
      } else if (orgs.length > 0) {
        // Check if unfoldingWord exists - auto-select it
        const uw = orgs.find(o => o.id === 'unfoldingWord');
        if (uw && orgs.length <= 3) {
          onComplete(lang.id, uw.id);
          setStep('complete');
        } else {
          setStep('organization');
        }
      } else {
        // No orgs, use default
        onComplete(lang.id, 'unfoldingWord');
        setStep('complete');
      }
    } catch (error) {
      console.error('[LanguageSelectionChat] Failed to fetch orgs:', error);
      onComplete(lang.id, 'unfoldingWord');
      setStep('complete');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  // Handle organization selection
  const handleOrgSelect = (org: OrganizationOption) => {
    if (selectedLanguage) {
      onComplete(selectedLanguage.id, org.id);
      setStep('complete');
    }
  };

  return (
    <div className="flex flex-col h-full pt-8 px-4">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        {/* Welcome message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="glass-card rounded-2xl px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  Welcome! I'm your Bible study assistant. Let's start by choosing your preferred language for resources.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'language' && (
            <motion.div
              key="language-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Quick language buttons */}
              {!showSearch && (
                <>
                  <p className="text-xs text-muted-foreground text-center">
                    Select a language
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 w-20 rounded-full bg-muted animate-pulse" />
                      ))
                    ) : (
                      topLanguages.map((lang, i) => {
                        const phrases = LANGUAGE_PHRASES[lang.id];
                        return (
                          <motion.button
                            key={lang.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => handleLanguageSelect(lang)}
                            disabled={isLoadingOrgs}
                            className={cn(
                              'px-5 py-3 rounded-2xl transition-all flex flex-col items-center gap-0.5',
                              'bg-card border border-border hover:bg-primary/10 hover:border-primary/30',
                              'active:scale-95 disabled:opacity-50',
                              lang.direction === 'rtl' && 'font-arabic'
                            )}
                          >
                            {phrases ? (
                              <>
                                <span className="text-xs text-muted-foreground leading-tight">
                                  {phrases.greeting}
                                </span>
                                <span className="text-sm font-semibold leading-tight">
                                  {phrases.action}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-medium">
                                {lang.nativeName || lang.name}
                              </span>
                            )}
                          </motion.button>
                        );
                      })
                    )}
                  </div>

                  {/* Show more / search toggle */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => setShowSearch(true)}
                    className="mx-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search for more languages</span>
                  </motion.button>
                </>
              )}

              {/* Search input */}
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      type="text"
                      placeholder="Type a language name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-card border-border"
                    />
                  </div>

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                      {searchResults.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => handleLanguageSelect(lang)}
                          disabled={isLoadingOrgs}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-3 rounded-lg',
                            'bg-card/50 hover:bg-primary/10 transition-all',
                            'disabled:opacity-50',
                            lang.direction === 'rtl' && 'flex-row-reverse text-right'
                          )}
                        >
                          <div className={cn('flex flex-col', lang.direction === 'rtl' && 'items-end')}>
                            <span className="font-medium text-foreground text-sm">
                              {lang.nativeName || lang.name}
                            </span>
                            {lang.nativeName && lang.nativeName !== lang.name && (
                              <span className="text-xs text-muted-foreground">{lang.name}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery && searchResults.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No languages found for "{searchQuery}"
                    </p>
                  )}

                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="mx-auto block text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Back to quick selection
                  </button>
                </motion.div>
              )}

              {/* Loading indicator when fetching orgs */}
              {isLoadingOrgs && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-muted-foreground"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Setting up {selectedLanguage?.name}...</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'organization' && (
            <motion.div
              key="organization-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* AI message about org selection */}
              <div className="glass-card rounded-2xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground leading-relaxed">
                      Great choice! There are multiple resource providers for{' '}
                      <strong className="text-primary">{selectedLanguage?.name}</strong>.
                      Which would you prefer?
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization options */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {organizations.map((org, i) => (
                  <motion.button
                    key={org.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => handleOrgSelect(org)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl',
                      'bg-card border border-border hover:bg-primary/10 hover:border-primary/30',
                      'transition-all active:scale-[0.98]'
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-foreground text-sm">{org.name}</span>
                      {org.description && (
                        <span className="text-xs text-muted-foreground">{org.description}</span>
                      )}
                    </div>
                    {org.id === 'unfoldingWord' && (
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset option at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-auto pt-8 pb-4"
        >
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="mx-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset all data</span>
            </button>
          ) : (
            <div className="glass-card rounded-xl px-4 py-3 space-y-3">
              <p className="text-sm text-foreground text-center">
                This will delete all your conversations, notes, and preferences. Are you sure?
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isResetting && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isResetting ? 'Resetting...' : 'Yes, reset everything'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
