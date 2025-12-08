import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, AgentType, ResourceLink } from '@/types';

interface AgentResponse {
  agent: string;
  name: string;
  emoji: string;
  content: string;
}

interface ChatResponse {
  scripture_reference: string | null;
  search_query: string | null;
  agents: AgentResponse[];
  orchestrator_note: string;
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
    onScriptureReference?: (ref: string) => void
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

      // Create messages from each agent
      const agentMessages: Message[] = response.agents.map((agent, index) => {
        const agentType = agent.agent as AgentType;
        
        // Build resource links based on agent type and available references
        const resources: ResourceLink[] = [];
        const searchContext = response.scripture_reference || response.search_query || '';
        
        if (response.scripture_reference) {
          resources.push({
            type: 'scripture',
            reference: response.scripture_reference,
            title: `${response.scripture_reference}`,
          });
        }

        // Add resource links for each agent type - works for both scripture refs and keyword searches
        if (agent.agent === 'notes' && searchContext) {
          resources.push({
            type: 'note',
            reference: searchContext,
            title: response.scripture_reference ? 'View Translation Notes' : `Notes on "${searchContext}"`,
            preview: agent.content.slice(0, 150),
          });
        }

        if (agent.agent === 'questions' && searchContext) {
          resources.push({
            type: 'question',
            reference: searchContext,
            title: response.scripture_reference ? 'Study Questions' : `Questions about "${searchContext}"`,
            preview: agent.content.slice(0, 150),
          });
        }

        if (agent.agent === 'words' && searchContext) {
          resources.push({
            type: 'word',
            reference: searchContext,
            title: response.scripture_reference ? 'Word Studies' : `"${searchContext}" Word Study`,
            preview: agent.content.slice(0, 150),
          });
        }

        if (agent.agent === 'scripture' && searchContext && !response.scripture_reference) {
          // For keyword searches without a specific scripture ref, add an academy-style resource
          resources.push({
            type: 'academy',
            reference: searchContext,
            title: `Learn about "${searchContext}"`,
            preview: agent.content.slice(0, 150),
          });
        }

        return {
          id: `${Date.now()}-${index}`,
          role: 'assistant' as const,
          content: `**${agent.emoji} ${agent.name}**\n\n${agent.content}`,
          agent: agentType,
          timestamp: new Date(),
          resources: resources.length > 0 ? resources : undefined,
        };
      });

      setMessages(prev => [...prev, ...agentMessages]);
      
      return {
        scriptureReference: response.scripture_reference,
        searchQuery: response.search_query,
        newMessages: agentMessages,
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
