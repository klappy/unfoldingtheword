import { useState, useCallback, useEffect, useRef } from 'react';
import { Resource, ScripturePassage } from '@/types';
import { useTrace } from '@/contexts/TraceContext';
import { supabase } from '@/integrations/supabase/client';

// Tool call signature stored in messages
export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

// Search result section from search-agent
interface ResourceSearchResult {
  markdown: string;
  matches: Array<{ reference?: string; book?: string; chapter?: number; verse?: number; text: string; rawMarkdown?: string; metadata?: Record<string, any> }>;
  totalCount: number;
  breakdown?: {
    byTestament?: Record<string, number>;
    byBook?: Record<string, number>;
  };
}

// Full search results format matching SearchCard expectations
export interface SearchResults {
  query: string;
  scope: string;
  scopeType: 'verse' | 'chapter' | 'book' | 'testament' | 'bible';
  scripture: ResourceSearchResult | null;
  notes: ResourceSearchResult | null;
  questions: ResourceSearchResult | null;
  words: ResourceSearchResult | null;
  academy: ResourceSearchResult | null;
  toolCalls: Array<{ tool: string; args: Record<string, any> }>;
}

// Aggregated state from replaying tool calls
export interface McpState {
  scripture: ScripturePassage | null;
  resources: Resource[];
  searchResults: SearchResults | null;
  isLoading: boolean;
  error: string | null;
}

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

