import { useState, useCallback, useEffect, useRef } from 'react';
import { Resource, ScripturePassage } from '@/types';

// Tool call signature stored in messages
export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

// Aggregated state from replaying tool calls
export interface McpState {
  scripture: ScripturePassage | null;
  resources: Resource[];
  searchResults: {
    query: string;
    reference: string;
    matches: Array<{ book: string; chapter: number; verse: number; text: string }>;
    resource?: string;
  } | null;
  isLoading: boolean;
  error: string | null;
}

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

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
      console.error('[McpReplay] Error parsing resource prefs:', e);
    }
  }
  return { language: 'en', organization: 'unfoldingWord', resource: 'ult' };
}

// Replay a single tool call against MCP server
async function replayToolCall(
  toolCall: ToolCall,
  prefs: { language: string; organization: string; resource: string }
): Promise<{
  scripture?: ScripturePassage;
  resources?: Resource[];
  searchResults?: McpState['searchResults'];
}> {
  const { tool, args } = toolCall;
  const result: ReturnType<typeof replayToolCall> extends Promise<infer T> ? T : never = {};

  try {
    switch (tool) {
      case 'get_scripture_passage': {
        let url = `${MCP_BASE_URL}/api/fetch-scripture?reference=${encodeURIComponent(args.reference)}`;
        if (args.filter) url += `&filter=${encodeURIComponent(args.filter)}`;
        url += `&language=${encodeURIComponent(prefs.language)}`;
        url += `&organization=${encodeURIComponent(prefs.organization)}`;
        url += `&resource=${encodeURIComponent(prefs.resource)}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          
          if (args.filter && data.matches) {
            // Filter search - return search results
            result.searchResults = {
              query: args.filter,
              reference: args.reference,
              matches: data.matches || [],
              resource: prefs.resource,
            };
          } else if (data.text || data.book) {
            // Normal passage fetch
            result.scripture = {
              reference: args.reference,
              text: data.text || '',
              verses: data.verses || [],
              translation: prefs.resource,
              book: data.book,
              metadata: data.metadata,
            };
          }
        }
        break;
      }

      case 'get_translation_notes': {
        let url = `${MCP_BASE_URL}/api/fetch-translation-notes?reference=${encodeURIComponent(args.reference)}`;
        url += `&language=${encodeURIComponent(prefs.language)}`;
        url += `&organization=${encodeURIComponent(prefs.organization)}`;
        if (args.filter) url += `&filter=${encodeURIComponent(args.filter)}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            result.resources = data.map((r: any) => ({
              id: r.id || `tn-${Math.random()}`,
              type: 'translation-note',
              title: r.title || args.reference,
              content: r.content || '',
              reference: r.reference || args.reference,
            }));
          }
        }
        break;
      }

      case 'get_translation_questions': {
        let url = `${MCP_BASE_URL}/api/fetch-translation-questions?reference=${encodeURIComponent(args.reference)}`;
        url += `&language=${encodeURIComponent(prefs.language)}`;
        url += `&organization=${encodeURIComponent(prefs.organization)}`;
        if (args.filter) url += `&filter=${encodeURIComponent(args.filter)}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            result.resources = data.map((r: any) => ({
              id: r.id || `tq-${Math.random()}`,
              type: 'translation-question',
              title: r.question || args.reference,
              content: r.response || '',
              reference: r.reference || args.reference,
            }));
          }
        }
        break;
      }

      case 'get_translation_word': {
        let url = `${MCP_BASE_URL}/api/fetch-translation-word?term=${encodeURIComponent(args.term)}`;
        // Support reference parameter for scoped lookups
        if (args.reference) url += `&reference=${encodeURIComponent(args.reference)}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          result.resources = [{
            id: data.id || `tw-${args.term}`,
            type: 'translation-word',
            title: data.term || args.term,
            content: data.definition || data.content || '',
            reference: data.reference,
          }];
        }
        break;
      }
    }
  } catch (error) {
    console.error(`[McpReplay] Error replaying ${tool}:`, error);
  }

  return result;
}

function getResourceType(resourceType: string): Resource['type'] {
  switch (resourceType) {
    case 'tn': return 'translation-note';
    case 'tq': return 'translation-question';
    case 'tw': return 'translation-word';
    case 'ta': return 'academy-article';
    default: return 'translation-note';
  }
}

export function useMcpReplay() {
  const [state, setState] = useState<McpState>({
    scripture: null,
    resources: [],
    searchResults: null,
    isLoading: false,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Replay tool calls and aggregate results
  const replayToolCalls = useCallback(async (toolCalls: ToolCall[]) => {
    if (!toolCalls || toolCalls.length === 0) {
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const prefs = getResourcePrefs();
    let scripture: ScripturePassage | null = null;
    let resources: Resource[] = [];
    let searchResults: McpState['searchResults'] = null;

    try {
      // Replay all tool calls in parallel
      const results = await Promise.all(
        toolCalls.map(tc => replayToolCall(tc, prefs))
      );

      // Aggregate results
      for (const result of results) {
        if (result.scripture) {
          scripture = result.scripture;
        }
        if (result.resources) {
          resources = [...resources, ...result.resources];
        }
        if (result.searchResults) {
          searchResults = result.searchResults;
        }
      }

      setState({
        scripture,
        resources,
        searchResults,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('[McpReplay] Error replaying tool calls:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Clear state
  const clearState = useCallback(() => {
    setState({
      scripture: null,
      resources: [],
      searchResults: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    replayToolCalls,
    clearState,
  };
}
