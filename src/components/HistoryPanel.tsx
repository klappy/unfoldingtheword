import { motion, AnimatePresence } from 'framer-motion';
import { History, X, MessageSquare, Book } from 'lucide-react';
import { HistoryItem } from '@/types';

interface HistoryPanelProps {
  isOpen: boolean;
  items: HistoryItem[];
  onClose: () => void;
  onSelectItem: (item: HistoryItem) => void;
}

export function HistoryPanel({ isOpen, items, onClose, onSelectItem }: HistoryPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 top-0 z-50 max-h-[70vh] bg-card border-b border-border 
                     rounded-b-3xl shadow-soft overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2 text-foreground">
                <History className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">History</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* History items */}
            <div className="overflow-y-auto max-h-[calc(70vh-60px)] p-4">
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">
                    Your conversation history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => onSelectItem(item)}
                      className="w-full text-left glass-card rounded-xl p-3 hover:bg-muted/50 
                               transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <MessageSquare className="w-3 h-3 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-foreground truncate">
                            {item.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.preview}
                          </p>
                          {item.scripture && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                              <Book className="w-3 h-3" />
                              <span>{item.scripture}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground/50">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Pull indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
