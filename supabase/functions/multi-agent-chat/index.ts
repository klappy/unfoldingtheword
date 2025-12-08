import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Tool definitions for MCP resource fetching
const mcpTools = [
  {
    type: "function",
    function: {
      name: "search_resources",
      description: "Search for translation resources (notes, questions, word studies, academy articles) by topic or scripture reference",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query - can be a topic, scripture reference, or keyword" },
          resource_types: { 
            type: "array", 
            items: { type: "string", enum: ["tn", "tq", "tw", "ta"] },
            description: "Resource types to search: tn=translation notes, tq=translation questions, tw=translation words, ta=translation academy"
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_scripture_passage",
      description: "Get the text of a specific scripture passage",
      parameters: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Scripture reference like 'John 3:16' or 'Romans 8:1-4'" }
        },
        required: ["reference"],
        additionalProperties: false
      }
    }
  }
];

// Fetch resources from MCP server using SEARCH endpoint (for keyword searches)
async function fetchMcpResourcesSearch(query: string, resourceTypes: string[] = ['tn', 'tq', 'tw', 'ta']): Promise<any[]> {
  const results: any[] = [];
  
  for (const resourceType of resourceTypes) {
    try {
      const url = `${MCP_BASE_URL}/api/search?query=${encodeURIComponent(query)}&resource=${resourceType}`;
      console.log(`Searching MCP resources: ${url}`);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.hits && Array.isArray(data.hits)) {
          results.push(...data.hits.map((r: any) => ({ ...r, resourceType })));
        }
      } else {
        console.log(`MCP search returned ${response.status} for ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error searching ${resourceType} resources:`, error);
    }
  }
  
  return results;
}

// Fetch verse-specific resources from MCP server using FETCH endpoints (for scripture references)
async function fetchVerseResources(reference: string): Promise<any[]> {
  const results: any[] = [];
  
  // Fetch translation notes
  try {
    const notesUrl = `${MCP_BASE_URL}/api/fetch-translation-notes?reference=${encodeURIComponent(reference)}`;
    console.log(`Fetching translation notes: ${notesUrl}`);
    const notesResponse = await fetch(notesUrl);
    if (notesResponse.ok) {
      const contentType = notesResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await notesResponse.json();
        if (Array.isArray(data)) {
          results.push(...data.map((r: any) => ({ ...r, resourceType: 'tn' })));
        }
      } else {
        const text = await notesResponse.text();
        if (text && text.trim()) {
          // Parse markdown notes
          const notes = parseMarkdownNotes(text, reference);
          results.push(...notes.map((n: any) => ({ ...n, resourceType: 'tn' })));
        }
      }
    }
  } catch (error) {
    console.error('Error fetching translation notes:', error);
  }

  // Fetch translation questions
  try {
    const questionsUrl = `${MCP_BASE_URL}/api/fetch-translation-questions?reference=${encodeURIComponent(reference)}`;
    console.log(`Fetching translation questions: ${questionsUrl}`);
    const questionsResponse = await fetch(questionsUrl);
    if (questionsResponse.ok) {
      const contentType = questionsResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await questionsResponse.json();
        if (Array.isArray(data)) {
          results.push(...data.map((r: any) => ({ ...r, resourceType: 'tq' })));
        }
      } else {
        const text = await questionsResponse.text();
        if (text && text.trim()) {
          const questions = parseMarkdownQuestions(text, reference);
          results.push(...questions.map((q: any) => ({ ...q, resourceType: 'tq' })));
        }
      }
    }
  } catch (error) {
    console.error('Error fetching translation questions:', error);
  }

  // Fetch word links
  try {
    const wordLinksUrl = `${MCP_BASE_URL}/api/fetch-translation-word-links?reference=${encodeURIComponent(reference)}`;
    console.log(`Fetching word links: ${wordLinksUrl}`);
    const wordLinksResponse = await fetch(wordLinksUrl);
    if (wordLinksResponse.ok) {
      const contentType = wordLinksResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await wordLinksResponse.json();
        if (Array.isArray(data)) {
          results.push(...data.map((r: any) => ({ ...r, resourceType: 'tw' })));
        }
      } else {
        const text = await wordLinksResponse.text();
        if (text && text.trim()) {
          const wordLinks = parseMarkdownWordLinks(text, reference);
          results.push(...wordLinks.map((w: any) => ({ ...w, resourceType: 'tw' })));
        }
      }
    }
  } catch (error) {
    console.error('Error fetching word links:', error);
  }

  console.log(`Fetched ${results.length} verse-specific resources for ${reference}`);
  return results;
}

