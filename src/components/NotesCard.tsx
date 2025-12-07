import { useState } from 'react';
import { motion } from 'framer-motion';
import { PenLine, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Note } from '@/types';
import { cn } from '@/lib/utils';

interface NotesCardProps {
  notes: Note[];
  onAddNote: (content: string) => void;
  onDeleteNote: (id: string) => void;
}

export function NotesCard({ notes, onAddNote, onDeleteNote }: NotesCardProps) {
  const [newNote, setNewNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Header */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 text-foreground">
          <PenLine className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Personal Notes</span>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 fade-edges">
        <div className="max-w-xl mx-auto space-y-3">
          {notes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">
                Your notes will appear here.<br />
                Select text from other cards to add.
              </p>
            </div>
          )}

          {notes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'glass-card rounded-xl p-4 group relative',
                note.highlighted && 'border-primary/30 bg-primary/5'
              )}
            >
              <p className="text-sm text-foreground/90 leading-relaxed pr-8">
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
              
              <button
                onClick={() => onDeleteNote(note.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 
                         transition-opacity bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="w-3 h-3" />
              </button>
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
              placeholder="Add a note..."
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
                Save Note
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-between px-6 text-muted-foreground/40">
        <div className="flex items-center gap-1 text-xs">
          <ChevronLeft className="w-4 h-4" />
          <span>Resources</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span>Chat</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
