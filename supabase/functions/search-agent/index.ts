import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Scope types the search agent understands
type SearchScope = 'verse' | 'chapter' | 'book' | 'testament' | 'bible';
type ResourceType = 'scripture' | 'notes' | 'questions' | 'words';

interface SearchRequest {
  query: string;              // The search term/phrase
  scope?: string;             // Reference scope: "John 3:16", "Romans", "NT", "OT", "Bible"
  resourceTypes?: ResourceType[];
  language: string;
  organization: string;
  resource: string;           // Scripture resource (ult/ust)
}

interface SearchMatch {
  reference: string;
  book?: string;
  chapter?: number;
  verse?: number;
  text: string;
  matchedTerms?: string[];
}

interface ResourceSearchResult {
  markdown: string;
  matches: SearchMatch[];
  totalCount: number;
  breakdown?: {
    byTestament?: Record<string, number>;
    byBook?: Record<string, number>;
  };
}

interface SearchResponse {
  query: string;
  scope: string;
  scopeType: SearchScope;
  scripture: ResourceSearchResult | null;
  notes: ResourceSearchResult | null;
  questions: ResourceSearchResult | null;
  words: ResourceSearchResult | null;
  toolCalls: Array<{ tool: string; args: Record<string, any> }>;
  _timing?: { startMs: number; endMs: number; durationMs: number };
}

// Detect scope type from reference string
function detectScopeType(reference: string): SearchScope {
  const normalized = reference.toLowerCase().trim();
  
  if (normalized === 'bible' || normalized === 'all') {
    return 'bible';
  }
  
  if (['ot', 'nt', 'old testament', 'new testament'].includes(normalized)) {
    return 'testament';
  }
  
  if (['gospels', 'pentateuch', 'pauline epistles', 'prophets', 'wisdom', 'law', 'history'].includes(normalized)) {
    return 'testament';
  }
  
  if (/\d+:\d+/.test(reference)) {
    return 'verse';
  }
  
  if (/\s+\d+$/.test(reference.trim())) {
    return 'chapter';
  }
  
  return 'book';
}

// Normalize scope value for MCP API
function normalizeScopeValue(scope: string): string {
  const normalized = scope.toLowerCase().trim();
  if (normalized === 'old testament') return 'OT';
  if (normalized === 'new testament') return 'NT';
  if (normalized === 'ot') return 'OT';
  if (normalized === 'nt') return 'NT';
  return scope;
}

// Normalize scope - handle "Bible" → OT+NT split
function normalizeScopes(scope: string, scopeType: SearchScope): string[] {
  if (scopeType === 'bible') {
    return ['OT', 'NT'];
  }
  return [normalizeScopeValue(scope)];
}

// Build search parameters for MCP endpoint
// For bible-wide searches, omit testament/reference to search everything
function buildSearchParams(
  scopeType: SearchScope,
  scopeValue: string | null,
  filter: string,
  language: string,
  organization: string,
  resource?: string
): URLSearchParams {
  const params = new URLSearchParams();
  
  // Only add scope params for non-bible searches
  if (scopeValue) {
    if (scopeType === 'testament') {
      params.set('testament', scopeValue);
    } else if (scopeType !== 'bible') {
      params.set('reference', scopeValue);
    }
  }
  
  params.set('filter', filter);
  params.set('language', language);
  params.set('organization', organization);
  if (resource) params.set('resource', resource);
  return params;
}