// Parse markdown notes into structured array
function parseMarkdownNotes(content: string, reference: string): any[] {
  const notes: any[] = [];
  // Split by note blocks (usually separated by blank lines or headers)
  const lines = content.split('\n');
  let currentNote: any = null;
  
  for (const line of lines) {
    // Check for note header pattern: # Note or ## Reference
    if (line.startsWith('#')) {
      if (currentNote && currentNote.content) {
        notes.push(currentNote);
      }
      currentNote = { 
        reference: reference,
        title: line.replace(/^#+\s*/, '').trim(),
        content: ''
      };
    } else if (currentNote) {
      currentNote.content += line + '\n';
    }
  }
  
  if (currentNote && currentNote.content) {
    notes.push(currentNote);
  }
  
  // If no structured notes found, treat whole content as one note
  if (notes.length === 0 && content.trim()) {
    notes.push({
      reference: reference,
      title: 'Translation Note',
      content: content.trim()
    });
  }
  
  return notes;
}

// Parse markdown questions
function parseMarkdownQuestions(content: string, reference: string): any[] {
  const questions: any[] = [];
  const lines = content.split('\n');
  let currentQuestion: any = null;
  
  for (const line of lines) {
    if (line.startsWith('#') || line.match(/^\d+\./)) {
      if (currentQuestion && currentQuestion.question) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        reference: reference,
        question: line.replace(/^#+\s*|\d+\.\s*/, '').trim(),
        response: ''
      };
    } else if (currentQuestion) {
      currentQuestion.response += line + '\n';
    }
  }
  
  if (currentQuestion && currentQuestion.question) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

// Parse markdown word links
function parseMarkdownWordLinks(content: string, reference: string): any[] {
  const wordLinks: any[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Match patterns like: **word** - definition or [word](link)
    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldMatch = line.match(/\*\*([^*]+)\*\*/);
    
    if (linkMatch) {
      wordLinks.push({
        reference: reference,
        word: linkMatch[1],
        articleId: linkMatch[2].split('/').pop() || linkMatch[1],
        content: line
      });
    } else if (boldMatch) {
      wordLinks.push({
        reference: reference,
        word: boldMatch[1],
        articleId: boldMatch[1].toLowerCase().replace(/\s+/g, '-'),
        content: line
      });
    }
  }
  
  return wordLinks;
}

// Detect if the user's message indicates pastoral/emotional support needs
function detectPastoralIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Keywords indicating emotional distress or support-seeking
  const pastoralKeywords = [
    'lonely', 'depressed', 'depression', 'anxious', 'anxiety', 'scared', 'afraid',
    'hurting', 'hurt', 'pain', 'suffering', 'struggling', 'lost', 'hopeless',
    'worried', 'stress', 'stressed', 'grief', 'grieving', 'mourning', 'sad', 'sadness',
    'broken', 'desperate', 'help me', 'need help', 'pray for', 'prayers',
    'dying', 'death', 'divorce', 'betrayed', 'abandoned', 'alone', 'suicide',
    'tempted', 'temptation', 'sin', 'guilt', 'shame', 'forgive', 'forgiveness',
    'angry', 'anger', 'rage', 'bitter', 'resentment', 'hate', 'hatred',
    'comfort', 'peace', 'healing', 'hope', 'strength', 'courage',
    'marriage', 'relationship', 'family', 'children', 'parents',
    'job', 'money', 'finances', 'health', 'illness', 'sick', 'disease',
    "can't go on", "don't know what to do", 'overwhelmed', 'exhausted'
  ];
  
  // Check for pastoral keywords
  for (const keyword of pastoralKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }
  
  // Patterns indicating personal struggle
  const pastoralPatterns = [
    /i('m| am) (feeling|so|very|really)\s/,
    /my (heart|soul|spirit|life)\s/,
    /what (should|do) i do/,
    /help me (understand|cope|deal|get through)/,
    /going through/,
    /i need/,
    /i feel/,
  ];
  
  for (const pattern of pastoralPatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
  }
  
  return false;
}

async function fetchScripturePassage(reference: string): Promise<string | null> {
  try {
    // Pass the reference directly to the MCP server - it handles all the mapping
    const url = `${MCP_BASE_URL}/api/fetch-scripture?reference=${encodeURIComponent(reference)}`;
    console.log(`Fetching scripture: ${url}`);
    
    const response = await fetch(url);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return data.text || data.passage || data.content || JSON.stringify(data);
      } else {
        // Markdown response
        return await response.text();
      }
    } else {
      console.log(`Scripture fetch returned ${response.status}`);
    }
  } catch (error) {
    console.error('Error fetching scripture:', error);
  }
  return null;
}

