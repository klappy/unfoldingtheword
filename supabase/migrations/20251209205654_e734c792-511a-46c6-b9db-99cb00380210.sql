-- Add language column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN language TEXT DEFAULT 'en';

-- Create index for efficient filtering by device_id and language
CREATE INDEX idx_conversations_device_language ON public.conversations(device_id, language);