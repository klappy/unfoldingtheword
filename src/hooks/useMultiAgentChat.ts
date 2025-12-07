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
        
        // Build resource links based on agent type
        const resources: ResourceLink[] = [];
        
        if (response.scripture_reference) {
          resources.push({
            type: 'scripture',
            reference: response.scripture_reference,
            title: `${response.scripture_reference}`,
          });
        }

        if (agent.agent === 'notes') {
          resources.push({
            type: 'note',
            reference: response.scripture_reference || '',
            title: 'View Translation Notes',
          });
        }

        if (agent.agent === 'questions') {
          resources.push({
            type: 'question',
            reference: response.scripture_reference || '',
            title: 'Study Questions',
          });
        }

        if (agent.agent === 'words') {
          resources.push({
            type: 'word',
            reference: response.scripture_reference || '',
            title: 'Word Studies',
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
      };
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
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
    sendMessage,
    clearMessages,
  };
}