// Detect if input is a scripture reference (book, chapter, verse patterns)
// Must be specific - require known book names or book+chapter patterns
function isScriptureReference(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  
  // List of known Bible book names (and common abbreviations) - English + Spanish + Portuguese
  const bibleBooks = [
    // English
    'genesis', 'gen', 'exodus', 'exod', 'ex', 'leviticus', 'lev', 'numbers', 'num', 
    'deuteronomy', 'deut', 'joshua', 'josh', 'judges', 'judg', 'ruth', 
    '1 samuel', '2 samuel', '1samuel', '2samuel', '1sam', '2sam', '1 sam', '2 sam',
    '1 kings', '2 kings', '1kings', '2kings', '1kgs', '2kgs', '1 kgs', '2 kgs',
    '1 chronicles', '2 chronicles', '1chronicles', '2chronicles', '1chr', '2chr', '1 chr', '2 chr',
    'ezra', 'nehemiah', 'neh', 'esther', 'esth', 'job', 
    'psalms', 'psalm', 'ps', 'proverbs', 'prov', 'ecclesiastes', 'eccl', 'eccles',
    'song of solomon', 'song', 'sos', 'isaiah', 'isa', 'jeremiah', 'jer',
    'lamentations', 'lam', 'ezekiel', 'ezek', 'daniel', 'dan',
    'hosea', 'hos', 'joel', 'amos', 'obadiah', 'obad', 'jonah', 'jon',
    'micah', 'mic', 'nahum', 'nah', 'habakkuk', 'hab', 'zephaniah', 'zeph',
    'haggai', 'hag', 'zechariah', 'zech', 'malachi', 'mal',
    'matthew', 'matt', 'mt', 'mark', 'mk', 'luke', 'lk', 'john', 'jn',
    'acts', 'romans', 'rom', 
    '1 corinthians', '2 corinthians', '1corinthians', '2corinthians', '1cor', '2cor', '1 cor', '2 cor',
    'galatians', 'gal', 'ephesians', 'eph', 'philippians', 'phil', 'php',
    'colossians', 'col', '1 thessalonians', '2 thessalonians', '1thess', '2thess', '1 thess', '2 thess',
    '1 timothy', '2 timothy', '1timothy', '2timothy', '1tim', '2tim', '1 tim', '2 tim',
    'titus', 'tit', 'philemon', 'phlm', 'hebrews', 'heb',
    'james', 'jas', '1 peter', '2 peter', '1peter', '2peter', '1pet', '2pet', '1 pet', '2 pet',
    '1 john', '2 john', '3 john', '1john', '2john', '3john', '1jn', '2jn', '3jn',
    'jude', 'revelation', 'rev',
    // Spanish book names
    'génesis', 'gén', 'éxodo', 'éx', 'levítico', 'lv', 'números', 'nm', 
    'deuteronomio', 'dt', 'josué', 'jos', 'jueces', 'jue', 'rut',
    '1 samuel', '2 samuel', '1 reyes', '2 reyes', '1 crónicas', '2 crónicas',
    'esdras', 'esd', 'nehemías', 'ne', 'ester', 'est', 
    'salmos', 'sal', 'proverbios', 'pr', 'eclesiastés', 'ec',
    'cantares', 'cantar', 'isaías', 'is', 'jeremías', 'jer',
    'lamentaciones', 'lm', 'ezequiel', 'ez', 
    'oseas', 'os', 'amós', 'am', 'abdías', 'ab', 'jonás', 'jon',
    'miqueas', 'mi', 'nahúm', 'na', 'habacuc', 'hab', 'sofonías', 'sof',
    'hageo', 'ag', 'zacarías', 'zac', 'malaquías', 'mal',
    'mateo', 'mt', 'marcos', 'mc', 'lucas', 'lc', 'juan', 'jn',
    'hechos', 'hch', 'romanos', 'ro', 
    '1 corintios', '2 corintios', '1co', '2co',
    'gálatas', 'gl', 'efesios', 'ef', 'filipenses', 'flp',
    'colosenses', 'col', '1 tesalonicenses', '2 tesalonicenses',
    '1 timoteo', '2 timoteo', 'tito', 'ti', 'filemón', 'flm', 'hebreos', 'he',
    'santiago', 'stg', '1 pedro', '2 pedro', '1p', '2p',
    '1 juan', '2 juan', '3 juan', 'judas', 'apocalipsis', 'ap',
    // Portuguese book names
    'gênesis', 'êxodo', 'levítico', 'números', 'deuteronômio',
    'josué', 'juízes', 'rute',
    '1 samuel', '2 samuel', '1 reis', '2 reis', '1 crônicas', '2 crônicas',
    'neemias', 'ester', 'jó', 
    'salmos', 'provérbios', 'eclesiastes', 
    'cânticos', 'isaías', 'jeremias', 'lamentações', 'ezequiel',
    'oséias', 'amós', 'obadias', 'jonas', 'miquéias', 'naum',
    'habacuque', 'sofonias', 'ageu', 'zacarias', 'malaquias',
    'mateus', 'marcos', 'joão',
    'atos', 'romanos', '1 coríntios', '2 coríntios',
    'gálatas', 'efésios', 'filipenses', 'colossenses',
    '1 tessalonicenses', '2 tessalonicenses',
    '1 timóteo', '2 timóteo', 'filemon', 'hebreus',
    'tiago', '1 pedro', '2 pedro', '1 joão', '2 joão', '3 joão',
    'judas', 'apocalipse'
  ];
  
  // Check if input starts with a known book name
  const startsWithBook = bibleBooks.some(book => {
    return trimmed === book || 
           trimmed.startsWith(book + ' ') || 
           trimmed.startsWith(book + ':');
  });
  
  // Also match patterns like "Book Chapter" or "Book Chapter:Verse"
  const bookChapterPattern = /^(\d?\s*[a-záéíóúüñâêôãõç]+)\s+(\d+)(\s*:\s*\d+(-\d+)?)?$/i;
  const matchesPattern = bookChapterPattern.test(trimmed);
  
  // Only consider it a scripture reference if it matches a known book
  return startsWithBook || (matchesPattern && bibleBooks.some(book => trimmed.toLowerCase().startsWith(book.split(' ')[0])));
}

