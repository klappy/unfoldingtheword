import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Note } from '@/types';
import { useDeviceId } from './useDeviceId';

export function useNotes() {
  const deviceId = useDeviceId();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notes function
  const fetchNotes = useCallback(async () => {
    if (!deviceId) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
    } else {
      setNotes(data.map(note => ({
        id: note.id,
        content: note.content,
        sourceReference: note.source_reference || undefined,
        createdAt: new Date(note.created_at),
        highlighted: note.highlighted || false,
      })));
    }
    setIsLoading(false);
  }, [deviceId]);

  // Fetch notes on mount and when deviceId changes
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(async (content: string, sourceReference?: string) => {
    if (!deviceId) return null;

    const { data, error } = await supabase
      .from('notes')
      .insert({
        device_id: deviceId,
        content,
        source_reference: sourceReference,
        highlighted: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding note:', error);
      return null;
    }

    const newNote: Note = {
      id: data.id,
      content: data.content,
      sourceReference: data.source_reference || undefined,
      createdAt: new Date(data.created_at),
      highlighted: data.highlighted || false,
    };

    setNotes(prev => [newNote, ...prev]);
    return newNote;
  }, [deviceId]);

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting note:', error);
      return false;
    }

    setNotes(prev => prev.filter(note => note.id !== id));
    return true;
  }, []);

  const updateNote = useCallback(async (id: string, content: string) => {
    const { error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id);

    if (error) {
      console.error('Error updating note:', error);
      return false;
    }

    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, content } : note
    ));
    return true;
  }, []);

  return {
    notes,
    isLoading,
    addNote,
    deleteNote,
    updateNote,
    refetchNotes: fetchNotes,
  };
}
