import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// System prompt for the routing AI
const ROUTER_SYSTEM_PROMPT = `You are a Bible study assistant that routes user requests to the right tools.

TOOL SELECTION GUIDE:
- get_scripture: User wants to READ a specific passage (e.g., "John 3:16", "show me Romans 8", "Mateo 5")
- search_resources: User wants to FIND where something appears OR find resources about a topic
  - resourceTypes options: "scripture" (verses), "notes" (translation notes), "questions" (comprehension questions), "words" (word definitions), "academy" (translation academy articles)
  - When user says "articles" → use ["words", "academy"]
  - When user says "notes" → use ["notes"]
  - When user says "questions" → use ["questions"]
  - When user says "word" or "words" or "definitions" → use ["words"]
  - For general searches without specific type, use all: ["scripture", "notes", "questions", "words", "academy"]
- get_resources: User is at a passage and wants related translation helps (not searching)
- manage_notes: User wants to work with their PERSONAL notes (show/create/update/delete)

SCOPE EXAMPLES:
- "in Ruth" → scope: "Ruth"
- "in the Bible" or "everywhere" → scope: "Bible" 
- "in the Old Testament" → scope: "OT"
- "in the New Testament" → scope: "NT"
- "in Romans 8" → scope: "Romans 8"

You understand scripture references in ANY language (English, Spanish, Portuguese, Hindi, etc.).
Always call a tool - never respond without using a tool first.`;

// Tool definitions for OpenAI function calling
const tools = [
  {
    type: "function",
    function: {
      name: "get_scripture",
      description: "Fetch a scripture passage when user wants to READ a specific reference. Use for direct navigation like 'John 3:16', 'show me Romans 8', 'read Genesis 1'.",
      parameters: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "NORMALIZED scripture reference in FULL English book name format (e.g., user says '2 Tim 2:19' → output '2 Timothy 2:19', user says 'Mat 5' → output 'Matthew 5', user says 'Jn 3:16' → output 'John 3:16'). Always expand abbreviations to full book names."
          }
        },
        required: ["reference"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_resources",
      description: "Search for where a word/phrase appears in scripture OR find translation resources (notes, questions, words) about a topic. Use for queries like 'find love in John', 'notes about Boaz in Ruth', 'where is grace mentioned'.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search term or phrase to find"
          },
          scope: {
            type: "string",
            description: "Where to search: NORMALIZED book name (full English name like 'Matthew' not 'Mat'), chapter reference, 'OT', 'NT', or 'Bible' for everywhere. Always expand abbreviations."
          },
          resourceTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["scripture", "notes", "questions", "words", "academy"]
            },
            description: "What to search. 'words' for word definitions, 'academy' for translation academy articles, 'notes' for translation notes, 'questions' for comprehension questions, 'scripture' for verses. When user says 'articles', use ['words', 'academy']."
          }
        },
        required: ["query", "scope", "resourceTypes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_resources",
      description: "Fetch translation resources (notes, questions, word links) for a specific scripture reference. Use when user is viewing a passage and wants related helps, not when searching.",
      parameters: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "NORMALIZED scripture reference in FULL English book name format (e.g., '2 Tim 2:19' → '2 Timothy 2:19'). Always expand abbreviations to full book names."
          },
          types: {
            type: "array",
            items: {
              type: "string",
              enum: ["notes", "questions", "word-links"]
            },
            description: "Types of resources to fetch. Default to all three."
          }
        },
        required: ["reference"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_notes",
      description: "Manage user's personal notes. Use for 'show my notes', 'create a note about...', 'delete my note'.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "read", "update", "delete"],
            description: "What to do with notes"
          },
          content: {
            type: "string",
            description: "Note content (for create/update)"
          },
          reference: {
            type: "string",
            description: "Scripture reference to attach to note"
          },
          scope: {
            type: "string",
            enum: ["all", "book", "chapter", "verse"],
            description: "Scope for reading notes"
          },
          noteId: {
            type: "string",
            description: "Note ID (for update/delete)"
          }
        },
        required: ["action"]
      }
    }
  }
];

// Dispatch to sub-agent
async function invokeSubAgent(name: string, body: any): Promise<any> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  console.log(`[multi-agent-chat] Dispatching to ${name}:`, JSON.stringify(body).substring(0, 200));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[multi-agent-chat] ${name} returned ${response.status}`);
      const text = await response.text();
      console.error(`[multi-agent-chat] ${name} error:`, text);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[multi-agent-chat] Error invoking ${name}:`, error);
    return null;
  }
}

