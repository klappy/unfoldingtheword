import { motion } from 'framer-motion';
import { FileText, HelpCircle, BookOpen, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { Resource } from '@/types';
import { cn } from '@/lib/utils';

interface ResourcesCardProps {
  resources: Resource[];
  onAddToNotes: (text: string) => void;
}

const resourceIcons = {
  'translation-note': FileText,
  'translation-question': HelpCircle,
  'translation-word': BookOpen,
  'academy-article': GraduationCap,
};

const resourceColors = {
  'translation-note': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'translation-question': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'translation-word': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  'academy-article': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
};

export function ResourcesCard({ resources, onAddToNotes }: ResourcesCardProps) {
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      if (confirm(`Add to notes?\n\n"${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`)) {
        onAddToNotes(selectedText);
      }
    }
  };

  if (resources.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Resources
          </h2>
          <p className="text-muted-foreground text-sm">
            Translation notes, questions, and articles will appear here
          </p>
        </div>
        
        <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
          <div className="flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>Scripture</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Notes</span>
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

      {/* Resources list */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-20 fade-edges"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <div className="max-w-xl mx-auto space-y-4 pt-4">
          {resources.map((resource, index) => {
            const Icon = resourceIcons[resource.type];
            const colorClasses = resourceColors[resource.type];

            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg border', colorClasses)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm mb-1">
                      {resource.title}
                    </h3>
                    {resource.reference && (
                      <p className="text-xs text-primary mb-2">{resource.reference}</p>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {resource.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
