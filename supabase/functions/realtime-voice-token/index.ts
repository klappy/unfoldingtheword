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
- You MUST use the provided tools (search_translation_resources, get_scripture_passage) to find information
- You NEVER answer from your own knowledge or training data
- If tools return no results, say "I couldn't find resources on that topic. Could you try a different search?"
- NEVER make up or invent scripture verses, translation notes, or any content
- ONLY share what the tools return to you

YOUR ROLE:
- Use search_translation_resources to find translation notes, questions, word studies, and academy articles
- Use get_scripture_passage to fetch scripture text
- Summarize and read aloud what the tools return
- Guide users to explore related topics

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

// Tool definitions for OpenAI Realtime API
const voiceTools = [
  {
    type: "function",
    name: "search_translation_resources",
    description: "Search for translation resources including notes, questions, word studies, and academy articles. Tell the user you're looking for resources before calling this.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query - can be a topic, scripture reference, or keyword" 
        },
        resource_types: { 
          type: "array", 
          items: { type: "string", enum: ["tn", "tq", "tw", "ta"] },
          description: "Resource types to search: tn=translation notes, tq=translation questions, tw=translation words, ta=translation academy"
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "get_scripture_passage",
    description: "Get the text of a scripture passage to read aloud to the user. Tell the user you're fetching the passage.",
    parameters: {
      type: "object",
      properties: {
        reference: { 
          type: "string", 
          description: "Scripture reference like 'John 3:16' or 'Romans 8:1-4'" 
        }
      },
      required: ["reference"]
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

    const { voice = 'alloy', language } = await req.json();

    // Add language instruction if specified
    let systemPrompt = VOICE_SYSTEM_PROMPT;
    if (language && language !== 'en') {
      systemPrompt += `\n\nIMPORTANT: The user's preferred language is ${language}. Respond naturally in this language.`;
    }

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
