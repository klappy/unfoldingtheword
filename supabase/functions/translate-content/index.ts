import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, targetLanguage, contentType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`[translate-content] Translating ${contentType} to ${targetLanguage}`);
    console.log(`[translate-content] Content preview: ${content.substring(0, 100)}...`);

    const systemPrompt = `You are a professional Bible translation assistant. Translate the following ${contentType} content to ${targetLanguage}. 

Important guidelines:
- Preserve all markdown formatting
- Keep verse numbers, references, and structural elements unchanged
- Translate only the text content
- Maintain the original meaning and theological accuracy
- Use natural, fluent language appropriate for Bible study materials
- Preserve any technical terms in parentheses with their translations

Return ONLY the translated content, no explanations or metadata.`;

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
          { role: "user", content: content }
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
      console.error("[translate-content] AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Translation service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const translatedContent = data.choices?.[0]?.message?.content;

    if (!translatedContent) {
      throw new Error("No translation returned from AI");
    }

    console.log(`[translate-content] Translation complete, length: ${translatedContent.length}`);

    return new Response(JSON.stringify({ 
      translatedContent,
      originalLanguage: 'en',
      targetLanguage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[translate-content] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Translation failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
