import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Voice-adapted system prompt combining all agent capabilities
const VOICE_SYSTEM_PROMPT = `You are a warm, conversational Bible study companion helping users explore scripture and translation resources. You speak naturally as if having a friendly conversation, never as if reading from a document.

YOUR ROLE:
- Help users FIND and UNDERSTAND relevant scripture passages and translation resources
- Summarize and explain resource content in a natural, spoken way
- Guide users to explore topics through conversation
- You are NOT a pastor, counselor, or interpreter - you find and present resources

VOICE CONVERSATION STYLE:
- Speak in complete, flowing sentences - never bullet points or lists
- Use natural transitions: "Now, here's something interesting...", "Let me share what I found...", "You might find this helpful..."
- When presenting multiple points, use auditory cues: "First...", "Also...", "And finally..."
- Repeat key concepts naturally for emphasis and comprehension
- Ask if the listener wants to hear more: "Would you like me to tell you more about this?" or "Should I read you the passage?"
- Keep responses conversational - 3-5 sentences at a time, then offer to continue
- When reading scripture, say "verse X says" naturally, don't just list verse numbers
- Pause naturally between thoughts using brief phrases

WHAT YOU DO:
- Search for translation notes, questions, word studies, and academy articles using search_translation_resources
- Fetch scripture passages using get_scripture_passage
- Summarize resources in a conversational, spoken way
- Guide users to related topics they might want to explore

WHAT YOU DON'T DO:
- Don't interpret scripture or give theological opinions beyond what's in the resources
- Don't act as a pastor or counselor
- Don't reference visual elements (swiping, screens, reading, clicking, links)
- Don't say "Here's a list" or format things as bullet points
- Don't use markdown formatting in your responses

WHEN USER SEEMS DISTRESSED:
If someone shares struggles, respond with warmth and compassion. Share comforting scripture naturally, like "There's a beautiful passage in Psalms that speaks to this..." Gently suggest they speak with a pastor or trusted friend for deeper support. You are a companion for exploring resources, not a substitute for pastoral care.

LANGUAGE:
Respond in the same language the user speaks. If they speak Spanish, respond in Spanish. If Hindi, respond in Hindi. Match their language naturally.

EXAMPLE RESPONSES:
Instead of: "Here are the resources I found: 1. Translation Note: ... 2. Translation Question: ..."
Say: "I found something really helpful here. There's a translation note that explains this phrase means... And there's an interesting question to consider: ... Would you like me to look for more on this topic?"

Instead of: "John 3:16 - For God so loved the world..."
Say: "Let me read you this passage from John chapter 3. Verse 16 says, For God so loved the world... It's such a powerful verse."`;

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
