import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

interface ScriptureRequest {
  reference: string;
  language?: string;
  organization?: string;
  resource?: string;
}

interface ScriptureVerse {
  verse: number;
  text: string;
}

interface ScriptureResponse {
  reference: string;
  text: string;
  verses: ScriptureVerse[];
  translation: string;
  book?: string;
  metadata?: Record<string, any>;
  _timing?: { startMs: number; endMs: number; durationMs: number };
}

// Detect if reference is testament-level
function isTestamentScope(reference: string): boolean {
  const normalized = reference.toLowerCase().trim();
  return ['ot', 'nt', 'old testament', 'new testament'].includes(normalized);
}

serve(async (req) => {
  const startMs = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ScriptureRequest = await req.json();
    const {
      reference,
      language = 'en',
      organization = 'unfoldingWord',
      resource = 'ult',
    } = request;

    console.log(`[scripture-agent] Fetching: ${reference} (${language}/${organization}/${resource})`);

    // Build URL with correct parameter (testament vs reference)
    let url = `${MCP_BASE_URL}/api/fetch-scripture?`;
    
    if (isTestamentScope(reference)) {
      url += `testament=${encodeURIComponent(reference.toUpperCase())}`;
    } else {
      url += `reference=${encodeURIComponent(reference)}`;
    }
    
    url += `&language=${encodeURIComponent(language)}`;
    url += `&organization=${encodeURIComponent(organization)}`;
    url += `&resource=${encodeURIComponent(resource)}`;

    console.log(`[scripture-agent] URL: ${url}`);

    const response = await fetch(url);
    const endMs = Date.now();

    if (!response.ok) {
      console.log(`[scripture-agent] MCP returned ${response.status}`);
      return new Response(JSON.stringify({
        error: `Scripture not found: ${response.status}`,
        reference,
        _timing: { startMs, endMs, durationMs: endMs - startMs },
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    let result: ScriptureResponse;

    if (contentType.includes('application/json')) {
      const data = await response.json();
      result = {
        reference,
        text: data.text || data.passage || data.content || '',
        verses: data.verses || [],
        translation: resource,
        book: data.book,
        metadata: data.metadata,
        _timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    } else {
      const text = await response.text();
      result = {
        reference,
        text,
        verses: [],
        translation: resource,
        _timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }

    console.log(`[scripture-agent] Success: ${result.verses.length} verses (${endMs - startMs}ms)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[scripture-agent] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
