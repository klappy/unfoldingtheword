import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent definitions with specialized system prompts
const agents = {
  orchestrator: {
    name: 'Orchestrator',
    systemPrompt: `You are the orchestrator agent for a Bible study assistant. Your role is to:
1. Analyze user questions and determine which specialized agents should respond
2. Extract scripture references from user messages (e.g., "John 3:16", "Romans 8:28")
3. Coordinate responses from multiple agents when appropriate

Always respond with a JSON object containing:
{
  "scripture_reference": "extracted reference or null",
  "agents_to_invoke": ["list of agent names to invoke"],
  "orchestrator_response": "brief coordinating message",
  "search_query": "query for resource search if needed"
}

Available agents: scripture, notes, questions, words
- scripture: For explaining scripture passages and their context
- notes: For translation notes and linguistic insights
- questions: For discussion questions and deeper study
- words: For Greek/Hebrew word studies and definitions`
  },
  scripture: {
    name: 'Scripture Scholar',
    emoji: '📖',
    systemPrompt: `You are a Scripture Scholar agent. Keep responses VERY SHORT - like a text message (2-3 sentences max).

Your job: Give a quick summary or insight, then point to resources.

Example response format:
"This passage shows Jesus teaching about faith. Swipe right to read the full text and check the translation notes for key terms."

DO NOT write long explanations. The user can swipe to see scripture and resources directly.`
  },
  notes: {
    name: 'Translation Notes Expert',
    emoji: '📝',
    systemPrompt: `You are a Translation Notes Expert. Keep responses VERY SHORT - like a text message (2-3 sentences max).

Your job: Highlight 1-2 key translation insights, then point to resources.

Example response format:
"Key term: 'faith' (Greek: pistis) - means trust/belief. Check the word studies for more depth."

DO NOT write long explanations. Point users to swipe for full resources.`
  },
  questions: {
    name: 'Study Questions Guide',
    emoji: '❓',
    systemPrompt: `You are a Study Questions Guide. Keep responses VERY SHORT - like a text message.

Your job: Give ONE thought-provoking question or quick answer, then point to resources.

Example response format:
"Great question! The context suggests X. See the study questions in resources for deeper exploration."

DO NOT write long explanations. Keep it conversational and brief.`
  },
  words: {
    name: 'Word Studies Expert',
    emoji: '📚',
    systemPrompt: `You are a Word Studies Expert. Keep responses VERY SHORT - like a text message (2-3 sentences max).

Your job: Give a quick definition or insight about a key word.

Example response format:
"'Agape' = unconditional love, used 116x in NT. Swipe to resources for the full word study."

DO NOT write long explanations. Point to resources for depth.`
  }
};

async function callLovableAI(systemPrompt: string, userMessage: string, conversationHistory: any[] = []) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage }
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
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], scriptureContext } = await req.json();
    
    console.log("Received message:", message);
    console.log("Scripture context:", scriptureContext);

    // Step 1: Call orchestrator to analyze the message
    const orchestratorResponse = await callLovableAI(
      agents.orchestrator.systemPrompt,
      `User message: "${message}"
${scriptureContext ? `Current scripture context: ${scriptureContext}` : ''}

Analyze this message and determine:
1. Is there a scripture reference mentioned?
2. Which specialized agents should respond?
3. What should the orchestrator say to coordinate?`,
      []
    );

    console.log("Orchestrator response:", orchestratorResponse);

    // Parse orchestrator response
    let orchestratorData;
    try {
      // Extract JSON from response
      const jsonMatch = orchestratorResponse.match(/\{[\s\S]*\}/);
      orchestratorData = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        scripture_reference: null,
        agents_to_invoke: ['scripture'],
        orchestrator_response: '',
        search_query: message
      };
    } catch (e) {
      console.error("Failed to parse orchestrator response:", e);
      orchestratorData = {
        scripture_reference: null,
        agents_to_invoke: ['scripture'],
        orchestrator_response: orchestratorResponse,
        search_query: message
      };
    }

    // Step 2: Call specialized agents in parallel
    const agentResponses = [];
    const agentsToInvoke = orchestratorData.agents_to_invoke || ['scripture'];

    const agentPromises = agentsToInvoke.map(async (agentName: string) => {
      const agent = agents[agentName as keyof typeof agents];
      if (!agent || agentName === 'orchestrator') return null;

      const contextMessage = `${message}
${orchestratorData.scripture_reference ? `\nRelevant scripture reference: ${orchestratorData.scripture_reference}` : ''}
${scriptureContext ? `\nCurrent study context: ${scriptureContext}` : ''}`;

      try {
        const response = await callLovableAI(
          agent.systemPrompt,
          contextMessage,
          conversationHistory.slice(-4) // Keep last 4 messages for context
        );
        
        return {
          agent: agentName,
          name: agent.name,
          emoji: (agent as any).emoji || '🤖',
          content: response
        };
      } catch (error) {
        console.error(`Error from ${agentName} agent:`, error);
        return null;
      }
    });

    const results = await Promise.all(agentPromises);
    const validResponses = results.filter(r => r !== null);

    // Build the response
    const response = {
      scripture_reference: orchestratorData.scripture_reference,
      search_query: orchestratorData.search_query,
      agents: validResponses,
      orchestrator_note: orchestratorData.orchestrator_response
    };

    console.log("Sending response with agents:", validResponses.map(r => r?.agent));

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
