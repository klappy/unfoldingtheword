import { useState, useCallback } from 'react';
import { ScripturePassage, Resource } from '@/types';
import { mockScripture, mockResources } from '@/data/mockData';

export function useScriptureData() {
  const [scripture, setScripture] = useState<ScripturePassage | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScriptureData = useCallback(async (reference: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use mock data for now - MCP server uses MCP protocol, not REST API
      // TODO: Implement MCP protocol client or find REST API alternative
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
      
      setScripture({
        ...mockScripture,
        reference: reference,
      });
      
      setResources(mockResources);
    } catch (err) {
      console.error('Error loading scripture data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setScripture(null);
    setResources([]);
    setError(null);
  }, []);

  return {
    scripture,
    resources,
    isLoading,
    error,
    loadScriptureData,
    clearData,
  };
}