// Search scripture with filter
// For bible-wide, make single request; for narrower scopes, use reference/testament
async function searchScripture(
  scopes: string[],
  scopeType: SearchScope,
  filter: string,
  language: string,
  organization: string,
  resource: string
): Promise<ResourceSearchResult> {
  const allMatches: SearchMatch[] = [];
  const allMarkdown: string[] = [];
  const byBook: Record<string, number> = {};
  const byTestament: Record<string, number> = {};
  let totalCount = 0;

  // For bible scope, make single request without testament/reference
  const searchScopes = scopeType === 'bible' ? [null] : scopes;

  for (const scope of searchScopes) {
    const params = buildSearchParams(scopeType, scope, filter, language, organization, resource);
    const url = `${MCP_BASE_URL}/api/fetch-scripture?${params.toString()}`;
    
    console.log(`[search-agent] Scripture search: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`[search-agent] Scripture search returned ${response.status} for scope ${scope}`);
        continue;
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await response.json();
        
        if (data.matches && Array.isArray(data.matches)) {
          for (const match of data.matches) {
            const refStr: string = match.reference || '';
            const refMatch = refStr.match(/^(.+?)\s+(\d+):(\d+)/);
            
            if (refMatch) {
              const book = refMatch[1];
              const chapter = parseInt(refMatch[2], 10);
              const verse = parseInt(refMatch[3], 10);
              
              allMatches.push({
                reference: refStr,
                book,
                chapter,
                verse,
                text: match.text || match.content || '',
                matchedTerms: match.matchedTerms,
              });
              
              byBook[book] = (byBook[book] || 0) + 1;
            }
          }
          
          if (data.statistics) {
            totalCount += data.statistics.total || 0;
            if (data.statistics.byTestament) {
              for (const [t, count] of Object.entries(data.statistics.byTestament)) {
                byTestament[t] = (byTestament[t] || 0) + (count as number);
              }
            }
            if (data.statistics.byBook) {
              for (const [b, count] of Object.entries(data.statistics.byBook)) {
                byBook[b] = (byBook[b] || 0) + (count as number);
              }
            }
          }
        }
        
        if (allMatches.length > 0) {
          const scopeMarkdown = allMatches
            .map(m => `**${m.reference}** ${m.text}`)
            .join('\n\n');
          allMarkdown.push(scopeMarkdown);
        }
      } else {
        const text = await response.text();
        if (text.trim()) {
          allMarkdown.push(text);
          
          const matchRegex = /\*\*(.+?)\s+(\d+):(\d+)\*\* \s+(.+?)(?=\n\*\*|$)/gs;
          let match;
          while ((match = matchRegex.exec(text)) !== null) {
            const book = match[1].trim();
            const chapter = parseInt(match[2], 10);
            const verse = parseInt(match[3], 10);
            const verseText = match[4].trim();
            
            allMatches.push({
              reference: `${book} ${chapter}:${verse}`,
              book,
              chapter,
              verse,
              text: verseText,
            });
            
            byBook[book] = (byBook[book] || 0) + 1;
          }
        }
      }
    } catch (error) {
      console.error(`[search-agent] Error searching scripture for scope ${scope}:`, error);
    }
  }

  return {
    markdown: allMarkdown.join('\n\n---\n\n'),
    matches: allMatches,
    totalCount: totalCount || allMatches.length,
    breakdown: {
      byTestament: Object.keys(byTestament).length > 0 ? byTestament : undefined,
      byBook: Object.keys(byBook).length > 0 ? byBook : undefined,
    },
  };
}

// Search translation notes with filter
// For bible-wide, make single request; for narrower scopes, use reference/testament
async function searchNotes(
  scopes: string[],
  scopeType: SearchScope,
  filter: string,
  language: string,
  organization: string
): Promise<ResourceSearchResult> {
  const allMatches: SearchMatch[] = [];
  const allMarkdown: string[] = [];
  let totalCount = 0;

  // For bible scope, make single request without testament/reference
  const searchScopes = scopeType === 'bible' ? [null] : scopes;

  for (const scope of searchScopes) {
    const params = buildSearchParams(scopeType, scope, filter, language, organization);
    const url = `${MCP_BASE_URL}/api/fetch-translation-notes?${params.toString()}`;
    
    console.log(`[search-agent] Notes search: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.matches || []);
        
        for (const item of items) {
          allMatches.push({
            reference: item.reference || (scope || 'Bible'),
            text: item.note || item.content || '',
            matchedTerms: item.matchedTerms,
          });
        }
        
        totalCount += data.totalMatches || items.length;
      } else {
        const text = await response.text();
        if (text.trim()) {
          allMarkdown.push(text);
          const lineCount = text.split('\n').filter(l => l.trim().startsWith('#') || l.trim().startsWith('-')).length;
          totalCount += lineCount;
        }
      }
    } catch (error) {
      console.error(`[search-agent] Error searching notes for scope ${scope}:`, error);
    }
  }

  if (allMatches.length > 0 && allMarkdown.length === 0) {
    const markdown = allMatches
      .map(m => `### ${m.reference}\n${m.text}`)
      .join('\n\n');
    allMarkdown.push(markdown);
  }

  return {
    markdown: allMarkdown.join('\n\n---\n\n'),
    matches: allMatches,
    totalCount: totalCount || allMatches.length,
  };
}

