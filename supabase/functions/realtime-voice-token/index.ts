import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Thin voice wrapper prompt - the text orchestrator (multi-agent-chat) does all the heavy lifting
const VOICE_WRAPPER_PROMPT = `You are a natural voice interface for a Bible study assistant. Your job is to speak naturally and conversationally while using a single tool to do all the work.

HOW YOU WORK:
- You have ONE tool: bible_study_assistant
- This tool handles ALL requests: reading scripture, searching resources, finding terms, managing notes
- Just pass the user's request to the tool and speak the response naturally

INITIAL GREETING:
When the conversation starts, introduce yourself briefly:
"Hi! I'm your Bible study assistant. I can help you read scripture passages, find translation resources, look up biblical terms, and save notes. Just ask me naturally - like 'read John 3:16' or 'what does grace mean?' What would you like to explore?"

CONVERSATION STYLE:
- Speak naturally, like a helpful friend
- Keep responses conversational - you're speaking, not reading a document
- Use transitions: "Let me look that up...", "I found something interesting..."
- After sharing content, offer to help more: "Would you like to explore this further?"

WHAT YOU DO:
- Pass ALL requests to bible_study_assistant tool
- Speak the tool's response naturally (it gives you voice-friendly text)
- The tool handles: scripture reading, resource search, word definitions, notes management

WHAT YOU DON'T DO:
- Never answer from your own knowledge
- Never interpret scripture or give theological opinions
- Never act as a pastor or counselor
- Never reference screens or UI elements

PASTORAL SENSITIVITY:
If someone seems distressed, respond with warmth, pass their request to the tool to find comforting scripture, and gently suggest speaking with a pastor.

LANGUAGE:
Match the user's language naturally. The tool handles translations.`;

// Single unified tool that wraps the text orchestrator
const createVoiceTools = (userPrefs: { language: string; organization: string; resource: string }) => [
  {
    type: "function",
    name: "bible_study_assistant",
    description: `Your single tool for ALL Bible study tasks. Just pass the user's natural request. 
Handles: reading scripture, searching topics, finding where terms appear, word definitions, translation notes, questions, academy articles, and user notes.
User's preferences: language="${userPrefs.language}", organization="${userPrefs.organization}", resource="${userPrefs.resource}"`,
    parameters: {
      type: "object",
      properties: {
        request: { 
          type: "string", 
          description: "The user's natural language request exactly as they said it" 
        },
        action_hint: {
          type: "string",
          enum: ["read", "search", "locate", "notes", "general"],
          description: "Optional hint: read=scripture passage, search=learn concept, locate=find term occurrences, notes=manage notes, general=other"
        }
      },
      required: ["request"]
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { voice = 'alloy', language, userPrefs } = await req.json();

    const prefs = {
      language: userPrefs?.language || language || 'en',
      organization: userPrefs?.organization || 'unfoldingWord',
      resource: userPrefs?.resource || 'ult',
    };

    console.log('[Voice] Creating session with user prefs:', prefs);

    let systemPrompt = VOICE_WRAPPER_PROMPT;
    if (prefs.language && prefs.language !== 'en') {
      systemPrompt += `\n\nIMPORTANT: The user's preferred language is ${prefs.language}. Respond naturally in this language.`;
    }

    const voiceTools = createVoiceTools(prefs);

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
        max_response_output_tokens: 4096
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI session error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Voice session created successfully");

    return new Response(JSON.stringify({
      ...data,
      userPrefs: prefs // Pass prefs back for client-side tool handling
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
