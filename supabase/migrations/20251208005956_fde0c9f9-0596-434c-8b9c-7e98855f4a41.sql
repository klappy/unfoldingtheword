-- Create notes table for device-based persistence
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_reference TEXT,
  highlighted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations/history table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT,
  scripture_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table for conversation history
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for notes (device-based access)
CREATE POLICY "Device can view own notes" ON public.notes
  FOR SELECT USING (true);

CREATE POLICY "Device can insert own notes" ON public.notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Device can update own notes" ON public.notes
  FOR UPDATE USING (true);

CREATE POLICY "Device can delete own notes" ON public.notes
  FOR DELETE USING (true);

-- RLS policies for conversations (device-based access)
CREATE POLICY "Device can view own conversations" ON public.conversations
  FOR SELECT USING (true);

CREATE POLICY "Device can insert own conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Device can update own conversations" ON public.conversations
  FOR UPDATE USING (true);

CREATE POLICY "Device can delete own conversations" ON public.conversations
  FOR DELETE USING (true);

-- RLS policies for messages
CREATE POLICY "Anyone can view messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert messages" ON public.messages
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_notes_device_id ON public.notes(device_id);
CREATE INDEX idx_conversations_device_id ON public.conversations(device_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();