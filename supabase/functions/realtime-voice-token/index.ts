import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Voice-adapted system prompt - ONLY uses MCP resources, never training data
const VOICE_SYSTEM_PROMPT = `You are a Bible study resource finder. You help users discover scripture and translation resources by using the tools provided. You speak naturally and conversationally.

CRITICAL RULE - ONLY USE TOOLS:
- You MUST use the provided tools to find information
- You NEVER answer from your own knowledge or training data
- If tools return no results, say "I couldn't find resources on that topic. Could you try a different search?"
- NEVER make up or invent scripture verses, translation notes, or any content
- ONLY share what the tools return to you

AVAILABLE TOOLS:
- get_scripture_passage: Get scripture text (ULT=Literal, UST=Simplified translations)
- search_resources: AI semantic search across all resource types
- get_translation_notes: Get notes explaining difficult passages
- get_translation_questions: Get comprehension questions for passages
- get_translation_word_links: Get word study links for a verse
- get_translation_word: Get detailed word definitions and usage
- get_translation_academy: Get translation training articles

VOICE CONVERSATION STYLE:
- Speak naturally, not like reading a document
- Use transitions: "Let me look that up for you...", "I found something helpful..."
- Keep responses brief - 3-5 sentences, then ask if they want more
- When reading scripture, say "verse X says..." naturally

WHAT YOU MUST NOT DO:
- Never answer questions from your training data
- Never interpret scripture or give theological opinions
- Never act as a pastor or counselor
- Never reference visual elements (screens, swiping, clicking)
- Never use bullet points or markdown formatting
- Never make up content if tools return nothing

WHEN TOOLS RETURN NOTHING:
Say: "I searched but didn't find any resources on that specific topic. Would you like to try a different scripture reference or topic?"

PASTORAL SENSITIVITY:
If someone seems distressed, respond with warmth, search for comforting scripture using the tools, and gently suggest speaking with a pastor.

LANGUAGE:
Match the user's language naturally.`;