// Search translation questions with filter
// For bible-wide, make single request; for narrower scopes, use reference/testament
async function searchQuestions(
  scopes: string[],
  scopeType: SearchScope,
  filter: string,
  language: string,
  organization: string
): Promise<ResourceSearchResult> {
  const allMatches: SearchMatch[] = [];
  const allMarkdown: string[] = [];
  let totalCount = 0;

  // For bible scope, make single request without testament/reference
  const searchScopes = scopeType === 'bible' ? [null] : scopes;

  for (const scope of searchScopes) {
    const params = buildSearchParams(scopeType, scope, filter, language, organization);
    const url = `${MCP_BASE_URL}/api/fetch-translation-questions?${params.toString()}`;
    
    console.log(`[search-agent] Questions search: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.matches || []);
        
        for (const item of items) {
          const answer = item.response || item.answer || item.content || '';
          allMatches.push({
            reference: item.reference || (scope || 'Bible'),
            text: `**Q:** ${item.question || ''}\n\n**A:** ${answer}`,
            matchedTerms: item.matchedTerms,
          });
        }
        
        totalCount += data.totalMatches || items.length;
      } else {
        const text = await response.text();
        if (text.trim()) {
          allMarkdown.push(text);
          const lineCount = text.split('\n').filter(l => l.match(/^\d+\.|^#|^\*\*/)).length;
          totalCount += lineCount;
        }
      }
    } catch (error) {
      console.error(`[search-agent] Error searching questions for scope ${scope}:`, error);
    }
  }

  if (allMatches.length > 0 && allMarkdown.length === 0) {
    const markdown = allMatches
      .map(m => `### ${m.reference}\n${m.text}`)
      .join('\n\n');
    allMarkdown.push(markdown);
  }

  return {
    markdown: allMarkdown.join('\n\n---\n\n'),
    matches: allMatches,
    totalCount: totalCount || allMatches.length,
  };
}

// Search translation words with filter
// Word articles are GLOBAL - not scoped by testament/reference
async function searchWords(
  scopes: string[],
  scopeType: SearchScope,
  filter: string,
  language: string,
  organization: string
): Promise<ResourceSearchResult> {
  const allMatches: SearchMatch[] = [];
  const allMarkdown: string[] = [];

  // Word articles are global - make a single request without testament/reference params
  // Only use filter, language, organization
  const params = new URLSearchParams();
  params.set('filter', filter);
  params.set('language', language);
  params.set('organization', organization);
  
  const url = `${MCP_BASE_URL}/api/fetch-translation-word?${params.toString()}`;
  
  console.log(`[search-agent] Words search (global): ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[search-agent] Words search failed: ${response.status}`);
      return { markdown: '', matches: [], totalCount: 0 };
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      if (data.matches && Array.isArray(data.matches)) {
        for (const item of data.matches) {
          allMatches.push({
            reference: item.term || item.reference || filter,
            text: item.definition || item.content || '',
          });
        }
      } else if (data.term || data.definition) {
        allMatches.push({
          reference: data.term || filter,
          text: data.definition || data.content || '',
        });
        allMarkdown.push(`## ${data.term || filter}\n\n${data.definition || data.content || ''}`);
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        allMarkdown.push(text);
        allMatches.push({
          reference: filter,
          text: text.trim(),
        });
      }
    }
  } catch (error) {
    console.error(`[search-agent] Error searching words:`, error);
  }

  return {
    markdown: allMarkdown.join('\n\n'),
    matches: allMatches,
    totalCount: allMatches.length,
  };
}

serve(async (req) => {
  const startMs = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: SearchRequest = await req.json();
    const { 
      query, 
      scope = 'Bible', 
      resourceTypes = ['scripture', 'notes', 'questions', 'words'],
      language = 'en',
      organization = 'unfoldingWord',
      resource = 'ult'
    } = request;

    console.log(`[search-agent] Search request: query="${query}", scope="${scope}", types=${resourceTypes.join(',')}`);

    const scopeType = detectScopeType(scope);
    const normalizedScopes = normalizeScopes(scope, scopeType);
    
    console.log(`[search-agent] Scope type: ${scopeType}, normalized scopes: ${normalizedScopes.join(', ')}`);

    const toolCalls: Array<{ tool: string; args: Record<string, any> }> = [];
    const searchPromises: Promise<[string, ResourceSearchResult]>[] = [];

    if (resourceTypes.includes('scripture')) {
      searchPromises.push(
        searchScripture(normalizedScopes, scopeType, query, language, organization, resource)
          .then(r => ['scripture', r] as [string, ResourceSearchResult])
      );
    }

    if (resourceTypes.includes('notes')) {
      searchPromises.push(
        searchNotes(normalizedScopes, scopeType, query, language, organization)
          .then(r => ['notes', r] as [string, ResourceSearchResult])
      );
    }

    if (resourceTypes.includes('questions')) {
      searchPromises.push(
        searchQuestions(normalizedScopes, scopeType, query, language, organization)
          .then(r => ['questions', r] as [string, ResourceSearchResult])
      );
    }

    if (resourceTypes.includes('words')) {
      searchPromises.push(
        searchWords(normalizedScopes, scopeType, query, language, organization)
          .then(r => ['words', r] as [string, ResourceSearchResult])
      );
    }

    toolCalls.push({
      tool: 'search-agent',
      args: { query, scope, resourceTypes, language, organization, resource },
    });

    const results = await Promise.all(searchPromises);
    
    const endMs = Date.now();
    
    const response: SearchResponse = {
      query,
      scope,
      scopeType,
      scripture: null,
      notes: null,
      questions: null,
      words: null,
      toolCalls,
      _timing: { startMs, endMs, durationMs: endMs - startMs },
    };

    for (const [type, result] of results) {
      if (result.matches.length > 0 || result.markdown.trim()) {
        (response as any)[type] = result;
      }
    }

    const summary = [
      response.scripture ? `scripture:${response.scripture.totalCount}` : null,
      response.notes ? `notes:${response.notes.totalCount}` : null,
      response.questions ? `questions:${response.questions.totalCount}` : null,
      response.words ? `words:${response.words.totalCount}` : null,
    ].filter(Boolean).join(', ');
    
    console.log(`[search-agent] Results: ${summary || 'none'} (${endMs - startMs}ms)`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[search-agent] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
