import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://translation-helps-mcp.pages.dev/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params } = await req.json();
    
    console.log(`[translation-helps-proxy] Endpoint: ${endpoint}, Params:`, params);

    // Map endpoint names to actual API paths - all use fetch- prefix
const endpointMap: Record<string, string> = {
      'fetch-scripture': 'fetch-scripture',
      'scripture': 'fetch-scripture',
      'translation-notes': 'fetch-translation-notes',
      'fetch-translation-notes': 'fetch-translation-notes',
      'notes': 'fetch-translation-notes',
      'translation-questions': 'fetch-translation-questions',
      'fetch-translation-questions': 'fetch-translation-questions',
      'questions': 'fetch-translation-questions',
      'translation-word-links': 'fetch-translation-word-links',
      'fetch-translation-word-links': 'fetch-translation-word-links',
      'word-links': 'fetch-translation-word-links',
      'translation-word': 'fetch-translation-word',
      'fetch-translation-word': 'fetch-translation-word',
      'word': 'fetch-translation-word',
      'translation-academy': 'fetch-translation-academy',
      'fetch-translation-academy': 'fetch-translation-academy',
      'academy': 'fetch-translation-academy',
      'search': 'search',
      'simple-languages': 'simple-languages',
      'get-available-books': 'get-available-books',
    };

    const actualEndpoint = endpointMap[endpoint] || endpoint;
    const url = new URL(`${API_BASE}/${actualEndpoint}`);
    
    // Add all params as query string
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log(`[translation-helps-proxy] Full URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/markdown, application/json, text/plain',
        'User-Agent': 'Lovable-Translation-App/1.0',
      },
    });

    console.log(`[translation-helps-proxy] Response status: ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[translation-helps-proxy] API error: ${response.status} - ${errorText.substring(0, 200)}`);
      return new Response(JSON.stringify({ 
        error: `API returned ${response.status}`,
        details: errorText.substring(0, 500)
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different response types
    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[translation-helps-proxy] JSON response keys:`, Object.keys(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Markdown or text response
      const text = await response.text();
      console.log(`[translation-helps-proxy] Text response length: ${text.length} chars`);
      return new Response(JSON.stringify({ content: text, format: 'markdown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[translation-helps-proxy] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
