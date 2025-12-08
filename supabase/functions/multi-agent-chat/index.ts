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

// Fetch resources from MCP server
async function fetchMcpResources(query: string, resourceTypes: string[] = ['tn', 'tq', 'tw', 'ta']): Promise<any[]> {
  const results: any[] = [];
  
  for (const resourceType of resourceTypes) {
    try {
      // Use the correct API path format - /api/search with query parameter
      const url = `${MCP_BASE_URL}/api/search?query=${encodeURIComponent(query)}&resource=${resourceType}`;
      console.log(`Fetching MCP resources: ${url}`);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // MCP server returns hits array, not results
        if (data.hits && Array.isArray(data.hits)) {
          results.push(...data.hits.map((r: any) => ({ ...r, resourceType })));
        }
      } else {
        console.log(`MCP search returned ${response.status} for ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error fetching ${resourceType} resources:`, error);
    }
  }
  
  return results;
}

// Fetch scripture passage from MCP - pass reference directly, let MCP server handle parsing
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

// Process tool calls from AI response
async function processToolCalls(toolCalls: any[]): Promise<{ resources: any[], scriptureText: string | null }> {
  const resources: any[] = [];
  let scriptureText: string | null = null;
  
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    console.log(`Processing tool call: ${functionName}`, args);
    
    if (functionName === 'search_resources') {
      const results = await fetchMcpResources(args.query, args.resource_types);
      resources.push(...results);
    } else if (functionName === 'get_scripture_passage') {
      scriptureText = await fetchScripturePassage(args.reference);
    }
  }
  
  return { resources, scriptureText };
}

// Call Lovable AI with tool calling for resource fetching
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

  const systemPrompt = `You are a Bible study assistant. Your job is to find relevant resources to answer user questions.

IMPORTANT: You must ALWAYS use the provided tools to search for resources before answering. Never answer from your own knowledge - only from MCP resources.

Available tools:
- search_resources: Search for translation notes, questions, word studies, and academy articles
- get_scripture_passage: Get the text of a scripture passage

For every question:
1. First identify if there's a scripture reference mentioned
2. Use search_resources to find relevant translation resources
3. If a scripture is referenced, also use get_scripture_passage to get the text

Always search for resources - the user needs to see real data from the translation helps database.`;

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
    resources = await fetchMcpResources(userMessage);
    searchQuery = userMessage;
  }

  return { resources, scriptureText, scriptureReference, searchQuery };
}

// Generate a single consolidated response based on fetched resources
async function generateConsolidatedResponse(
  userMessage: string,
  resources: any[],
  scriptureText: string | null,
  responseLanguage: string,
  conversationHistory: any[]
): Promise<{ content: string, resourceCounts: { notes: number, questions: number, words: number, academy: number } }> {
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
  
  const totalResources = resources.length;

  const resourceContext = `
AVAILABLE RESOURCES FROM MCP SERVER (use ONLY these to answer):

${scriptureText ? `SCRIPTURE TEXT:\n${scriptureText}\n` : ''}

${noteResources.length > 0 ? `TRANSLATION NOTES:\n${noteResources.slice(0, 5).map(r => `- ${r.title || r.reference}: ${r.content || r.snippet || r.text}`).join('\n')}\n` : ''}

${questionResources.length > 0 ? `TRANSLATION QUESTIONS:\n${questionResources.slice(0, 5).map(r => `- ${r.title || r.reference}: ${r.content || r.snippet || r.text}`).join('\n')}\n` : ''}

${wordResources.length > 0 ? `WORD STUDIES:\n${wordResources.slice(0, 5).map(r => `- ${r.title || r.term}: ${r.content || r.snippet || r.definition}`).join('\n')}\n` : ''}

${academyResources.length > 0 ? `ACADEMY ARTICLES:\n${academyResources.slice(0, 5).map(r => `- ${r.title}: ${r.content || r.snippet}`).join('\n')}\n` : ''}
`;

  const systemPrompt = `You are a Bible study assistant. You must ONLY use the resources provided below to answer. Do NOT use your own knowledge.

Keep responses VERY SHORT - 2-3 sentences max summarizing what was found. The user can swipe right to see full resources.

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
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "I couldn't find relevant resources for your question.";

  // If no resources found, provide default message
  if (totalResources === 0 && !scriptureText) {
    content = "I couldn't find specific resources for your question. Try asking about a specific Bible passage or topic.";
  }

  return { 
    content,
    resourceCounts: {
      notes: noteResources.length,
      questions: questionResources.length,
      words: wordResources.length,
      academy: academyResources.length
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], scriptureContext, responseLanguage } = await req.json();
    
    console.log("Received message:", message);
    console.log("Scripture context:", scriptureContext);
    console.log("Response language:", responseLanguage);

    // Step 1: Use AI with tools to fetch relevant MCP resources
    const { resources, scriptureText, scriptureReference, searchQuery } = await callAIWithTools(
      message,
      conversationHistory,
      scriptureContext
    );

    console.log(`Fetched ${resources.length} resources, scripture ref: ${scriptureReference}, query: ${searchQuery}`);

    // Step 2: Generate consolidated response
    const { content, resourceCounts } = await generateConsolidatedResponse(
      message,
      resources,
      scriptureText,
      responseLanguage || 'en',
      conversationHistory
    );

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
