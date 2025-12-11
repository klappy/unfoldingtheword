import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Language codes to natural language names for instructions
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish', 'es-419': 'Latin American Spanish',
  'pt': 'Portuguese', 'pt-br': 'Brazilian Portuguese',
  'fr': 'French',
  'hi': 'Hindi',
  'id': 'Indonesian',
  'ar': 'Arabic',
  'zh': 'Chinese', 'zh-cn': 'Mandarin Chinese',
  'ru': 'Russian',
  'de': 'German',
  'ja': 'Japanese',
  'ko': 'Korean',
  'sw': 'Swahili',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice = 'nova', language = 'en' } = await req.json();
    
    if (!text) {
      throw new Error('No text provided');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Truncate text to OpenAI's 4096 character limit
    const truncatedText = text.slice(0, 4096);
    
    // Build instructions for language and tone
    const langName = LANGUAGE_NAMES[language.toLowerCase()] || LANGUAGE_NAMES[language.split('-')[0]] || 'the given language';
    const isEnglish = language.toLowerCase().startsWith('en');
    
    const instructions = isEnglish 
      ? 'Speak clearly and naturally with a warm, friendly tone.'
      : `Speak naturally in ${langName} with native pronunciation, accent, and intonation. Use a warm, friendly tone appropriate for the language and culture.`;
    
    console.log(`[TTS] Streaming speech: ${truncatedText.length} chars, voice: ${voice}, lang: ${language}`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: truncatedText,
        voice: voice,
        instructions: instructions,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] OpenAI API error:', response.status, errorText);
      throw new Error(`TTS API failed: ${response.status}`);
    }

    console.log('[TTS] Streaming response from OpenAI...');

    // Stream the response body directly - true passthrough streaming
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('[TTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
