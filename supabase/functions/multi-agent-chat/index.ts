import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// System prompt for conversational AI
const CONVERSATIONAL_SYSTEM_PROMPT = `You are a Bible study resource finder. You speak naturally and conversationally.

CRITICAL RULES:
- You ONLY share information from the resources provided below
- You NEVER answer from your own knowledge or training data
- If no resources are provided, say "I couldn't find resources on that topic"
- Keep responses brief: 2-4 sentences

RESOURCE NAMES:
- ULT = "UnfoldingWord® Literal Text (ULT)"
- UST = "UnfoldingWord® Simplified Text (UST)"

WHAT YOU MUST NOT DO:
- Never interpret scripture or give theological opinions
- Never make up content if no resources are provided
- Never say specific counts unless the data shows them`;

// List of Bible book patterns for reference detection
const BIBLE_BOOKS = [
  'genesis', 'gen', 'exodus', 'ex', 'leviticus', 'lev', 'numbers', 'num', 
  'deuteronomy', 'deut', 'joshua', 'josh', 'judges', 'ruth',
  '1 samuel', '2 samuel', '1 kings', '2 kings', '1 chronicles', '2 chronicles',
  'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'psalm', 'ps', 'proverbs', 'prov',
  'ecclesiastes', 'song of solomon', 'isaiah', 'isa', 'jeremiah', 'jer',
  'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah',
  'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
  'matthew', 'matt', 'mark', 'luke', 'john', 'acts', 'romans', 'rom',
  '1 corinthians', '2 corinthians', 'galatians', 'ephesians', 'philippians',
  'colossians', '1 thessalonians', '2 thessalonians', '1 timothy', '2 timothy',
  'titus', 'philemon', 'hebrews', 'james', '1 peter', '2 peter',
  '1 john', '2 john', '3 john', 'jude', 'revelation', 'rev',
  // Spanish
  'génesis', 'éxodo', 'levítico', 'números', 'deuteronomio', 'josué', 'jueces', 'rut',
  'salmos', 'proverbios', 'eclesiastés', 'cantares', 'isaías', 'jeremías', 'ezequiel',
  'mateo', 'marcos', 'lucas', 'juan', 'hechos', 'romanos', 'apocalipsis',
  // Portuguese
  'gênesis', 'êxodo', 'salmos', 'provérbios', 'mateus', 'joão', 'atos',
];

// Extract scripture reference from a message
// "Show me Ruth 3:2" → "Ruth 3:2"
// "Read John 3:16" → "John 3:16"
// "John 3:16" → "John 3:16"
function extractScriptureReference(message: string): string | null {
  const lower = message.toLowerCase();
  
  // Try to find a book name in the message
  for (const book of BIBLE_BOOKS) {
    const bookIndex = lower.indexOf(book);
    if (bookIndex !== -1) {
      // Extract from book name onwards
      const restOfMessage = message.substring(bookIndex);
      // Match book + optional chapter + optional verse
      const match = restOfMessage.match(/^[\w\sáéíóúüñâêôãõç]+\s*\d+(?:\s*:\s*\d+(?:\s*-\s*\d+)?)?/i);
      if (match) {
        return match[0].trim();
      }
      // Just book name
      const bookMatch = restOfMessage.match(/^[\w\sáéíóúüñâêôãõç]+/i);
      if (bookMatch) {
        const cleanBook = bookMatch[0].trim();
        // Make sure it's not just a partial word
        if (BIBLE_BOOKS.includes(cleanBook.toLowerCase())) {
          return cleanBook;
        }
      }
    }
  }
  
  return null;
}

// Detect if input starts with a scripture reference (for direct navigation)
function startsWithScriptureReference(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim().toLowerCase();
  return BIBLE_BOOKS.some(book => trimmed === book || trimmed.startsWith(book + ' '));
}

// Parse search query to extract term and scope
function parseSearchQuery(message: string): { query: string; scope: string } {
  const patterns = [
    // "notes about X in Book" or "notes on X in Book"
    /(?:notes?|translation notes?)\s+(?:about|on|for)\s+["']?([^"']+?)["']?\s+(?:in|from|within)\s+(.+)/i,
    // "find X in Book"
    /(?:find|search|locate|where is)\s+["']?([^"']+?)["']?\s+(?:in|within|across)\s+(.+)/i,
    // "X in Book"
    /["']([^"']+)["']\s+(?:in|within|across)\s+(.+)/i,
    // Spanish
    /(?:buscar?|encontrar?|dónde está)\s+["']?([^"']+?)["']?\s+(?:en)\s+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return { query: match[1].trim(), scope: match[2].trim() };
    }
  }
  
  // Fallback: use key terms and default scope
  const words = message.split(/\s+/).filter(w => 
    w.length > 2 && !['find', 'search', 'show', 'me', 'the', 'in', 'a', 'notes', 'about', 'from'].includes(w.toLowerCase())
  );
  
  return { query: words.join(' ') || message, scope: 'Bible' };
}

