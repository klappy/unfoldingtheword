import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

type ResourceType = 'notes' | 'questions' | 'words' | 'word-links' | 'academy';

// Check if reference is too broad for word-links (requires specific verse/chapter reference)
function isValidWordLinksScope(reference: string): boolean {
  const normalized = reference.toLowerCase().trim();
  
  // Broad scopes that don't work with word-links
  const broadScopes = ['ot', 'nt', 'bible', 'old testament', 'new testament', 'all'];
  if (broadScopes.includes(normalized)) {
    return false;
  }
  
  // Testament/collection scopes
  if (['gospels', 'pentateuch', 'pauline epistles', 'prophets', 'wisdom', 'law', 'history'].includes(normalized)) {
    return false;
  }
  
  // Must have at least a chapter number to be valid (e.g., "John 3" or "John 3:16")
  // Book-only references like "John" are too broad
  if (!/\d/.test(reference)) {
    return false;
  }
  
  return true;
}

interface ResourceRequest {
  reference: string;
  type: ResourceType | ResourceType[];
  language?: string;
  organization?: string;
  term?: string;  // For translation word lookups
}

interface Resource {
  id: string;
  type: string;
  title: string;
  content: string;
  reference?: string;
  quote?: string;
  question?: string;
  response?: string;
  term?: string;
  definition?: string;
}

interface ResourceResponse {
  reference: string;
  resources: Resource[];
  counts: Record<string, number>;
  _timing?: { startMs: number; endMs: number; durationMs: number };
}

// Fetch translation notes - request JSON format for structured note data
async function fetchNotes(reference: string, language: string, organization: string): Promise<Resource[]> {
  // Request JSON format to get structured note boundaries
  const url = `${MCP_BASE_URL}/api/fetch-translation-notes?reference=${encodeURIComponent(reference)}&language=${encodeURIComponent(language)}&organization=${encodeURIComponent(organization)}&format=json`;
  console.log(`[resource-agent] Fetching notes (JSON): ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return [];
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[resource-agent] Notes JSON response keys:`, Object.keys(data));
      
      // Handle array of notes directly
      const items = Array.isArray(data) ? data : (data.matches || data.notes || data.items || []);
      console.log(`[resource-agent] Found ${items.length} note items`);
      
      // Log first item structure to understand field names
      if (items.length > 0) {
        console.log(`[resource-agent] First note item keys:`, Object.keys(items[0]));
        console.log(`[resource-agent] First note item sample:`, JSON.stringify(items[0]).substring(0, 500));
      }
      
      return items.map((r: any, i: number) => {
        // MCP JSON format fields have capital letters: Note, Reference, Quote, ID, SupportReference, etc.
        const noteContent = r.Note || r.occurrenceNote || r.note || r.content || r.text || r.markdown || '';
        const noteRef = r.Reference || r.reference || reference;
        const noteQuote = r.Quote || r.quote || '';
        const noteId = r.ID || r.id || `tn-${i}`;
        
        return {
          id: noteId,
          type: 'translation-note',
          title: r.title || noteQuote || noteRef || reference,
          content: noteContent,
          reference: noteRef,
          quote: noteQuote,
          supportReference: r.SupportReference || r.supportReference || '',
          // Preserve raw markdown for rendering
          rawMarkdown: r.rawMarkdown || r.markdown || noteContent,
        };
      });
    } else {
      // Fallback to markdown if JSON not available
      const text = await response.text();
      console.log(`[resource-agent] Notes returned markdown (${text.length} chars), falling back to parse`);
      if (text.trim()) {
        return parseMarkdownNotes(text, reference);
      }
    }
  } catch (error) {
    console.error('[resource-agent] Error fetching notes:', error);
  }
  return [];
}

