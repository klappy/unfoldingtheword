import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StringToTranslate {
  key: string;
  value: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { strings, targetLanguage } = await req.json() as {
      strings: StringToTranslate[];
      targetLanguage: string;
    };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`[translate-ui] Translating ${strings.length} UI strings to ${targetLanguage}`);

    // Build compact prompt for efficient translation
    const stringsJson = JSON.stringify(
      strings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
    );

    const systemPrompt = `You are a professional UI translator for a Bible study application. Translate the following JSON object of UI strings from English to ${targetLanguage}.

CRITICAL RULES:
1. Return ONLY valid JSON with the exact same keys
2. Translate the values naturally for the target language
3. Keep placeholders like {count} or {name} unchanged
4. Maintain the same tone - formal for religious content, friendly for UI
5. Keep string length similar when possible (for UI fitting)
6. Do NOT translate technical terms that should remain in English

Return the translated JSON object only, no explanation.`;

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
          { role: "user", content: stringsJson }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[translate-ui] AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Translation service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let translatedContent = data.choices?.[0]?.message?.content;

    if (!translatedContent) {
      throw new Error("No translation returned from AI");
    }

    // Clean up markdown code blocks if present
    translatedContent = translatedContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Parse the translated JSON
    let translations: Record<string, string>;
    try {
      translations = JSON.parse(translatedContent);
    } catch (parseError) {
      console.error("[translate-ui] Failed to parse translation response:", translatedContent);
      throw new Error("Invalid translation format returned");
    }

    console.log(`[translate-ui] Successfully translated ${Object.keys(translations).length} strings`);

    return new Response(JSON.stringify({ 
      translations,
      targetLanguage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[translate-ui] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Translation failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