// Classify user intent
async function classifyIntent(message: string, apiKey: string): Promise<'locate' | 'understand' | 'read' | 'note'> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `Classify intent. Respond with ONLY one word:
- "locate" = find WHERE a word appears OR find notes/resources containing a word (e.g., "find love in Romans", "notes about Boaz in Ruth")
- "understand" = learn ABOUT a concept (e.g., "what is justification", "explain redemption")
- "read" = read specific scripture (e.g., "John 3:16", "read Romans 8")
- "note" = manage PERSONAL notes (e.g., "show my notes", "create a note", "delete note")`
        }, {
          role: "user",
          content: message
        }],
        max_tokens: 10,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const intent = data.choices?.[0]?.message?.content?.toLowerCase().trim();
      if (['locate', 'understand', 'note'].includes(intent)) {
        return intent as 'locate' | 'understand' | 'note';
      }
    }
  } catch (error) {
    console.error("[multi-agent-chat] Intent classification error:", error);
  }
  return 'read';
}

// Dispatch to sub-agent
async function invokeSubAgent(name: string, body: any): Promise<any> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  console.log(`[multi-agent-chat] Dispatching to ${name}:`, JSON.stringify(body).substring(0, 100));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      console.error(`[multi-agent-chat] ${name} returned ${response.status}`);
      const text = await response.text();
      console.error(`[multi-agent-chat] ${name} error:`, text);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[multi-agent-chat] Error invoking ${name}:`, error);
    return null;
  }
}

// Generate streaming AI response
async function* generateStreamingResponse(
  userMessage: string,
  context: { scriptureText?: string; resources?: any[]; searchMatches?: any[] },
  responseLanguage: string,
  conversationHistory: any[]
): AsyncGenerator<string, void, unknown> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const isEnglish = !responseLanguage || responseLanguage.toLowerCase() === 'en';
  const langInstruction = isEnglish ? '' : `\n\nRespond ENTIRELY in ${responseLanguage}.`;

  const resourceContext = `
AVAILABLE RESOURCES:
${context.scriptureText ? `SCRIPTURE:\n${context.scriptureText.substring(0, 2000)}\n` : ''}
${context.resources?.length ? `RESOURCES (${context.resources.length}):\n${context.resources.slice(0, 5).map(r => `- ${r.title || r.reference}: ${(r.content || '').substring(0, 150)}...`).join('\n')}\n` : ''}
${context.searchMatches?.length ? `SEARCH MATCHES (${context.searchMatches.length}):\n${context.searchMatches.slice(0, 10).map(m => `- ${m.book || ''} ${m.chapter || ''}:${m.verse || ''}: ${m.text?.substring(0, 80)}...`).join('\n')}\n` : ''}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `${CONVERSATIONAL_SYSTEM_PROMPT}\n\n${resourceContext}${langInstruction}` },
        ...conversationHistory.slice(-4),
        { role: "user", content: userMessage }
      ],
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

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
      if (jsonStr === "[DONE]") return;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