// Direct scripture/resource fetch without AI (for scripture references)
async function fetchDirectResources(reference: string): Promise<{
  resources: any[],
  scriptureText: string | null,
  scriptureReference: string,
  searchQuery: string | null
}> {
  console.log(`Direct fetch for scripture reference: ${reference}`);
  
  // Fetch verse-specific resources and scripture in parallel
  const [resources, scriptureText] = await Promise.all([
    fetchVerseResources(reference),
    fetchScripturePassage(reference)
  ]);
  
  return {
    resources,
    scriptureText,
    scriptureReference: reference,
    searchQuery: null // Not a search, just a direct reference
  };
}

// Process tool calls from AI response
async function processToolCalls(toolCalls: any[]): Promise<{ resources: any[], scriptureText: string | null }> {
  const resources: any[] = [];
  let scriptureText: string | null = null;
  
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    console.log(`Processing tool call: ${functionName}`, args);
    
    if (functionName === 'search_resources') {
      const results = await fetchMcpResourcesSearch(args.query, args.resource_types);
      resources.push(...results);
    } else if (functionName === 'get_scripture_passage') {
      scriptureText = await fetchScripturePassage(args.reference);
    }
  }
  
  return { resources, scriptureText };
}

// Call Lovable AI with tool calling for keyword/topic searches
async function callAIWithTools(userMessage: string, conversationHistory: any[], scriptureContext?: string): Promise<{
  resources: any[],
  scriptureText: string | null,
  scriptureReference: string | null,
  searchQuery: string | null
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const systemPrompt = `You are a Bible study assistant. Your job is to find relevant resources to answer user questions about topics and keywords.

IMPORTANT: You must ALWAYS use the provided tools to search for resources before answering. Never answer from your own knowledge - only from MCP resources.

Available tools:
- search_resources: Search for translation notes, questions, word studies, and academy articles
- get_scripture_passage: Get the text of a scripture passage (only if user mentions one)

The user is searching for a topic or keyword. Use search_resources to find relevant translation resources.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: "user", content: `${userMessage}${scriptureContext ? `\n\nCurrent context: ${scriptureContext}` : ''}` }
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: mcpTools,
      tool_choice: "auto",
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  
  console.log("AI response with tools:", JSON.stringify(message, null, 2));

  let resources: any[] = [];
  let scriptureText: string | null = null;
  let scriptureReference: string | null = null;
  let searchQuery: string | null = null;

  // Process tool calls if present
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const result = await processToolCalls(message.tool_calls);
    resources = result.resources;
    scriptureText = result.scriptureText;
    
    // Extract reference and query from tool calls
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === 'get_scripture_passage') {
        scriptureReference = args.reference;
      }
      if (toolCall.function.name === 'search_resources') {
        searchQuery = args.query;
      }
    }
  } else {
    // Fallback: do a basic search with the user's message
    console.log("No tool calls, falling back to direct search");
    resources = await fetchMcpResourcesSearch(userMessage);
    searchQuery = userMessage;
  }

  return { resources, scriptureText, scriptureReference, searchQuery };
}

// Generate a streaming response based on fetched resources
async function* generateStreamingResponse(
  userMessage: string,
  resources: any[],
  scriptureText: string | null,
  responseLanguage: string,
  conversationHistory: any[]
): AsyncGenerator<string, void, unknown> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const languageInstruction = responseLanguage && responseLanguage !== 'en' 
    ? `\n\nIMPORTANT: You MUST respond in ${responseLanguage}. All your responses should be in ${responseLanguage}, not English.`
    : '';

  // Group resources by type
  const noteResources = resources.filter(r => r.resourceType === 'tn');
  const questionResources = resources.filter(r => r.resourceType === 'tq');
  const wordResources = resources.filter(r => r.resourceType === 'tw');
  const academyResources = resources.filter(r => r.resourceType === 'ta');

  const resourceContext = `
AVAILABLE RESOURCES FROM MCP SERVER (use ONLY these to answer):

${scriptureText ? `SCRIPTURE TEXT:\n${scriptureText}\n` : ''}

${noteResources.length > 0 ? `TRANSLATION NOTES:\n${noteResources.slice(0, 5).map(r => `- ${r.title || r.reference}: ${r.content || r.snippet || r.text}`).join('\n')}\n` : ''}

${questionResources.length > 0 ? `TRANSLATION QUESTIONS:\n${questionResources.slice(0, 5).map(r => `- ${r.title || r.reference}: ${r.content || r.snippet || r.text}`).join('\n')}\n` : ''}

${wordResources.length > 0 ? `WORD STUDIES:\n${wordResources.slice(0, 5).map(r => `- ${r.title || r.term}: ${r.content || r.snippet || r.definition}`).join('\n')}\n` : ''}

${academyResources.length > 0 ? `ACADEMY ARTICLES:\n${academyResources.slice(0, 5).map(r => `- ${r.title}: ${r.content || r.snippet}`).join('\n')}\n` : ''}
`;

  // Detect user intent - pastoral/support needs vs research/study
  const isPastoralQuery = detectPastoralIntent(userMessage);
  
  const roleClarity = `
YOUR ROLE: You are a Bible translation resource assistant. Your purpose is to:
- Help users FIND relevant scripture passages and translation resources
- PARAPHRASE and SUMMARIZE resource content to help users understand
- Guide users to explore the resources themselves (swipe right to view)

YOU DO NOT:
- Directly interpret scripture or provide your own theological opinions
- Act as a pastor, counselor, or spiritual authority
- Give advice on life decisions beyond pointing to relevant scripture

When asked to interpret scripture, kindly explain that your role is to help find and summarize resources, and encourage the user to study the passages and resources themselves or consult with their faith community.`;

  const pastoralTone = isPastoralQuery ? `
IMPORTANT - PASTORAL SENSITIVITY:
The user appears to be seeking comfort or support. Respond with warmth and compassion while still pointing to relevant resources. 
- Acknowledge their feelings briefly
- Share a relevant scripture or resource that might bring comfort
- Remind them that while you can find helpful resources, speaking with a pastor, counselor, or trusted friend may also be valuable
Keep your response gentle and supportive.` : '';

  const systemPrompt = `${roleClarity}
${pastoralTone}

You must ONLY use the resources provided below to answer. Do NOT use your own knowledge.

Keep responses SHORT - 2-4 sentences summarizing what was found. The user can swipe right to see full resources.

${resourceContext}

If no relevant resources are found, say so honestly and suggest what to search for.${languageInstruction}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-4),
        { role: "user", content: userMessage }
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limits exceeded, please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required, please add funds.");
    }
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

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
        // Incomplete JSON, put back and wait
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], scriptureContext, responseLanguage, stream = true } = await req.json();
    
    console.log("Received message:", message);
    console.log("Scripture context:", scriptureContext);
    console.log("Response language:", responseLanguage);
    console.log("Streaming:", stream);

    let resources: any[];
    let scriptureText: string | null;
    let scriptureReference: string | null;
    let searchQuery: string | null;

    // Check if input is a scripture reference - if so, direct fetch first
    if (isScriptureReference(message)) {
      console.log("Detected scripture reference, using direct fetch");
      const result = await fetchDirectResources(message);
      resources = result.resources;
      scriptureText = result.scriptureText;
      scriptureReference = result.scriptureReference;
      searchQuery = null;
      
      // Fallback to search if no resources found from direct fetch
      if (resources.length === 0 && !scriptureText) {
        console.log("No resources from direct fetch, falling back to search");
        const searchResult = await callAIWithTools(message, conversationHistory, scriptureContext);
        resources = searchResult.resources;
        scriptureText = searchResult.scriptureText;
        scriptureReference = searchResult.scriptureReference || scriptureReference;
        searchQuery = searchResult.searchQuery;
      }
    } else {
      // Use AI with tools for keyword/topic searches
      console.log("Using AI search for keyword/topic");
      const result = await callAIWithTools(message, conversationHistory, scriptureContext);
      resources = result.resources;
      scriptureText = result.scriptureText;
      scriptureReference = result.scriptureReference;
      searchQuery = result.searchQuery;
    }

    console.log(`Fetched ${resources.length} resources, scripture ref: ${scriptureReference}, query: ${searchQuery}`);

    // Calculate resource counts
    const noteResources = resources.filter(r => r.resourceType === 'tn');
    const questionResources = resources.filter(r => r.resourceType === 'tq');
    const wordResources = resources.filter(r => r.resourceType === 'tw');
    const academyResources = resources.filter(r => r.resourceType === 'ta');
    
    const resourceCounts = {
      notes: noteResources.length,
      questions: questionResources.length,
      words: wordResources.length,
      academy: academyResources.length
    };

    // If streaming is requested, return SSE stream
    if (stream) {
      const encoder = new TextEncoder();
      
      // Create a readable stream
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // First, send metadata as a special event
            const metadata = {
              type: 'metadata',
              scripture_reference: scriptureReference,
              search_query: searchQuery || message,
              resource_counts: resourceCounts,
              total_resources: resources.length,
              mcp_resources: resources
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));
            
            // Stream the AI response
            const generator = generateStreamingResponse(
              message,
              resources,
              scriptureText,
              responseLanguage || 'en',
              conversationHistory
            );
            
            for await (const chunk of generator) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
            }
            
            // Send done event
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
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

    // Non-streaming fallback - collect all content
    let content = "";
    const generator = generateStreamingResponse(
      message,
      resources,
      scriptureText,
      responseLanguage || 'en',
      conversationHistory
    );
    
    for await (const chunk of generator) {
      content += chunk;
    }

    if (!content && resources.length === 0 && !scriptureText) {
      content = "I couldn't find specific resources for your question. Try asking about a specific Bible passage or topic.";
    }

    // Build the response with a single consolidated message
    const response = {
      scripture_reference: scriptureReference,
      search_query: searchQuery || message,
      content,
      resource_counts: resourceCounts,
      total_resources: resources.length,
      mcp_resources: resources
    };

    console.log(`Sending consolidated response with ${resources.length} total resources`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error in multi-agent-chat:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