// Replay a single tool call against sub-agents
async function replayToolCall(
  toolCall: ToolCall,
  prefs: { language: string; organization: string; resource: string },
  trace: (entity: string, phase: 'start' | 'first_token' | 'tool_call' | 'complete' | 'error', message?: string, metadata?: Record<string, any>) => void
): Promise<{
  scripture?: ScripturePassage;
  resources?: Resource[];
  searchResults?: McpState['searchResults'];
}> {
  const { tool, args } = toolCall;
  const result: ReturnType<typeof replayToolCall> extends Promise<infer T> ? T : never = {};

  try {
    switch (tool) {
      case 'scripture-agent': {
        trace('scripture-agent', 'start', `reference="${args.reference}"`, {
          displayName: 'Scripture Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('scripture-agent', {
          body: {
            reference: args.reference,
            language: args.language || prefs.language,
            organization: args.organization || prefs.organization,
            resource: args.resource || prefs.resource,
          },
        });

        if (error) {
          trace('scripture-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data) {
          trace('scripture-agent', 'complete', `${data.verses?.length || 0} verses`);
          result.scripture = {
            reference: args.reference,
            text: data.text || '',
            verses: data.verses || [],
            translation: args.resource || prefs.resource,
            book: data.book,
            metadata: data.metadata,
          };
        }
        break;
      }

      case 'resource-agent': {
        trace('resource-agent', 'start', `reference="${args.reference}" type="${args.type}"`, {
          displayName: 'Resource Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('resource-agent', {
          body: {
            reference: args.reference,
            type: args.type || ['notes', 'questions', 'word-links'],
            language: args.language || prefs.language,
            organization: args.organization || prefs.organization,
            term: args.term,
          },
        });

        if (error) {
          trace('resource-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data?.resources) {
          trace('resource-agent', 'complete', `${data.resources.length} resources`);
          result.resources = data.resources.map((r: any) => ({
            id: r.id || `res-${Math.random()}`,
            type: r.type || 'translation-note',
            title: r.title || r.reference,
            content: r.content || '',
            reference: r.reference,
          }));
        }
        break;
      }

      case 'search-agent': {
        trace('search-agent', 'start', `query="${args.query}" scope="${args.scope}"`, {
          displayName: 'Search Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('search-agent', {
          body: {
            query: args.query,
            scope: args.scope || 'Bible',
            resourceTypes: args.resourceTypes || ['scripture', 'notes', 'questions', 'words', 'academy'],
            language: args.language || prefs.language,
            organization: args.organization || prefs.organization,
            resource: args.resource || prefs.resource,
          },
        });

        if (error) {
          trace('search-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data) {
          const scriptureCount = data.scripture?.totalCount || 0;
          const notesCount = data.notes?.totalCount || 0;
          trace('search-agent', 'complete', `${scriptureCount} scripture, ${notesCount} notes`);

          // Return the full search-agent response in new format
          result.searchResults = {
            query: data.query,
            scope: data.scope,
            scopeType: data.scopeType || 'book',
            scripture: data.scripture || null,
            notes: data.notes || null,
            questions: data.questions || null,
            words: data.words || null,
            academy: data.academy || null,
            toolCalls: data.toolCalls || [],
          };

          // Collect resources from search results
          const resources: Resource[] = [];
          if (data.notes?.matches) {
            resources.push(...data.notes.matches.map((m: any) => ({
              id: `tn-${m.reference}-${Math.random()}`,
              type: 'translation-note' as const,
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (data.questions?.matches) {
            resources.push(...data.questions.matches.map((m: any) => ({
              id: `tq-${m.reference}-${Math.random()}`,
              type: 'translation-question' as const,
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (data.words?.matches) {
            resources.push(...data.words.matches.map((m: any) => ({
              id: `tw-${m.reference}-${Math.random()}`,
              type: 'translation-word' as const,
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (data.academy?.matches) {
            resources.push(...data.academy.matches.map((m: any) => ({
              id: `ta-${m.reference}-${Math.random()}`,
              type: 'academy-article' as const,
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (resources.length > 0) {
            result.resources = resources;
          }
        }
        break;
      }

      case 'note-agent': {
        trace('note-agent', 'start', `action="${args.action}"`, {
          displayName: 'Note Agent',
          layer: 'edge',
        });

        const deviceId = localStorage.getItem('device-id');
        const { data, error } = await supabase.functions.invoke('note-agent', {
          body: {
            action: args.action || 'read',
            device_id: args.device_id || deviceId,
            scope: args.scope,
            reference: args.reference,
            limit: args.limit,
            content: args.content,
            note_id: args.note_id,
          },
        });

        if (error) {
          trace('note-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data?.notes) {
          trace('note-agent', 'complete', `${data.notes.length} notes`);
          result.resources = data.notes.map((n: any) => ({
            id: n.id,
            type: 'note' as any,
            title: n.source_reference || 'Note',
            content: n.content,
            reference: n.source_reference,
          }));
        } else if (data?.note) {
          trace('note-agent', 'complete', `1 note`);
          result.resources = [{
            id: data.note.id,
            type: 'note' as any,
            title: data.note.source_reference || 'Note',
            content: data.note.content,
            reference: data.note.source_reference,
          }];
        } else {
          trace('note-agent', 'complete', 'success');
        }
        break;
      }

      // Legacy tool names - map to new sub-agents
      case 'get_scripture_passage': {
        trace('scripture-agent', 'start', `reference="${args.reference}"`, {
          displayName: 'Scripture Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('scripture-agent', {
          body: {
            reference: args.reference,
            language: prefs.language,
            organization: prefs.organization,
            resource: args.resource || prefs.resource,
          },
        });

        if (error) {
          trace('scripture-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data) {
          trace('scripture-agent', 'complete', `${data.verses?.length || 0} verses`);
          result.scripture = {
            reference: args.reference,
            text: data.text || '',
            verses: data.verses || [],
            translation: args.resource || prefs.resource,
            book: data.book,
            metadata: data.metadata,
          };
        }
        break;
      }

      case 'get_translation_notes':
      case 'get_translation_questions': {
        const resourceType = tool === 'get_translation_notes' ? 'notes' : 'questions';
        trace('resource-agent', 'start', `reference="${args.reference}" type="${resourceType}"`, {
          displayName: 'Resource Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('resource-agent', {
          body: {
            reference: args.reference,
            type: [resourceType],
            language: prefs.language,
            organization: prefs.organization,
          },
        });

        if (error) {
          trace('resource-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data?.resources) {
          trace('resource-agent', 'complete', `${data.resources.length} resources`);
          result.resources = data.resources.map((r: any) => ({
            id: r.id || `res-${Math.random()}`,
            type: r.type || (resourceType === 'notes' ? 'translation-note' : 'translation-question'),
            title: r.title || r.reference,
            content: r.content || '',
            reference: r.reference,
          }));
        }
        break;
      }

      case 'get_translation_word': {
        trace('resource-agent', 'start', `term="${args.term}"`, {
          displayName: 'Resource Agent',
          layer: 'edge',
        });

        const { data, error } = await supabase.functions.invoke('resource-agent', {
          body: {
            reference: args.reference || 'Bible',
            type: ['words'],
            term: args.term,
            language: prefs.language,
            organization: prefs.organization,
          },
        });

        if (error) {
          trace('resource-agent', 'error', error.message);
          throw new Error(error.message);
        }

        if (data?.resources) {
          trace('resource-agent', 'complete', `${data.resources.length} resources`);
          result.resources = data.resources.map((r: any) => ({
            id: r.id || `tw-${args.term}`,
            type: 'translation-word',
            title: r.title || args.term,
            content: r.content || r.definition || '',
            reference: r.reference,
          }));
        }
        break;
      }

      default:
        console.warn(`[McpReplay] Unknown tool: ${tool}`);
    }
  } catch (error) {
    console.error(`[McpReplay] Error replaying ${tool}:`, error);
  }

  return result;
}

export function useMcpReplay() {
  const { trace } = useTrace();
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
    
    trace('mcp-replay', 'start', `Replaying ${toolCalls.length} tool calls`, {
      displayName: 'MCP Replay',
      layer: 'client',
    });

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
        toolCalls.map(tc => replayToolCall(tc, prefs, trace))
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

      trace('mcp-replay', 'complete', `Scripture: ${scripture ? 'yes' : 'no'}, Resources: ${resources.length}, Search: ${searchResults ? 'yes' : 'no'}`);
      
      setState({
        scripture,
        resources,
        searchResults,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('[McpReplay] Error replaying tool calls:', error);
      trace('mcp-replay', 'error', error instanceof Error ? error.message : 'Unknown error');
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [trace]);

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