// Fetch translation questions - request JSON format
async function fetchQuestions(reference: string, language: string, organization: string): Promise<Resource[]> {
  const url = `${MCP_BASE_URL}/api/fetch-translation-questions?reference=${encodeURIComponent(reference)}&language=${encodeURIComponent(language)}&organization=${encodeURIComponent(organization)}&format=json`;
  console.log(`[resource-agent] Fetching questions (JSON): ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return [];
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[resource-agent] Questions JSON response keys:`, Object.keys(data));
      
      const items = Array.isArray(data) ? data : (data.matches || data.questions || data.items || []);
      console.log(`[resource-agent] Found ${items.length} question items`);
      
      return items.map((r: any, i: number) => ({
        id: r.id || `tq-${i}`,
        type: 'translation-question',
        title: r.question || r.title || reference,
        content: r.response || r.answer || r.content || '',
        reference: r.reference || reference,
        question: r.question,
        response: r.response || r.answer,
        rawMarkdown: r.rawMarkdown || r.markdown || '',
      }));
    } else {
      const text = await response.text();
      console.log(`[resource-agent] Questions returned markdown (${text.length} chars), falling back to parse`);
      if (text.trim()) {
        return parseMarkdownQuestions(text, reference);
      }
    }
  } catch (error) {
    console.error('[resource-agent] Error fetching questions:', error);
  }
  return [];
}

// Fetch translation word
async function fetchWord(term: string, reference?: string): Promise<Resource[]> {
  let url = `${MCP_BASE_URL}/api/fetch-translation-word?term=${encodeURIComponent(term)}`;
  if (reference) url += `&reference=${encodeURIComponent(reference)}`;
  console.log(`[resource-agent] Fetching word: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return [{
        id: data.id || `tw-${term}`,
        type: 'translation-word',
        title: data.term || term,
        content: data.definition || data.content || '',
        term: data.term || term,
        definition: data.definition,
        reference,
      }];
    } else {
      const text = await response.text();
      if (text.trim()) {
        return [{
          id: `tw-${term}`,
          type: 'translation-word',
          title: term,
          content: text.trim(),
          term,
          definition: text.trim(),
          reference,
        }];
      }
    }
  } catch (error) {
    console.error('[resource-agent] Error fetching word:', error);
  }
  return [];
}

// Fetch translation word links for a reference
async function fetchWordLinks(reference: string, language: string, organization: string): Promise<Resource[]> {
  const url = `${MCP_BASE_URL}/api/fetch-translation-word-links?reference=${encodeURIComponent(reference)}&language=${encodeURIComponent(language)}&organization=${encodeURIComponent(organization)}`;
  console.log(`[resource-agent] Fetching word links: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((r: any, i: number) => ({
          id: r.id || `twl-${i}`,
          type: 'translation-word',
          title: r.word || r.term || `Word ${i + 1}`,
          content: r.definition || r.content || '',
          reference,
          term: r.word || r.term,
        }));
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        return parseMarkdownWordLinks(text, reference);
      }
    }
  } catch (error) {
    console.error('[resource-agent] Error fetching word links:', error);
  }
  return [];
}

// Parse markdown notes
// Goal: split only on *meaningful* section headers the TN markdown uses, not every heading.
// Examples: "Front:intro", "3:intro", "3:2".
function parseMarkdownNotes(content: string, reference: string): Resource[] {
  const text = content.trim();
  if (!text) return [];

  // Extract book name from the request reference (best-effort; works for "Ruth 3", "Ruth 3:2").
  const book = reference.replace(/\s+\d.*$/, '').trim() || reference;

  const isSectionHeader = (h: string) => {
    const t = h.trim();
    if (!t) return false;
    if (/^front\s*:\s*intro$/i.test(t)) return true;
    if (/^\d+\s*:\s*intro$/i.test(t)) return true; // chapter intro
    if (/^\d+\s*:\s*\d+(?:\s*-\s*\d+)?$/.test(t)) return true; // verse or verse range
    return false;
  };

  const toReference = (header: string) => {
    const t = header.trim();
    if (/^front\s*:\s*intro$/i.test(t)) return `${book} front:intro`;
    const chapIntro = t.match(/^(\d+)\s*:\s*intro$/i);
    if (chapIntro) return `${book} ${chapIntro[1]}:intro`;
    const verse = t.match(/^(\d+)\s*:\s*(\d+(?:\s*-\s*\d+)?)$/);
    if (verse) return `${book} ${verse[1]}:${verse[2].replace(/\s+/g, '')}`;
    return reference;
  };

  const lines = text.split('\n');
  const results: Resource[] = [];

  let currentHeader: string | null = null;
  let buf: string[] = [];

  const push = () => {
    const body = buf.join('\n').trim();
    if (!body) return;
    const title = currentHeader?.trim() || reference;
    results.push({
      id: `tn-${results.length}`,
      type: 'translation-note',
      title,
      content: body,
      reference: currentHeader ? toReference(currentHeader) : reference,
    });
  };

  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.+)$/);
    if (m && isSectionHeader(m[1])) {
      // Start new section
      push();
      currentHeader = m[1];
      buf = [];
      continue;
    }

    // Skip YAML frontmatter if it exists
    if (!currentHeader && results.length === 0 && buf.length === 0 && line.trim() === '---') {
      // eat until next ---
      const idx = lines.indexOf(line);
      // (keep simple: handled by later fallback; no-op here)
    }

    buf.push(line);
  }

  push();

  // Fallback: if we couldn't find meaningful sections, return single document
  if (results.length === 0) {
    return [{
      id: 'tn-0',
      type: 'translation-note',
      reference,
      title: reference,
      content: text,
    }];
  }

  return results;
}

