import { motion, AnimatePresence } from 'framer-motion';
import { Languages, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TranslationDialogProps {
  isOpen: boolean;
  isTranslating: boolean;
  contentType: string;
  targetLanguage: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TranslationDialog({
  isOpen,
  isTranslating,
  contentType,
  targetLanguage,
  onConfirm,
  onCancel,
}: TranslationDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-lg max-w-sm w-full p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Languages className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Translate Content?
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              disabled={isTranslating}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            This {contentType} is only available in English. Would you like to use AI to translate it to{' '}
            <span className="font-medium text-foreground">{targetLanguage}</span>?
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isTranslating}
              className="flex-1"
            >
              Keep English
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isTranslating}
              className="flex-1"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Languages className="w-4 h-4 mr-2" />
                  Translate
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            AI translations may not be perfectly accurate. Use for reference only.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