// Strip markdown for voice
function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/```[^`]*```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      conversationHistory = [],
      scriptureContext,
      responseLanguage = 'en',
      stream = true,
      isVoiceRequest = false,
      userPrefs = {}
    } = await req.json();

    console.log(`[multi-agent-chat] Message: "${message}"`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const prefs = {
      language: userPrefs.language || 'en',
      organization: userPrefs.organization || 'unfoldingWord',
      resource: userPrefs.resource || 'ult',
      deviceId: userPrefs.deviceId,
    };

    // Step 1: Call OpenAI with tools to determine intent and extract parameters
    console.log(`[multi-agent-chat] Calling OpenAI for tool selection...`);
    const routerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ROUTER_SYSTEM_PROMPT },
          ...conversationHistory.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message }
        ],
        tools,
        tool_choice: "required",
      }),
    });

    if (!routerResponse.ok) {
      const errorText = await routerResponse.text();
      console.error(`[multi-agent-chat] Router error: ${routerResponse.status}`, errorText);
      throw new Error(`Router API error: ${routerResponse.status}`);
    }

    const routerData = await routerResponse.json();
    const aiToolCalls = routerData.choices?.[0]?.message?.tool_calls || [];
    console.log(`[multi-agent-chat] AI made ${aiToolCalls.length} tool call(s)`);

    // Step 2: Execute tool calls by dispatching to sub-agents
    let scriptureText: string | null = null;
    let scriptureReference: string | null = scriptureContext || null;
    let resources: any[] = [];
    let searchMatches: any[] = [];
    let navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null = null;
    let toolCalls: Array<{ tool: string; args: any }> = [];
    let searchResultsFull: any = null;

    for (const toolCall of aiToolCalls) {
      const funcName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      console.log(`[multi-agent-chat] Executing tool: ${funcName}`, args);

      switch (funcName) {
        case 'get_scripture': {
          const [scriptureResult, resourceResult] = await Promise.all([
            invokeSubAgent('scripture-agent', {
              reference: args.reference,
              language: prefs.language,
              organization: prefs.organization,
              resource: prefs.resource,
            }),
            invokeSubAgent('resource-agent', {
              reference: args.reference,
              type: ['notes', 'questions', 'word-links'],
              language: prefs.language,
              organization: prefs.organization,
            }),
          ]);

          if (scriptureResult?.text) {
            scriptureText = scriptureResult.text;
            scriptureReference = args.reference;
            toolCalls.push({ tool: 'scripture-agent', args: { reference: args.reference } });
          }
          if (resourceResult?.resources) {
            resources = resourceResult.resources;
            toolCalls.push({ tool: 'resource-agent', args: { reference: args.reference, type: ['notes', 'questions', 'word-links'] } });
          }
          navigationHint = 'scripture';
          break;
        }

        case 'search_resources': {
          const searchResult = await invokeSubAgent('search-agent', {
            query: args.query,
            scope: args.scope,
            resourceTypes: args.resourceTypes || ['scripture', 'notes', 'questions', 'words', 'academy'],
            language: prefs.language,
            organization: prefs.organization,
            resource: prefs.resource,
          });

          if (searchResult) {
            searchResultsFull = searchResult;
            toolCalls.push({ tool: 'search-agent', args: { query: args.query, scope: args.scope, resourceTypes: args.resourceTypes } });
            scriptureReference = args.scope;

            if (searchResult.scripture?.matches) {
              searchMatches = [...searchMatches, ...searchResult.scripture.matches];
              scriptureText = searchResult.scripture.markdown;
            }
            if (searchResult.notes?.matches?.length || searchResult.notes?.totalCount) {
              if (searchResult.notes.matches?.length) {
                resources.push(...searchResult.notes.matches.map((m: any) => ({
                  type: 'translation-note',
                  title: m.reference,
                  content: m.text,
                  reference: m.reference,
                })));
              }
            }
            if (searchResult.questions?.matches?.length || searchResult.questions?.totalCount) {
              if (searchResult.questions.matches?.length) {
                resources.push(...searchResult.questions.matches.map((m: any) => ({
                  type: 'translation-question',
                  title: m.reference,
                  content: m.text,
                  reference: m.reference,
                })));
              }
            }
            if (searchResult.words?.matches?.length || searchResult.words?.totalCount) {
              if (searchResult.words.matches?.length) {
                resources.push(...searchResult.words.matches.map((m: any) => ({
                  type: 'translation-word',
                  title: m.reference,
                  content: m.text,
                  reference: m.reference,
                })));
              }
            }
            if (searchResult.academy?.matches?.length || searchResult.academy?.totalCount) {
              if (searchResult.academy.matches?.length) {
                resources.push(...searchResult.academy.matches.map((m: any) => ({
                  type: 'translation-academy',
                  title: m.reference,
                  content: m.text,
                  reference: m.reference,
                })));
              }
            }
            navigationHint = 'search';
          }
          break;
        }

        case 'get_resources': {
          // For get_resources, we ALSO load scripture so the user can see the passage
          const [scriptureResult, resourceResult] = await Promise.all([
            invokeSubAgent('scripture-agent', {
              reference: args.reference,
              language: prefs.language,
              organization: prefs.organization,
              resource: prefs.resource,
            }),
            invokeSubAgent('resource-agent', {
              reference: args.reference,
              type: args.types || ['notes', 'questions', 'word-links'],
              language: prefs.language,
              organization: prefs.organization,
            }),
          ]);

          if (scriptureResult?.text) {
            scriptureText = scriptureResult.text;
            scriptureReference = args.reference;
            toolCalls.push({ tool: 'scripture-agent', args: { reference: args.reference } });
          }
          if (resourceResult?.resources) {
            resources = resourceResult.resources;
            toolCalls.push({ tool: 'resource-agent', args: { reference: args.reference, type: args.types } });
          }
          // Navigate to scripture so user sees the passage with resources available
          navigationHint = 'scripture';
          break;
        }

        case 'manage_notes': {
          if (!prefs.deviceId) {
            console.log(`[multi-agent-chat] Note action but no deviceId`);
            break;
          }

          const noteResult = await invokeSubAgent('note-agent', {
            action: args.action,
            device_id: prefs.deviceId,
            content: args.content,
            source_reference: args.reference,
            scope: args.scope || 'all',
            note_id: args.noteId,
            limit: 10,
          });

          if (noteResult?.notes) {
            resources = noteResult.notes.map((n: any) => ({
              type: 'note',
              title: n.source_reference || 'Note',
              content: n.content,
              reference: n.source_reference,
            }));
          }
          toolCalls.push({ tool: 'note-agent', args: { action: args.action } });
          navigationHint = 'notes';
          break;
        }
      }
    }

    console.log(`[multi-agent-chat] Results: scripture=${!!scriptureText}, resources=${resources.length}, matches=${searchMatches.length}, nav=${navigationHint}`);

    // Step 3: Build context and generate response
    const isEnglish = !responseLanguage || responseLanguage.toLowerCase() === 'en';
    const langInstruction = isEnglish ? '' : `\n\nRespond ENTIRELY in ${responseLanguage}.`;

    // Build resource context for the response generation with match counts
    const scriptureMatchCount = searchResultsFull?.scripture?.totalCount || 0;
    const notesMatchCount = searchResultsFull?.notes?.totalCount || 0;
    const questionsMatchCount = searchResultsFull?.questions?.totalCount || 0;
    const wordsMatchCount = searchResultsFull?.words?.totalCount || 0;
    const academyMatchCount = searchResultsFull?.academy?.totalCount || 0;
    const totalMatchCount = scriptureMatchCount + notesMatchCount + questionsMatchCount + wordsMatchCount + academyMatchCount;

    // Build match counts as clean array
    const countParts: string[] = [];
    if (scriptureMatchCount) countParts.push(`${scriptureMatchCount} scripture verses`);
    if (notesMatchCount) countParts.push(`${notesMatchCount} translation notes`);
    if (questionsMatchCount) countParts.push(`${questionsMatchCount} translation questions`);
    if (wordsMatchCount) countParts.push(`${wordsMatchCount} word articles`);
    if (academyMatchCount) countParts.push(`${academyMatchCount} academy articles`);
    
    const matchCountsSummary = countParts.length > 0
      ? `SEARCH RESULTS FOUND:\n${countParts.map(c => `- ${c}`).join('\n')}\n`
      : '';

    // Extract book distribution for context
    const bookDistribution = searchResultsFull?.scripture?.byBook 
      ? Object.entries(searchResultsFull.scripture.byBook)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 5)
          .map(([book, count]) => `${book}: ${count}`)
          .join(', ')
      : '';

    // Extract word article terms if available
    const wordTerms = searchResultsFull?.words?.items
      ?.slice(0, 3)
      .map((w: any) => w.term || w.title)
      .filter(Boolean)
      .join(', ') || '';

    const resourceContext = `
