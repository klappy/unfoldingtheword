import { useState } from 'react';
import { motion } from 'framer-motion';
import { PenLine, Trash2, ChevronLeft, ChevronRight, Bug, StickyNote, MessageSquare } from 'lucide-react';
import { Note, NoteType } from '@/types';
import { cn } from '@/lib/utils';
import { TranslationStrings } from '@/i18n/translations';
import { CopyButton } from '@/components/CopyButton';
import { PlayButton } from '@/components/PlayButton';

interface NotesCardProps {
  notes: Note[];
  onAddNote: (content: string) => void;
  onDeleteNote: (id: string) => void;
  t: (key: keyof TranslationStrings) => string;
  currentLanguage?: string;
}

type FilterType = 'all' | 'note' | 'bug_report' | 'feedback';

export function NotesCard({ notes, onAddNote, onDeleteNote, t, currentLanguage }: NotesCardProps) {
  const [newNote, setNewNote] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote('');
    }
  };

  const filteredNotes = filter === 'all' 
    ? notes 
    : notes.filter(note => note.noteType === filter);

  const noteCount = notes.filter(n => n.noteType === 'note').length;
  const bugCount = notes.filter(n => n.noteType === 'bug_report').length;
  const feedbackCount = notes.filter(n => n.noteType === 'feedback').length;

  const getResourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      scripture: 'Scripture',
      tn: 'Translation Note',
      tq: 'Translation Question',
      tw: 'Translation Word',
      ta: 'Academy Article',
    };
    return labels[type] || type;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Header */}
      <div className="px-6 pb-2">
        <div className="flex items-center gap-2 text-foreground">
          <PenLine className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">{t('notes.title')}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-1.5 max-w-xl mx-auto">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            All ({notes.length})
          </button>
          <button
            onClick={() => setFilter('note')}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1',
              filter === 'note'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <StickyNote className="w-3 h-3" />
            <span className="hidden sm:inline">Notes</span> ({noteCount})
          </button>
          <button
            onClick={() => setFilter('feedback')}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1',
              filter === 'feedback'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <MessageSquare className="w-3 h-3" />
            <span className="hidden sm:inline">Feedback</span> ({feedbackCount})
          </button>
          <button
            onClick={() => setFilter('bug_report')}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1',
              filter === 'bug_report'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <Bug className="w-3 h-3" />
            <span className="hidden sm:inline">Bugs</span> ({bugCount})
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 fade-edges">
        <div className="max-w-xl mx-auto space-y-3">
          {filteredNotes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">
                {filter === 'bug_report' 
                  ? 'No bug reports yet'
                  : filter === 'feedback'
                  ? 'No feedback yet'
                  : t('notes.empty.description')}
              </p>
            </div>
          )}

          {filteredNotes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'glass-card rounded-xl p-4 group relative',
                note.noteType === 'bug_report' 
                  ? 'border-destructive/30 bg-destructive/5'
                  : note.highlighted && 'border-primary/30 bg-primary/5'
              )}
            >
              {/* Note type badge */}
              {note.noteType === 'bug_report' && (
                <div className="flex items-center gap-1.5 text-destructive text-xs font-medium mb-2">
                  <Bug className="w-3 h-3" />
                  <span>Bug Report</span>
                </div>
              )}
              {note.noteType === 'feedback' && (
                <div className="flex items-center gap-1.5 text-primary text-xs font-medium mb-2">
                  <MessageSquare className="w-3 h-3" />
                  <span>Feedback</span>
                  {note.resourceType && (
                    <span className="text-muted-foreground">• {getResourceTypeLabel(note.resourceType)}</span>
                  )}
                </div>
              )}
              
              <p className="text-sm text-foreground/90 leading-relaxed pr-16 whitespace-pre-wrap">
                {note.content}
              </p>
              {note.sourceReference && (
                <p className="text-xs text-primary mt-2">
                  {note.sourceReference}
                </p>
              )}
              <p className="text-xs text-muted-foreground/50 mt-2">
                {new Date(note.createdAt).toLocaleDateString()}
              </p>
              
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <PlayButton text={note.content} id={`note-${note.id}`} language={currentLanguage} />
                <CopyButton text={note.content} />
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 
                           transition-opacity bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* New note input */}
      <div className="p-4 pt-0">
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
          <div className="glass-card rounded-xl p-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('notes.placeholder')}
              rows={2}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground 
                       resize-none outline-none px-3 py-2 text-sm"
            />
            <div className="flex justify-end px-2 pb-1">
              <button
                type="submit"
                disabled={!newNote.trim()}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg transition-colors',
                  newNote.trim()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {t('notes.save')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
        <div className="flex items-center gap-1 text-xs">
          <ChevronLeft className="w-4 h-4" />
          <span>{t('nav.resources')}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span>{t('nav.chat')}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
