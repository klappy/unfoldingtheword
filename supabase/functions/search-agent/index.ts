import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Scope types the search agent understands
type SearchScope = 'verse' | 'chapter' | 'book' | 'testament' | 'bible';
type ResourceType = 'scripture' | 'notes' | 'questions' | 'words' | 'academy';

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
  text: string;           // Keep for backwards compat, now equals rawMarkdown
  rawMarkdown: string;    // Raw content from MCP - render 100% of this
  metadata?: Record<string, any>;  // Full MCP response item
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
  academy: ResourceSearchResult | null;
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
        console.log(`[search-agent] Scripture JSON response keys:`, Object.keys(data));
        if (data.statistics) {
          console.log(`[search-agent] Statistics:`, JSON.stringify(data.statistics));
        }
        console.log(`[search-agent] First match:`, data.matches?.[0]);
        
        if (data.matches && Array.isArray(data.matches)) {
          for (const match of data.matches) {
            const refStr: string = match.reference || '';
            const refMatch = refStr.match(/^(.+?)\s+(\d+):(\d+)/);
            
            if (refMatch) {
              const book = refMatch[1];
              const chapter = parseInt(refMatch[2], 10);
              const verse = parseInt(refMatch[3], 10);
              const rawContent = match.rawMarkdown || match.text || match.content || '';
              
              allMatches.push({
                reference: refStr,
                book,
                chapter,
                verse,
                text: rawContent,
                rawMarkdown: rawContent,
                metadata: match,
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
              rawMarkdown: verseText,
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
// Request JSON format for structured note data with proper boundaries
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
    // Request JSON format for structured note data
    params.set('format', 'json');
    const url = `${MCP_BASE_URL}/api/fetch-translation-notes?${params.toString()}`;
    
    console.log(`[search-agent] Notes search (JSON): ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`[search-agent] Notes JSON response keys:`, Object.keys(data));
        
        // Handle different JSON response formats
        const items = Array.isArray(data) ? data : (data.matches || data.notes || data.items || []);
        console.log(`[search-agent] Found ${items.length} note items from JSON`);
        
        for (const item of items) {
          // MCP JSON fields have capital letters: Note, Reference, Quote, ID, etc.
          const rawContent = item.Note || item.rawMarkdown || item.note || item.content || item.text || '';
          const itemRef = item.Reference || item.reference || (scope || 'Bible');
          allMatches.push({
            reference: itemRef,
            text: rawContent,
            rawMarkdown: rawContent,
            metadata: item,
            matchedTerms: item.matchedTerms,
          });
        }
        
        totalCount += data.totalMatches || data.total || items.length;
      } else {
        // Fallback to markdown parsing if JSON not available
        const text = await response.text();
        console.log(`[search-agent] Notes returned markdown (${text.length} chars), falling back to parse`);
        
        if (text.trim()) {
          allMarkdown.push(text);

          // Smart TN markdown splitting: only split on meaningful section headers
          // like "Front:intro", "3:intro", "3:2".
          const book = (scope || '').replace(/\s+\d.*$/, '').trim();
          const isSectionHeader = (h: string) => {
            const t = h.trim();
            if (!t) return false;
            if (/^front\s*:\s*intro$/i.test(t)) return true;
            if (/^\d+\s*:\s*intro$/i.test(t)) return true;
            if (/^\d+\s*:\s*\d+(?:\s*-\s*\d+)?$/.test(t)) return true;
            return false;
          };
          const toReference = (header: string) => {
            const t = header.trim();
            if (/^front\s*:\s*intro$/i.test(t)) return book ? `${book} front:intro` : (scope || 'Bible');
            const chapIntro = t.match(/^(\d+)\s*:\s*intro$/i);
            if (chapIntro) return book ? `${book} ${chapIntro[1]}:intro` : (scope || 'Bible');
            const verse = t.match(/^(\d+)\s*:\s*(\d+(?:\s*-\s*\d+)?)$/);
            if (verse) return book ? `${book} ${verse[1]}:${verse[2].replace(/\s+/g, '')}` : (scope || 'Bible');
            return scope || 'Bible';
          };

          const lines = text.split('\n');
          let currentHeader: string | null = null;
          let buf: string[] = [];

          const push = () => {
            const body = buf.join('\n').trim();
            if (!body) return;
            allMatches.push({
              reference: currentHeader ? toReference(currentHeader) : (scope || 'Bible'),
              text: body,
              rawMarkdown: body,
              metadata: currentHeader ? { section: currentHeader } : undefined,
            });
            totalCount += 1;
          };

          for (const line of lines) {
            const m = line.match(/^#{1,6}\s+(.+)$/);
            if (m && isSectionHeader(m[1])) {
              push();
              currentHeader = m[1];
              buf = [];
              continue;
            }
            buf.push(line);
          }
          push();

          // If we didn't find any meaningful headers, keep as one big match.
          if (totalCount === 0 && allMatches.length === 0) {
            allMatches.push({
              reference: scope || 'Bible',
              text: text.trim(),
              rawMarkdown: text.trim(),
            });
            totalCount += 1;
          }
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
          // Pass raw markdown if available, otherwise construct Q&A format
          const rawContent = item.rawMarkdown || item.content || 
            (item.question ? `**Q:** ${item.question}\n\n**A:** ${item.response || item.answer || ''}` : '');
          allMatches.push({
            reference: item.reference || (scope || 'Bible'),
            text: rawContent,
            rawMarkdown: rawContent,
            metadata: item,
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
          const rawContent = item.rawMarkdown || item.definition || item.excerpt || item.content || '';
          allMatches.push({
            reference: item.term || item.reference || filter,
            text: rawContent,
            rawMarkdown: rawContent,
            metadata: item,
          });
        }
      } else if (data.term || data.definition || data.content) {
        const rawContent = data.rawMarkdown || data.definition || data.content || '';
        allMatches.push({
          reference: data.term || filter,
          text: rawContent,
          rawMarkdown: rawContent,
          metadata: data,
        });
        allMarkdown.push(`## ${data.term || filter}\n\n${rawContent}`);
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        allMarkdown.push(text);
        allMatches.push({
          reference: filter,
          text: text.trim(),
          rawMarkdown: text.trim(),
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

// Search translation academy articles with filter
// Academy articles are GLOBAL - not scoped by testament/reference
async function searchAcademy(
  filter: string,
  language: string,
  organization: string
): Promise<ResourceSearchResult> {
  const allMatches: SearchMatch[] = [];
  const allMarkdown: string[] = [];

  const params = new URLSearchParams();
  params.set('filter', filter);
  params.set('language', language);
  params.set('organization', organization);
  
  const url = `${MCP_BASE_URL}/api/fetch-translation-academy?${params.toString()}`;
  
  console.log(`[search-agent] Academy search (global): ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[search-agent] Academy search failed: ${response.status}`);
      return { markdown: '', matches: [], totalCount: 0 };
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      if (data.matches && Array.isArray(data.matches)) {
        for (const item of data.matches) {
          // Use excerpt first (that's where MCP puts the preview), then content
          const rawContent = item.rawMarkdown || item.excerpt || item.content || '';
          allMatches.push({
            reference: item.moduleId || item.title || item.article || filter,
            text: rawContent,
            rawMarkdown: rawContent,
            metadata: item,
          });
        }
      } else if (data.title || data.content || data.excerpt) {
        const rawContent = data.rawMarkdown || data.excerpt || data.content || '';
        allMatches.push({
          reference: data.moduleId || data.title || data.article || filter,
          text: rawContent,
          rawMarkdown: rawContent,
          metadata: data,
        });
        allMarkdown.push(`## ${data.title || filter}\n\n${rawContent}`);
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        allMarkdown.push(text);
        // Parse sections from markdown
        const lines = text.split('\n');
        let lastRef = '';
        let currentContent = '';
        
        for (const line of lines) {
          const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
          if (headerMatch) {
            if (lastRef && currentContent.trim()) {
              const rawContent = currentContent.trim();
              allMatches.push({
                reference: lastRef,
                text: rawContent,
                rawMarkdown: rawContent,
              });
            }
            lastRef = headerMatch[1].trim();
            currentContent = '';
          } else if (lastRef) {
            currentContent += line + '\n';
          }
        }
        if (lastRef && currentContent.trim()) {
          const rawContent = currentContent.trim();
          allMatches.push({
            reference: lastRef,
            text: rawContent,
            rawMarkdown: rawContent,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[search-agent] Error searching academy:`, error);
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
      resourceTypes = ['scripture', 'notes', 'questions', 'words', 'academy'],
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

    if (resourceTypes.includes('academy')) {
      searchPromises.push(
        searchAcademy(query, language, organization)
          .then(r => ['academy', r] as [string, ResourceSearchResult])
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
      academy: null,
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
      response.academy ? `academy:${response.academy.totalCount}` : null,
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