// Strip markdown for voice
function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/```[^`]*```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      conversationHistory = [], 
      scriptureContext, 
      responseLanguage = 'en',
      stream = true,
      isVoiceRequest = false,
      userPrefs = {}
    } = await req.json();
    
    console.log(`[multi-agent-chat] Message: "${message}"`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const prefs = {
      language: userPrefs.language || 'en',
      organization: userPrefs.organization || 'unfoldingWord',
      resource: userPrefs.resource || 'ult',
      deviceId: userPrefs.deviceId,
    };

    let scriptureText: string | null = null;
    let scriptureReference: string | null = null;
    let resources: any[] = [];
    let searchMatches: any[] = [];
    let navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null = null;
    let toolCalls: Array<{ tool: string; args: any }> = [];

    // Step 1: Check if message starts with a direct scripture reference
    const isDirectReference = startsWithScriptureReference(message);
    
    // Step 2: Try to extract a scripture reference from the message
    const extractedRef = extractScriptureReference(message);
    console.log(`[multi-agent-chat] Direct ref: ${isDirectReference}, Extracted: ${extractedRef}`);

    if (isDirectReference && extractedRef) {
      // Direct scripture navigation - fetch scripture and resources
      console.log(`[multi-agent-chat] Direct reference: ${extractedRef}`);
      
      const [scriptureResult, resourceResult] = await Promise.all([
        invokeSubAgent('scripture-agent', {
          reference: extractedRef,
          language: prefs.language,
          organization: prefs.organization,
          resource: prefs.resource,
        }),
        invokeSubAgent('resource-agent', {
          reference: extractedRef,
          type: ['notes', 'questions', 'word-links'],
          language: prefs.language,
          organization: prefs.organization,
        }),
      ]);

      if (scriptureResult?.text) {
        scriptureText = scriptureResult.text;
        scriptureReference = extractedRef;
        toolCalls.push({ tool: 'scripture-agent', args: { reference: extractedRef } });
      }
      if (resourceResult?.resources) {
        resources = resourceResult.resources;
        toolCalls.push({ tool: 'resource-agent', args: { reference: extractedRef, type: ['notes', 'questions', 'word-links'] } });
      }
      navigationHint = 'scripture';

    } else {
      // Non-direct reference - classify intent
      const intent = await classifyIntent(message, OPENAI_API_KEY);
      console.log(`[multi-agent-chat] Intent: ${intent}`);

      if (intent === 'locate' || intent === 'understand') {
        // Search via search-agent for discovery queries
        const { query, scope } = parseSearchQuery(message);
        console.log(`[multi-agent-chat] Search: query="${query}", scope="${scope}"`);
        
        const searchResult = await invokeSubAgent('search-agent', {
          query,
          scope,
          resourceTypes: ['scripture', 'notes', 'questions', 'words'],
          language: prefs.language,
          organization: prefs.organization,
          resource: prefs.resource,
        });

        if (searchResult) {
          toolCalls.push({ tool: 'search-agent', args: { query, scope } });
          scriptureReference = scope;
          
          if (searchResult.scripture?.matches) {
            searchMatches = searchResult.scripture.matches;
            scriptureText = searchResult.scripture.markdown;
          }
          if (searchResult.notes?.matches) {
            resources.push(...searchResult.notes.matches.map((m: any) => ({
              type: 'translation-note',
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (searchResult.questions?.matches) {
            resources.push(...searchResult.questions.matches.map((m: any) => ({
              type: 'translation-question',
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          if (searchResult.words?.matches) {
            resources.push(...searchResult.words.matches.map((m: any) => ({
              type: 'translation-word',
              title: m.reference,
              content: m.text,
              reference: m.reference,
            })));
          }
          navigationHint = 'search';
        }

      } else if (intent === 'note') {
        // Personal note management via note-agent
        if (!prefs.deviceId) {
          console.log(`[multi-agent-chat] Note intent but no deviceId`);
          // Can't manage notes without deviceId
        } else {
          const noteResult = await invokeSubAgent('note-agent', {
            action: 'read',
            device_id: prefs.deviceId,
            scope: 'all',
            limit: 10,
          });

          if (noteResult?.notes) {
            resources = noteResult.notes.map((n: any) => ({
              type: 'note',
              title: n.source_reference || 'Note',
              content: n.content,
              reference: n.source_reference,
            }));
            toolCalls.push({ tool: 'note-agent', args: { action: 'read' } });
          }
        }
        navigationHint = 'notes';

      } else {
        // Read intent - try to extract and fetch scripture reference
        if (extractedRef) {
          console.log(`[multi-agent-chat] Read intent with extracted ref: ${extractedRef}`);
          
          const [scriptureResult, resourceResult] = await Promise.all([
            invokeSubAgent('scripture-agent', {
              reference: extractedRef,
              language: prefs.language,
              organization: prefs.organization,
              resource: prefs.resource,
            }),
            invokeSubAgent('resource-agent', {
              reference: extractedRef,
              type: ['notes', 'questions', 'word-links'],
              language: prefs.language,
              organization: prefs.organization,
            }),
          ]);

          if (scriptureResult?.text) {
            scriptureText = scriptureResult.text;
            scriptureReference = extractedRef;
            toolCalls.push({ tool: 'scripture-agent', args: { reference: extractedRef } });
            navigationHint = 'scripture';
          }
          if (resourceResult?.resources) {
            resources = resourceResult.resources;
            toolCalls.push({ tool: 'resource-agent', args: { reference: extractedRef, type: ['notes', 'questions', 'word-links'] } });
          }
        } else if (scriptureContext) {
          // Use existing scripture context
          console.log(`[multi-agent-chat] Using scripture context: ${scriptureContext}`);
          scriptureReference = scriptureContext;
        }
      }
    }

    console.log(`[multi-agent-chat] Results: scripture=${!!scriptureText}, resources=${resources.length}, matches=${searchMatches.length}, nav=${navigationHint}`);

    // Build response
    if (stream) {
      const encoder = new TextEncoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first
            const metadata = {
              type: 'metadata',
              scripture_reference: scriptureReference,
              tool_calls: toolCalls,
              navigation_hint: navigationHint,
              search_matches: searchMatches,
              search_resource: prefs.resource,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));
            
            // Stream AI response
            let fullContent = '';
            const generator = generateStreamingResponse(
              message,
              { scriptureText: scriptureText || undefined, resources, searchMatches },
              responseLanguage,
              conversationHistory
            );
            
            for await (const chunk of generator) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
            }
            
            if (isVoiceRequest) {
              const voiceResponse = stripMarkdownForVoice(fullContent);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'voice_response', content: voiceResponse })}\n\n`));
            }
            
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("[multi-agent-chat] Streaming error:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    }

    // Non-streaming response
    let content = "";
    const generator = generateStreamingResponse(
      message,
      { scriptureText: scriptureText || undefined, resources, searchMatches },
      responseLanguage,
      conversationHistory
    );
    
    for await (const chunk of generator) {
      content += chunk;
    }

    return new Response(JSON.stringify({
      scripture_reference: scriptureReference,
      content,
      voice_response: stripMarkdownForVoice(content),
      navigation_hint: navigationHint,
      search_matches: searchMatches,
      tool_calls: toolCalls,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[multi-agent-chat] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