AVAILABLE RESOURCES:
${matchCountsSummary}${bookDistribution ? `BOOK DISTRIBUTION: ${bookDistribution}\n` : ''}${wordTerms ? `WORD ARTICLES FOUND: ${wordTerms}\n` : ''}
${scriptureText ? `SCRIPTURE:\n${scriptureText.substring(0, 2000)}\n` : ''}
${searchMatches.length ? `SAMPLE VERSES (${searchMatches.length} total):\n${searchMatches.slice(0, 5).map(m => `- ${m.book || ''} ${m.chapter || ''}:${m.verse || ''}: ${m.text?.substring(0, 100)}...`).join('\n')}\n` : ''}
${resources.length ? `RESOURCES (${resources.length}):\n${resources.slice(0, 6).map(r => `- [${r.type}] ${r.title || r.reference}: ${(r.content || '').substring(0, 80)}...`).join('\n')}\n` : ''}
`;

    const responsePrompt = `You are a warm, knowledgeable Bible study companion. Be conversational and inviting.

RESPONSE STYLE:
- Start with a brief thematic insight about what you found
- Mention ALL resource types with their counts naturally (e.g., "I found 228 verses, 76 notes, and 4 word articles...")
- Note where matches concentrate if book distribution is provided
- Highlight interesting word articles (especially Greek/Hebrew terms) if found
- End with a question or suggestion to invite further exploration
- Keep it to 3-5 sentences, conversational and encouraging

