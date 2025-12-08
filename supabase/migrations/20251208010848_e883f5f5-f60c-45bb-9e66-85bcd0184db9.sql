-- Add resources column to messages table to store resource links
ALTER TABLE public.messages 
ADD COLUMN resources jsonb DEFAULT NULL;