// All MCP tools with full parameters - user prefs are injected into descriptions
const createVoiceTools = (userPrefs: { language: string; organization: string; resource: string }) => [
  {
    type: "function",
    name: "get_scripture_passage",
    description: `Get scripture text. User's current preference: resource="${userPrefs.resource}", language="${userPrefs.language}", organization="${userPrefs.organization}". Use these defaults unless user specifies otherwise.`,
    parameters: {
      type: "object",
      properties: {
        reference: { 
          type: "string", 
          description: "Scripture reference like 'John 3:16', 'Romans 8:1-4', or 'Matthew 5'" 
        },
        resource: {
          type: "string",
          enum: ["ult", "ust"],
          description: `Scripture resource. ult=Literal Translation, ust=Simplified Translation. Default: "${userPrefs.resource}"`
        },
        language: {
          type: "string",
          description: `Language code. Default: "${userPrefs.language}"`
        },
        organization: {
          type: "string", 
          description: `Organization/publisher. Default: "${userPrefs.organization}"`
        }
      },
      required: ["reference"]
    }
  },
  {
    type: "function",
    name: "search_resources",
    description: `AI semantic search across translation resources. User's current preference: language="${userPrefs.language}", organization="${userPrefs.organization}". Searches notes, questions, words, and academy articles.`,
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query - topic, concept, or keyword" 
        },
        resource: { 
          type: "string",
          enum: ["tn", "tq", "tw", "ta"],
          description: "Limit to resource type: tn=notes, tq=questions, tw=words, ta=academy. Omit to search all."
        },
        reference: {
          type: "string",
          description: "Limit to scripture reference like 'John 3' or 'Romans'"
        },
        article: {
          type: "string",
          description: "Search within specific article ID"
        },
        language: {
          type: "string",
          description: `Language code. Default: "${userPrefs.language}"`
        },
        organization: {
          type: "string",
          description: `Organization. Default: "${userPrefs.organization}"`
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "get_translation_notes",
    description: `Get translation notes explaining difficult passages and terms. Shows original Greek/Hebrew text with explanations. User prefs: language="${userPrefs.language}", organization="${userPrefs.organization}"`,
    parameters: {
      type: "object",
      properties: {
        reference: { 
          type: "string", 
          description: "Scripture reference like 'John 3:16' or 'Romans 8'" 
        },
        language: {
          type: "string",
          description: `Language code. Default: "${userPrefs.language}"`
        },
        organization: {
          type: "string",
          description: `Organization. Default: "${userPrefs.organization}"`
        }
      },
      required: ["reference"]
    }
  },
  {
    type: "function",
    name: "get_translation_questions",
    description: `Get comprehension and checking questions for scripture passages. User prefs: language="${userPrefs.language}", organization="${userPrefs.organization}"`,
    parameters: {
      type: "object",
      properties: {
        reference: { 
          type: "string", 
          description: "Scripture reference like 'John 3:16' or 'Romans 8'" 
        },
        language: {
          type: "string",
          description: `Language code. Default: "${userPrefs.language}"`
        },
        organization: {
          type: "string",
          description: `Organization. Default: "${userPrefs.organization}"`
        }
      },
      required: ["reference"]
    }
  },
  {
    type: "function",
    name: "get_translation_word_links",
    description: `Get links between a scripture verse and translation word articles. Shows which important biblical terms appear in the verse. User prefs: language="${userPrefs.language}", organization="${userPrefs.organization}"`,
    parameters: {
      type: "object",
      properties: {
        reference: { 
          type: "string", 
          description: "Scripture reference like 'John 3:16' - works best with specific verses" 
        },
        language: {
          type: "string",
          description: `Language code. Default: "${userPrefs.language}"`
        },
        organization: {
          type: "string",
          description: `Organization. Default: "${userPrefs.organization}"`
        }
      },
      required: ["reference"]
    }
  },
  {
    type: "function",
    name: "get_translation_word",
    description: "Get detailed information about a biblical term - definition, translation suggestions, and Bible references where it appears.",
    parameters: {
      type: "object",
      properties: {
        term: { 
          type: "string", 
          description: "Translation word term ID like 'love', 'faith', 'grace', 'holy', 'righteous'" 
        }
      },
      required: ["term"]
    }
  },
  {
    type: "function",
    name: "get_translation_academy",
    description: "Get translation training articles from Translation Academy. Helps with translation principles and techniques.",
    parameters: {
      type: "object",
      properties: {
        moduleId: { 
          type: "string", 
          description: "Academy module ID like 'figs-metaphor', 'translate-names', 'figs-explicit'" 
        },
        path: {
          type: "string",
          description: "Directory path to fetch multiple articles"
        }
      },
      required: []
    }
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { voice = 'alloy', language, userPrefs } = await req.json();

    // Get user preferences with defaults
    const prefs = {
      language: userPrefs?.language || language || 'en',
      organization: userPrefs?.organization || 'unfoldingWord',
      resource: userPrefs?.resource || 'ult',
    };

    console.log('[Voice] Creating session with user prefs:', prefs);

    // Add language instruction if specified
    let systemPrompt = VOICE_SYSTEM_PROMPT;
    if (prefs.language && prefs.language !== 'en') {
      systemPrompt += `\n\nIMPORTANT: The user's preferred language is ${prefs.language}. Respond naturally in this language.`;
    }
    
    // Add resource preference hint
    systemPrompt += `\n\nUSER PREFERENCES: The user prefers the "${prefs.resource}" scripture resource (${prefs.resource === 'ust' ? 'Simplified Translation' : 'Literal Translation'}). Use this when fetching scripture unless they specify otherwise.`;

    // Create tools with user preferences baked in
    const voiceTools = createVoiceTools(prefs);

    // Request an ephemeral token from OpenAI with our voice-optimized configuration
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: voice,
        instructions: systemPrompt,
        tools: voiceTools,
        tool_choice: "auto",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        },
        temperature: 0.8,
        max_response_output_tokens: 1024
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI session error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Voice session created successfully");

    // Return the session data including the ephemeral token
    return new Response(JSON.stringify({
      ...data,
      mcp_base_url: MCP_BASE_URL // Include for client-side tool handling
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error creating voice session:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
