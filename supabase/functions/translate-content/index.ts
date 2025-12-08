import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationItem {
  id: string;
  content: string;
  contentType: string;
}

interface BatchRequest {
  items: TranslationItem[];
  targetLanguage: string;
}

interface SingleRequest {
  content: string;
  targetLanguage: string;
  contentType: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if this is a batch request
    if (body.items && Array.isArray(body.items)) {
      return handleBatchTranslation(body as BatchRequest, LOVABLE_API_KEY);
    } else {
      return handleSingleTranslation(body as SingleRequest, LOVABLE_API_KEY);
    }
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

async function handleSingleTranslation(request: SingleRequest, apiKey: string): Promise<Response> {
  const { content, targetLanguage, contentType } = request;
  
  console.log(`[translate-content] Translating ${contentType} to ${targetLanguage}`);
  console.log(`[translate-content] Content preview: ${content.substring(0, 100)}...`);

  const translatedContent = await translateText(content, targetLanguage, contentType, apiKey);
  
  if ('error' in translatedContent) {
    return new Response(JSON.stringify({ error: translatedContent.error }), {
      status: translatedContent.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    translatedContent: translatedContent.text,
    originalLanguage: 'en',
    targetLanguage,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleBatchTranslation(request: BatchRequest, apiKey: string): Promise<Response> {
  const { items, targetLanguage } = request;
  
  console.log(`[translate-content] Batch translating ${items.length} items to ${targetLanguage}`);
  
  // Combine all content into a single prompt for efficiency
  const combinedContent = items.map((item, index) => {
    return `---ITEM_${index}_START [${item.contentType}]---\n${item.content}\n---ITEM_${index}_END---`;
  }).join('\n\n');

  const systemPrompt = `You are a professional Bible translation assistant. Translate the following content to ${targetLanguage}. 

The content contains multiple items separated by markers like ---ITEM_N_START [type]--- and ---ITEM_N_END---.
You MUST:
- Translate each item and keep the EXACT same markers around each translated item
- Preserve all markdown formatting within each item
- Keep verse numbers, references, and structural elements unchanged
- Translate only the text content
- Maintain the original meaning and theological accuracy
- Use natural, fluent language appropriate for Bible study materials

Return the translated content with the same item markers intact.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: combinedContent }
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
    const translatedCombined = data.choices?.[0]?.message?.content;

    if (!translatedCombined) {
      throw new Error("No translation returned from AI");
    }

    // Parse the combined response back into individual items
    const translations: Record<string, string> = {};
    
    for (let i = 0; i < items.length; i++) {
      const startMarker = `---ITEM_${i}_START`;
      const endMarker = `---ITEM_${i}_END---`;
      
      const startIdx = translatedCombined.indexOf(startMarker);
      const endIdx = translatedCombined.indexOf(endMarker);
      
      if (startIdx !== -1 && endIdx !== -1) {
        // Find the end of the start marker line
        const contentStart = translatedCombined.indexOf('---\n', startIdx) + 4;
        const content = translatedCombined.substring(contentStart, endIdx).trim();
        translations[items[i].id] = content;
      } else {
        console.warn(`[translate-content] Could not find markers for item ${i}, using fallback parsing`);
        // Fallback: try to split evenly
        translations[items[i].id] = items[i].content; // Keep original if parsing fails
      }
    }

    console.log(`[translate-content] Batch translation complete, ${Object.keys(translations).length} items translated`);

    return new Response(JSON.stringify({ 
      translations,
      originalLanguage: 'en',
      targetLanguage,
      itemCount: items.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[translate-content] Batch error:', error);
    throw error;
  }
}

async function translateText(
  content: string, 
  targetLanguage: string, 
  contentType: string, 
  apiKey: string
): Promise<{ text: string } | { error: string; status: number }> {
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
      Authorization: `Bearer ${apiKey}`,
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
      return { error: "Rate limit exceeded. Please try again later.", status: 429 };
    }
    if (response.status === 402) {
      return { error: "AI usage limit reached. Please add credits to continue.", status: 402 };
    }
    const errorText = await response.text();
    console.error("[translate-content] AI gateway error:", response.status, errorText);
    return { error: "Translation service unavailable", status: 500 };
  }

  const data = await response.json();
  const translatedContent = data.choices?.[0]?.message?.content;

  if (!translatedContent) {
    return { error: "No translation returned from AI", status: 500 };
  }

  console.log(`[translate-content] Translation complete, length: ${translatedContent.length}`);
  return { text: translatedContent };
}
