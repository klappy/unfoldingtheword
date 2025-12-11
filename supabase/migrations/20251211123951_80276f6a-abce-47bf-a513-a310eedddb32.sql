-- Add note_type column to distinguish regular notes from bug reports
ALTER TABLE public.notes 
ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note';

-- Add constraint to ensure valid note types
ALTER TABLE public.notes 
ADD CONSTRAINT notes_type_check CHECK (note_type IN ('note', 'bug_report'));

-- Create index for filtering by note type
CREATE INDEX idx_notes_type ON public.notes(note_type);