CRITICAL RULES:
- Only share information from the resources below - never from your own knowledge
- If no resources are provided, say "I couldn't find resources on that topic"
- Mention ALL resource types found, not just one

${resourceContext}${langInstruction}`;

    // Step 4: Generate and stream response
    const encoder = new TextEncoder();

    // Build unified tool_results for client to display ALL data the LLM received
    const toolResults = {
      scripture: scriptureText ? {
        reference: scriptureReference,
        text: scriptureText,
        resource: prefs.resource,
      } : null,
      search: searchResultsFull,
      resources: resources.length > 0 ? resources : null,
    };

    if (stream) {
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send tool_results first so client can render immediately
            if (Object.values(toolResults).some(v => v !== null)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_results', 
                data: toolResults 
              })}\n\n`));
            }

            // Send metadata
            const metadata = {
              type: 'metadata',
              scripture_reference: scriptureReference,
              tool_calls: toolCalls,
              navigation_hint: navigationHint,
              search_matches: searchMatches,
              search_resource: prefs.resource,
              // Include tool_results in metadata for final message storage
              tool_results: toolResults,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

            // Stream AI response
            const responseStream = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: responsePrompt },
                  ...conversationHistory.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
                  { role: "user", content: message }
                ],
                stream: true,
              }),
            });

            if (!responseStream.ok) {
              throw new Error(`Response generation error: ${responseStream.status}`);
            }

            const reader = responseStream.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";
            let fullContent = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              let newlineIndex: number;
              while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);

                if (line.startsWith(":") || line === "") continue;
                if (!line.startsWith("data: ")) continue;

                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") break;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullContent += content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
                  }
                } catch {
                  buffer = line + "\n" + buffer;
                  break;
                }
              }
            }

            if (isVoiceRequest) {
              const voiceResponse = stripMarkdownForVoice(fullContent);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'voice_response', content: voiceResponse })}\n\n`));
            }

            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("[multi-agent-chat] Streaming error:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    }

    // Non-streaming response
    const responseResult = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: responsePrompt },
          ...conversationHistory.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message }
        ],
      }),
    });

    const responseData = await responseResult.json();
    const content = responseData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      scripture_reference: scriptureReference,
      content,
      voice_response: stripMarkdownForVoice(content),
      navigation_hint: navigationHint,
      search_matches: searchMatches,
      tool_calls: toolCalls,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[multi-agent-chat] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
