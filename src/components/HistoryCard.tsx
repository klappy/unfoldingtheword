import { History, MessageSquare, Book, Plus } from 'lucide-react';
import { HistoryItem } from '@/types';
import { TranslationStrings } from '@/i18n/translations';

interface HistoryCardProps {
  items: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onNewConversation: () => void;
  t: (key: keyof TranslationStrings) => string;
}

export function HistoryCard({ items, onSelectItem, onNewConversation, t }: HistoryCardProps) {
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2 text-foreground">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('history.title')}</span>
        </div>
        <button
          onClick={onNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t('history.new')}
        </button>
      </div>

      {/* History items */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {t('history.empty.description')}
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              {t('history.startHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="w-full text-left glass-card rounded-xl p-3 hover:bg-muted/50 
                         transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                    <MessageSquare className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.preview}
                    </p>
                    {(item.scripture || item.scriptureReference) && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <Book className="w-3 h-3" />
                        <span>{item.scripture || item.scriptureReference}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground/50 shrink-0">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
