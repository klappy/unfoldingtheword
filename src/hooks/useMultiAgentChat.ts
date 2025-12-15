import { useState, useCallback } from 'react';
import { Message, ToolCall } from '@/types';
import { useTrace } from '@/contexts/TraceContext';

interface SearchMatch {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// Tool results structure - ALL data the LLM received from tools
interface ToolResults {
  scripture?: {
    reference: string;
    text: string;
    resource: string;
  } | null;
  search?: any | null;  // Full search results from search-agent
  resources?: any[] | null;
}

interface ChatMetadata {
  scripture_reference: string | null;
  search_query: string | null;
  tool_calls: ToolCall[];
  navigation_hint: 'scripture' | 'resources' | 'search' | 'notes' | null;
  search_matches?: SearchMatch[];
  search_resource?: string;
  tool_results?: ToolResults;
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
  const { trace } = useTrace();
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
    
    // Start trace with entity metadata (DRY - metadata defined at source)
    trace('multi-agent-chat', 'start', `User: ${content.substring(0, 50)}...`, {
      displayName: 'Orchestrator',
      layer: 'edge',
    });
    let firstTokenReceived = false;

    try {
      setError(null);
      // Build conversation history for context
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Get current user preferences for resources
      const userPrefs = getResourcePrefs();
      
      // Include deviceId for note operations
      const deviceId = localStorage.getItem('device-id');

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
          userPrefs: {
            ...userPrefs,
            deviceId,
          },
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
      let toolResults: ToolResults | null = null;
      let assistantContent = "";
      const assistantMessageId = `${Date.now()}-response`;

      // Create initial assistant message placeholder with streaming flag
      const initialAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages(prev => [...prev, initialAssistantMessage]);
      setIsLoading(false);

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
            
            // Capture tool_results for immediate UI population
            if (parsed.type === 'tool_results') {
              toolResults = parsed.data;
              console.log('[Chat] Received tool_results:', Object.keys(parsed.data || {}).filter(k => parsed.data[k]));
            } else if (parsed.type === 'metadata') {
              metadata = parsed;
              // Also capture tool_results from metadata if present
              if (parsed.tool_results) {
                toolResults = parsed.tool_results;
              }
              // Notify about scripture reference if found
              if (parsed.scripture_reference && onScriptureReference) {
                onScriptureReference(parsed.scripture_reference);
              }
            } else if (parsed.type === 'content') {
              // Trace first token (TTFT)
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                trace('multi-agent-chat', 'first_token', 'First content token received');
              }
              assistantContent += parsed.content;
              // Update the assistant message with streaming content
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

      // Build final assistant message with tool_calls and navigation_hint
      const finalAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        toolCalls: metadata?.tool_calls || undefined,
        navigationHint: metadata?.navigation_hint || undefined,
        isStreaming: false,
      };

      // Update final message
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId ? finalAssistantMessage : m
      ));
      
      // Trace completion
      trace('multi-agent-chat', 'complete', `Tools: ${metadata?.tool_calls?.length || 0}, Nav: ${metadata?.navigation_hint || 'none'}`);
      
      return {
        scriptureReference: metadata?.scripture_reference || null,
        searchQuery: metadata?.search_query || null,
        navigationHint: metadata?.navigation_hint || null,
        searchMatches: metadata?.search_matches || [],
        searchResource: metadata?.search_resource || null,
        toolCalls: metadata?.tool_calls || [],
        toolResults,  // NEW: All data the LLM received
        newMessages: [finalAssistantMessage],
      };
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      
      // Trace error
      trace('multi-agent-chat', 'error', errorMsg);
      
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
