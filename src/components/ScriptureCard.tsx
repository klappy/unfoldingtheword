import { motion } from 'framer-motion';
import { Book, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScripturePassage } from '@/types';

interface ScriptureCardProps {
  passage: ScripturePassage | null;
  onAddToNotes: (text: string) => void;
}

export function ScriptureCard({ passage, onAddToNotes }: ScriptureCardProps) {
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      // Show add to notes prompt
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  if (!passage) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Book className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Scripture Passage
          </h2>
          <p className="text-muted-foreground text-sm">
            Start a conversation to see relevant scripture here
          </p>
        </div>
        
        {/* Navigation hint */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
          <div className="flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>Chat</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Resources</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-4"
      >
        <div className="flex items-center gap-2 text-primary">
          <Book className="w-4 h-4" />
          <span className="text-sm font-medium">{passage.reference}</span>
        </div>
        <span className="text-xs text-muted-foreground">{passage.translation}</span>
      </motion.div>

      {/* Scripture content */}
      <div 
        className="flex-1 overflow-y-auto px-6 pb-20 fade-edges"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scripture-text text-lg max-w-xl mx-auto"
        >
          {passage.verses.map((verse) => (
            <span key={verse.number} className="inline">
              <sup className="scripture-verse">{verse.number}</sup>
              {verse.text}{' '}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Selection hint */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground/50">
          Select text to add to notes
        </p>
      </div>
    </div>
  );
}
