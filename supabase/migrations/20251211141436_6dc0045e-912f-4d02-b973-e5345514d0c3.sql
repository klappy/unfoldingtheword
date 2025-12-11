-- Add new columns to notes table for tracking feedback on resources
ALTER TABLE public.notes 
ADD COLUMN resource_type text,
ADD COLUMN resource_id text;

-- Add comment explaining the columns
COMMENT ON COLUMN public.notes.resource_type IS 'Type of resource this feedback references: scripture, tn, tq, tw, ta';
COMMENT ON COLUMN public.notes.resource_id IS 'Identifier for the specific resource (e.g., article ID, verse reference)';