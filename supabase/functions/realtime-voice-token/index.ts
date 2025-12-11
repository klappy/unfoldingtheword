import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Voice-adapted system prompt - ONLY uses MCP resources, never training data
const VOICE_SYSTEM_PROMPT = `You are a Bible study resource finder. You help users discover scripture and translation resources by using the tools provided. You speak naturally and conversationally.

INITIAL GREETING:
When the conversation first starts (before the user says anything), introduce yourself briefly and explain your capabilities. Say something like:
"Hi! I'm your Bible study assistant. I can help you read scripture passages, find translation notes and study questions, look up biblical word definitions, and save notes about what you're learning. I only use official translation resources, so I won't interpret scripture or give opinions. Just ask me to read a passage like John 3:16, or search for topics like 'grace' or 'faith'. What would you like to explore?"

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
- create_note: Save a note for the user (confirm content first)
- get_notes: Read user's saved notes (can filter by book/chapter/verse)
- update_note: Update an existing note
- delete_note: Delete a note (confirm first)

NOTES MANAGEMENT:
- When creating notes, ALWAYS read the content back to confirm before saving
- Attach scripture references to notes when the user is viewing or discussing a passage
- You can read previous notes to provide personalized context
- Filter notes by scope: "all" for everything, "book" for a book, "chapter" for a chapter, "verse" for specific verse(s)
- When accessing notes, the UI will navigate to show them

VOICE CONVERSATION STYLE:
- Speak naturally, not like reading a document
- Use transitions: "Let me look that up for you...", "I found something helpful..."
- Keep responses brief - 3-5 sentences, then ask if they want more
- When reading scripture, say "verse X says..." naturally

SCRIPTURE READING FLOW:
After reading a scripture passage to the user, ALWAYS offer to ask comprehension questions:
- Finish reading the passage naturally
- Then say something like: "Would you like me to ask you some comprehension questions to help you reflect on what we just read?"
- If they say yes, use get_translation_questions to fetch questions for that passage
- Ask the questions one at a time, giving the user time to think and respond
- After they answer, you can share what the translation resources suggest, but remember you're not interpreting - just sharing the study questions and their suggested answers from the resources

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
  },
  // NOTE MANAGEMENT TOOLS
  {
    type: "function",
    name: "create_note",
    description: "Create a new note for the user. IMPORTANT: Read the note content back to the user to confirm before calling this tool. Include scripture references when relevant to help the user find related content later.",
    parameters: {
      type: "object",
      properties: {
        content: { 
          type: "string", 
          description: "The note content to save" 
        },
        source_reference: { 
          type: "string", 
          description: "Optional scripture reference like 'John 3:16' or 'Romans 8' to associate with the note" 
        }
      },
      required: ["content"]
    }
  },
  {
    type: "function",
    name: "get_notes",
    description: "Retrieve the user's saved notes. Can filter by scope: 'all' for all notes, 'book' for a specific book (e.g., 'John'), 'chapter' for a specific chapter (e.g., 'John 3'), 'verse' for a specific verse (e.g., 'John 3:16'). When reading notes, the app will navigate to show them.",
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["all", "book", "chapter", "verse"],
          description: "Scope level for filtering: 'all' returns all notes, 'book/chapter/verse' filter by the reference parameter"
        },
        reference: {
          type: "string",
          description: "Scripture reference for filtering (e.g., 'John', 'John 3', 'John 3:16'). Required when scope is not 'all'."
        },
        limit: { 
          type: "number", 
          description: "Maximum notes to return (default 10)" 
        }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "update_note",
    description: "Update an existing note's content. Read the updated content back to confirm. Requires the note ID which can be obtained from get_notes.",
    parameters: {
      type: "object",
      properties: {
        note_id: { 
          type: "string", 
          description: "The ID of the note to update" 
        },
        content: { 
          type: "string", 
          description: "The new note content" 
        }
      },
      required: ["note_id", "content"]
    }
  },
  {
    type: "function",
    name: "delete_note",
    description: "Delete a note. Confirm with the user before deleting by reading the note content back. Requires the note ID.",
    parameters: {
      type: "object",
      properties: {
        note_id: { 
          type: "string", 
          description: "The ID of the note to delete" 
        }
      },
      required: ["note_id"]
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
        max_response_output_tokens: 4096  // Increased from 1024 to allow reading full chapters
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
