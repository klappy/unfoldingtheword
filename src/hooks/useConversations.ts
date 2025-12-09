import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HistoryItem, Message, ResourceLink } from '@/types';
import { useDeviceId } from './useDeviceId';

export function useConversations(currentLanguage: string = 'en') {
  const deviceId = useDeviceId();
  const [conversations, setConversations] = useState<HistoryItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch conversations filtered by language
  useEffect(() => {
    if (!deviceId) return;

    const fetchConversations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('device_id', deviceId)
        .eq('language', currentLanguage)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        setConversations(data.map(conv => ({
          id: conv.id,
          title: conv.title,
          preview: conv.preview || '',
          timestamp: new Date(conv.updated_at),
          scriptureReference: conv.scripture_reference || undefined,
        })));
      }
      setIsLoading(false);
    };

    fetchConversations();
  }, [deviceId, currentLanguage]);

  const createConversation = useCallback(async (title: string, preview?: string, scriptureReference?: string, language?: string) => {
    if (!deviceId) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        device_id: deviceId,
        title,
        preview,
        scripture_reference: scriptureReference,
        language: language || currentLanguage,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    const newConv: HistoryItem = {
      id: data.id,
      title: data.title,
      preview: data.preview || '',
      timestamp: new Date(data.updated_at),
      scriptureReference: data.scripture_reference || undefined,
    };

    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(data.id);
    return data.id;
  }, [deviceId, currentLanguage]);

  const updateConversation = useCallback(async (id: string, updates: { title?: string; preview?: string; scriptureReference?: string }) => {
    const { error } = await supabase
      .from('conversations')
      .update({
        title: updates.title,
        preview: updates.preview,
        scripture_reference: updates.scriptureReference,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating conversation:', error);
      return false;
    }

    setConversations(prev => prev.map(conv => 
      conv.id === id 
        ? { 
            ...conv, 
            title: updates.title || conv.title,
            preview: updates.preview || conv.preview,
            scriptureReference: updates.scriptureReference || conv.scriptureReference,
            timestamp: new Date(),
          } 
        : conv
    ));
    return true;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }

    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
    return true;
  }, [currentConversationId]);

  const saveMessage = useCallback(async (conversationId: string, message: Message) => {
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        agent: message.agent || null,
        resources: message.resources ? JSON.parse(JSON.stringify(message.resources)) : null,
      });

    if (error) {
      console.error('Error saving message:', error);
      return false;
    }
    return true;
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return [];
    }

    return data.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      agent: msg.agent as any,
      timestamp: new Date(msg.created_at),
      resources: (msg.resources as unknown as ResourceLink[]) || undefined,
    }));
  }, []);

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    isLoading,
    createConversation,
    updateConversation,
    deleteConversation,
    saveMessage,
    loadConversationMessages,
  };
}
