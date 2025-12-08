import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, ResourceLink } from '@/types';

interface ChatResponse {
  scripture_reference: string | null;
  search_query: string | null;
  content: string;
  resource_counts: {
    notes: number;
    questions: number;
    words: number;
    academy: number;
  };
  total_resources: number;
  error?: string;
}

export function useMultiAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMessagesExternal = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
  }, []);

  const sendMessage = useCallback(async (
    content: string, 
    scriptureContext?: string,
    onScriptureReference?: (ref: string) => void,
    responseLanguage?: string
  ) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      setError(null);
      // Build conversation history for context
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('multi-agent-chat', {
        body: {
          message: content,
          conversationHistory,
          scriptureContext,
          responseLanguage,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = data as ChatResponse;

      if (response.error) {
        throw new Error(response.error);
      }

      // Notify about scripture reference if found
      if (response.scripture_reference && onScriptureReference) {
        onScriptureReference(response.scripture_reference);
      }

      // Build resource links for the consolidated response
      const resources: ResourceLink[] = [];
      const searchContext = response.scripture_reference || response.search_query || '';
      
      if (response.scripture_reference) {
        resources.push({
          type: 'scripture',
          reference: response.scripture_reference,
          title: response.scripture_reference,
        });
      }

      if (response.resource_counts.notes > 0) {
        resources.push({
          type: 'note',
          reference: searchContext,
          title: 'Translation Notes',
        });
      }

      if (response.resource_counts.questions > 0) {
        resources.push({
          type: 'question',
          reference: searchContext,
          title: 'Study Questions',
        });
      }

      if (response.resource_counts.words > 0) {
        resources.push({
          type: 'word',
          reference: searchContext,
          title: 'Word Studies',
        });
      }

      if (response.resource_counts.academy > 0) {
        resources.push({
          type: 'academy',
          reference: searchContext,
          title: 'Academy Articles',
        });
      }

      // Build content with total count
      const totalCount = response.total_resources;
      const contentWithCount = totalCount > 0 
        ? `${response.content}\n\n*${totalCount} resources found — swipe right to explore.*`
        : response.content;

      // Create single consolidated message
      const assistantMessage: Message = {
        id: `${Date.now()}-response`,
        role: 'assistant',
        content: contentWithCount,
        timestamp: new Date(),
        resources: resources.length > 0 ? resources : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      return {
        scriptureReference: response.scripture_reference,
        searchQuery: response.search_query,
        newMessages: [assistantMessage],
      };
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      
      // Add error message
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: `I encountered an error: ${errorMsg}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setMessages: setMessagesExternal,
  };
}