// Parse markdown questions
function parseMarkdownQuestions(content: string, reference: string): Resource[] {
  const questions: Resource[] = [];
  const lines = content.split('\n');
  let currentQuestion: any = null;
  
  for (const line of lines) {
    if (line.startsWith('#') || line.match(/^\d+\./)) {
      if (currentQuestion && currentQuestion.question) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        id: `tq-${questions.length}`,
        type: 'translation-question',
        reference,
        title: line.replace(/^#+\s*|\d+\.\s*/, '').trim(),
        question: line.replace(/^#+\s*|\d+\.\s*/, '').trim(),
        content: '',
      };
    } else if (currentQuestion) {
      currentQuestion.content += line + '\n';
      currentQuestion.response = (currentQuestion.response || '') + line + '\n';
    }
  }
  
  if (currentQuestion && currentQuestion.question) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

// Parse markdown word links
function parseMarkdownWordLinks(content: string, reference: string): Resource[] {
  const wordLinks: Resource[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldMatch = line.match(/\*\*([^*]+)\*\*/);
    
    if (linkMatch) {
      wordLinks.push({
        id: `twl-${wordLinks.length}`,
        type: 'translation-word',
        reference,
        title: linkMatch[1],
        content: line,
        term: linkMatch[1],
      });
    } else if (boldMatch) {
      wordLinks.push({
        id: `twl-${wordLinks.length}`,
        type: 'translation-word',
        reference,
        title: boldMatch[1],
        content: line,
        term: boldMatch[1],
      });
    }
  }
  
  return wordLinks;
}

serve(async (req) => {
  const startMs = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ResourceRequest = await req.json();
    const {
      reference,
      type,
      language = 'en',
      organization = 'unfoldingWord',
      term,
    } = request;

    const types = Array.isArray(type) ? type : [type];
    console.log(`[resource-agent] Fetching: ${types.join(',')} for ${reference}`);

    const resources: Resource[] = [];
    const counts: Record<string, number> = {};
    const fetchPromises: Promise<Resource[]>[] = [];

    for (const t of types) {
      switch (t) {
        case 'notes':
          fetchPromises.push(fetchNotes(reference, language, organization));
          break;
        case 'questions':
          fetchPromises.push(fetchQuestions(reference, language, organization));
          break;
        case 'words':
          if (term) {
            fetchPromises.push(fetchWord(term, reference));
          }
          break;
        case 'word-links':
          // Only fetch word-links for specific references (chapter or verse level)
          // Broad scopes like OT, NT, Bible cause 500 errors from MCP server
          if (isValidWordLinksScope(reference)) {
            fetchPromises.push(fetchWordLinks(reference, language, organization));
          } else {
            console.log(`[resource-agent] Skipping word-links for broad scope: ${reference}`);
          }
          break;
      }
    }

    const results = await Promise.all(fetchPromises);
    for (const result of results) {
      resources.push(...result);
    }

    // Count by type
    for (const r of resources) {
      const key = r.type.replace('translation-', '');
      counts[key] = (counts[key] || 0) + 1;
    }

    const endMs = Date.now();
    console.log(`[resource-agent] Success: ${resources.length} resources (${endMs - startMs}ms)`);

    const response: ResourceResponse = {
      reference,
      resources,
      counts,
      _timing: { startMs, endMs, durationMs: endMs - startMs },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[resource-agent] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      resources: [],
      counts: {},
      _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
