import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTrace } from '@/contexts/TraceContext';

export interface SearchMatch {
  reference: string;
  book?: string;
  chapter?: number;
  verse?: number;
  text: string;
  matchedTerms?: string[];
}

export interface ResourceSearchResult {
  markdown: string;
  matches: SearchMatch[];
  totalCount: number;
  breakdown?: {
    byTestament?: Record<string, number>;
    byBook?: Record<string, number>;
  };
}

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

interface SearchState {
  results: SearchResults | null;
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
      console.error('[useSearchState] Error parsing resource prefs:', e);
    }
  }
  return { language: 'en', organization: 'unfoldingWord', resource: 'ult' };
}

export function useSearchState() {
  const { trace } = useTrace();
  const [state, setState] = useState<SearchState>({
    results: null,
    isLoading: false,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Execute a search via the search-agent edge function
  const executeSearch = useCallback(async (
    query: string,
    scope: string = 'Bible',
    resourceTypes: Array<'scripture' | 'notes' | 'questions' | 'words' | 'academy'> = ['scripture', 'notes', 'questions', 'words', 'academy']
  ): Promise<SearchResults | null> => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Trace with entity metadata (DRY - metadata defined at source)
    trace('search-agent', 'start', `Query: "${query}" Scope: ${scope}`, {
      displayName: 'Search Agent',
      layer: 'edge',
    });

    const prefs = getResourcePrefs();

    try {
      const { data, error } = await supabase.functions.invoke('search-agent', {
        body: {
          query,
          scope,
          resourceTypes,
          language: prefs.language,
          organization: prefs.organization,
          resource: prefs.resource,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const results = data as SearchResults;
      
      trace('search-agent', 'complete', `Found ${results.scripture?.totalCount || 0} scripture, ${results.notes?.totalCount || 0} notes, ${results.academy?.totalCount || 0} academy`);
      
      setState({
        results,
        isLoading: false,
        error: null,
      });

      return results;
    } catch (error) {
      console.error('[useSearchState] Error executing search:', error);
      trace('search-agent', 'error', error instanceof Error ? error.message : 'Unknown error');
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return null;
    }
  }, []);

  // Replay search from stored tool calls
  const replaySearch = useCallback(async (
    toolCalls: Array<{ tool: string; args: Record<string, any> }>
  ): Promise<SearchResults | null> => {
    // Find the search-related tool call
    const searchCall = toolCalls.find(tc => 
      tc.tool === 'get_scripture_passage' && tc.args.filter
    );
    
    if (!searchCall) {
      console.log('[useSearchState] No search tool call found in:', toolCalls);
      return null;
    }

    const { reference, filter, resource } = searchCall.args;
    
    // Determine which resource types to search based on all tool calls
    const resourceTypes: Array<'scripture' | 'notes' | 'questions' | 'words' | 'academy'> = [];
    
    for (const tc of toolCalls) {
      if (tc.tool === 'get_scripture_passage' && tc.args.filter) {
        resourceTypes.push('scripture');
      } else if (tc.tool === 'get_translation_notes' && tc.args.filter) {
        resourceTypes.push('notes');
      } else if (tc.tool === 'get_translation_questions' && tc.args.filter) {
        resourceTypes.push('questions');
      } else if (tc.tool === 'get_translation_word') {
        resourceTypes.push('words');
      }
    }

    // Default to scripture if no types determined
    if (resourceTypes.length === 0) {
      resourceTypes.push('scripture');
    }

    return executeSearch(filter, reference || 'Bible', resourceTypes);
  }, [executeSearch]);

  // Clear search state
  const clearSearch = useCallback(() => {
    setState({
      results: null,
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
    executeSearch,
    replaySearch,
    clearSearch,
  };
}
