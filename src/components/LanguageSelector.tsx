import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageOption } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  languages: LanguageOption[];
  isLoading: boolean;
  onSelect: (languageId: string) => void;
  selectedLanguage?: string | null;
}

export function LanguageSelector({ languages, isLoading, onSelect, selectedLanguage }: LanguageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-lg px-6">
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
                      onClick={() => onSelect(lang.id)}
                      onMouseEnter={() => setHoveredId(lang.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all',
                        'hover:bg-primary/10 active:scale-[0.98]',
                        selectedLanguage === lang.id && 'bg-primary/10 ring-1 ring-primary/20',
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
                        {(selectedLanguage === lang.id || hoveredId === lang.id) && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Check className={cn(
                              'w-5 h-5',
                              selectedLanguage === lang.id ? 'text-primary' : 'text-muted-foreground/50'
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
        {selectedLanguage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => onSelect(selectedLanguage)}
            >
              Continue
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
