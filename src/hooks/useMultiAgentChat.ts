import { useState, useCallback } from 'react';
import { Message, ResourceLink } from '@/types';

interface SearchMatch {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ChatMetadata {
  scripture_reference: string | null;
  search_query: string | null;
  resource_counts: {
    notes: number;
    questions: number;
    words: number;
    academy: number;
  };
  total_resources: number;
  mcp_resources: any[];
  navigation_hint: 'scripture' | 'resources' | 'search' | 'notes' | null;
  search_matches?: SearchMatch[];
}

interface UseMultiAgentChatOptions {
  onBugReport?: (errorMessage: string, context: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/multi-agent-chat`;

// Get current resource preferences from localStorage
function getResourcePrefs() {
  const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
  if (prefsJson) {
    try {
      const prefs = JSON.parse(prefsJson);
      if (Array.isArray(prefs) && prefs.length > 0) {
        const activePref = prefs.find((p: any) => p.resource) || prefs[0];
        return {
          language: activePref.language || 'en',
          organization: activePref.organization || 'unfoldingWord',
          resource: activePref.resource || 'ult',
        };
      }
    } catch (e) {
      console.error('[Chat] Error parsing resource prefs:', e);
    }
  }
  return { language: 'en', organization: 'unfoldingWord', resource: 'ult' };
}

export function useMultiAgentChat(options: UseMultiAgentChatOptions = {}) {
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

      // Get current user preferences for resources
      const userPrefs = getResourcePrefs();

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: content,
          conversationHistory,
          scriptureContext,
          responseLanguage,
          userPrefs, // Pass user preferences for resource selection
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limits exceeded, please try again later.");
        }
        if (response.status === 402) {
          throw new Error("Payment required.");
        }
        throw new Error(`Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let metadata: ChatMetadata | null = null;
      let assistantContent = "";
      const assistantMessageId = `${Date.now()}-response`;

      // Create initial assistant message placeholder with streaming flag
      const initialAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true, // Mark as streaming
      };
      setMessages(prev => [...prev, initialAssistantMessage]);
      setIsLoading(false); // Stop showing separate loading indicator

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith(":") || line === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.type === 'metadata') {
              metadata = parsed;
              // Notify about scripture reference if found
              if (parsed.scripture_reference && onScriptureReference) {
                onScriptureReference(parsed.scripture_reference);
              }
            } else if (parsed.type === 'content') {
              assistantContent += parsed.content;
              // Update the assistant message with streaming content (keep isStreaming true)
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: assistantContent, isStreaming: true }
                  : m
              ));
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Incomplete JSON, put back
            if (!(e instanceof SyntaxError)) throw e;
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Build resource links from metadata
      const resources: ResourceLink[] = [];
      if (metadata) {
        const searchContext = metadata.scripture_reference || metadata.search_query || '';
        
        if (metadata.scripture_reference) {
          resources.push({
            type: 'scripture',
            reference: metadata.scripture_reference,
            title: metadata.scripture_reference,
          });
        }

        if (metadata.resource_counts.notes > 0) {
          resources.push({
            type: 'note',
            reference: searchContext,
            title: 'Translation Notes',
          });
        }

        if (metadata.resource_counts.questions > 0) {
          resources.push({
            type: 'question',
            reference: searchContext,
            title: 'Study Questions',
          });
        }

        if (metadata.resource_counts.words > 0) {
          resources.push({
            type: 'word',
            reference: searchContext,
            title: 'Word Studies',
          });
        }

        if (metadata.resource_counts.academy > 0) {
          resources.push({
            type: 'academy',
            reference: searchContext,
            title: 'Academy Articles',
          });
        }
      }

      // Build final content with resource count
      const totalCount = metadata?.total_resources || 0;
      const finalContent = totalCount > 0 
        ? `${assistantContent}\n\n*${totalCount} resources found — swipe right to explore.*`
        : assistantContent;

      // Build final assistant message
      const finalAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date(),
        resources: resources.length > 0 ? resources : undefined,
        isStreaming: false,
      };

      // Update final message with resources and clear streaming flag
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId ? finalAssistantMessage : m
      ));
      
      return {
        scriptureReference: metadata?.scripture_reference || null,
        searchQuery: metadata?.search_query || null,
        navigationHint: metadata?.navigation_hint || null,
        searchMatches: metadata?.search_matches || [],
        newMessages: [finalAssistantMessage], // Return for persistence
      };
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      
      // Create bug report for chat errors
      options.onBugReport?.(
        errorMsg,
        `Text chat error\nMessage: ${content}\nScripture context: ${scriptureContext || 'none'}`
      );
      
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
      // Ensure no messages are left in streaming state
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
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
