import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MCP_BASE_URL = 'https://translation-helps-mcp.pages.dev';

// Shared conversational prompt - used by both text and voice
const CONVERSATIONAL_SYSTEM_PROMPT = `You are a Bible study resource finder. You help users discover scripture and translation resources by using the tools provided. You speak naturally and conversationally.

CRITICAL RULE - ONLY USE TOOLS:
- You MUST use the provided tools to find information
- You NEVER answer from your own knowledge or training data
- If tools return no results, say "I couldn't find resources on that topic. Could you try a different search?"
- NEVER make up or invent scripture verses, translation notes, or any content
- ONLY share what the tools return to you

INTENT ROUTING - USE FILTER PARAMETER:
Every resource tool supports a 'filter' parameter to find specific terms:
- "find love in Romans" → get_scripture_passage(reference="Romans", filter="love")
- "find notes about grace in NT" → get_translation_notes(reference="NT", filter="grace")
- "questions about faith in John" → get_translation_questions(reference="John", filter="faith")
- "word 'redeem' in Exodus" → get_translation_word(term="redeem", reference="Exodus")

WITHOUT FILTER (just reading):
- "John 3:16" → get_scripture_passage(reference="John 3:16")
- "notes for Romans 8" → get_translation_notes(reference="Romans 8")

REFERENCE SCOPES (all tools support these):
- Verse: "John 3:16"
- Chapter: "Romans 8"
- Book: "Romans"
- Testament: "NT", "OT"
- Section: "Gospels", "Pentateuch"
- Full: "Bible" (searches both testaments)

CONVERSATION STYLE:
- Speak naturally, like a helpful friend who knows the library
- Keep responses brief - 2-4 sentences, then let the user explore
- For filter results: ONLY mention counts if the tool returned structured matches

CRITICAL - NO HALLUCINATED STATISTICS:
- NEVER say "I found X occurrences" unless the tool actually returned that exact count
- If the tool returns an error or empty results, say "I couldn't find results for that search"

WHAT YOU MUST NOT DO:
- Never answer questions from your training data
- Never interpret scripture or give theological opinions
- Never act as a pastor or counselor
- Never make up content if tools return nothing

RESOURCE NAMES (CRITICAL):
- When you mention ULT, you MUST say exactly: "UnfoldingWord® Literal Text (ULT)".
- When you mention UST, you MUST say exactly: "UnfoldingWord® Simplified Text (UST)".

PASTORAL SENSITIVITY:
If someone seems distressed, respond with warmth and compassion, search for comforting scripture using the tools, and gently suggest speaking with a pastor or trusted friend.`;


// Extract resource override (ULT/UST) from the user message without persisting it
function extractResourceFromMessage(message: string): { cleanedMessage: string; resourceOverride?: 'ult' | 'ust' } {
  let cleanedMessage = message;
  let resourceOverride: 'ult' | 'ust' | undefined;

  const patterns: { regex: RegExp; id: 'ult' | 'ust' }[] = [
    { regex: /in the unfoldingword[®\s]+literal text\s*\(ULT\)/i, id: 'ult' },
    { regex: /in the unfoldingword[®\s]+simplified text\s*\(UST\)/i, id: 'ust' },
    { regex: /in the ULT\b/i, id: 'ult' },
    { regex: /in the UST\b/i, id: 'ust' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(cleanedMessage)) {
      resourceOverride = pattern.id;
      cleanedMessage = cleanedMessage.replace(pattern.regex, '').trim();
      break;
    }
  }

  return { cleanedMessage, resourceOverride };
}

const mcpTools = [
  {
    type: "function",
    function: {
      name: "get_scripture_passage",
      description: `Get scripture text OR locate term occurrences in scripture.

USE 'filter' PARAMETER WHEN:
- User asks WHERE a word appears: "find love in Romans", "where is grace mentioned in NT", "find Boaz in the Bible"
- User wants to LOCATE occurrences of a term across scripture
- Returns structured matches with book, chapter, verse, and text for each occurrence

OMIT 'filter' WHEN:
- User wants to READ a specific passage: "John 3:16", "read Romans 8"

REFERENCE SCOPES (all supported by MCP):
- Specific verse: "John 3:16"
- Chapter: "Romans 8" 
- Book: "Romans"
- Testament: "NT", "OT", "New Testament", "Old Testament"
- Section: "Gospels", "Pentateuch", "Pauline Epistles"
- Full Bible: "Bible" (will search both OT and NT)

The MCP server handles all reference parsing including localized book names.`,
      parameters: {
        type: "object",
        properties: {
          reference: { 
            type: "string", 
            description: "Scripture scope: 'John 3:16', 'Romans', 'NT', 'OT', 'Gospels', 'Bible'" 
          },
          filter: {
            type: "string",
            description: "Word/phrase to find. Returns structured matches with counts and breakdowns."
          }
        },
        required: ["reference"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_translation_notes",
      description: `Get translation notes for a scripture scope. Can filter for specific terms.

USE 'filter' PARAMETER WHEN:
- User wants notes containing a specific term: "find notes about love in Romans"
- User wants to locate where a concept is discussed in notes

REFERENCE SCOPES (all supported):
- Verse: "John 3:16"
- Chapter: "Romans 8"
- Book: "Romans"
- Testament: "NT", "OT"`,
      parameters: {
        type: "object",
        properties: {
          reference: { 
            type: "string", 
            description: "Scripture scope: verse, chapter, book, or testament" 
          },
          filter: {
            type: "string",
            description: "Optional term to find within notes"
          }
        },
        required: ["reference"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_translation_questions",
      description: `Get translation/comprehension questions for a scripture scope. Can filter for specific terms.

USE 'filter' PARAMETER WHEN:
- User wants questions about a specific topic: "questions about faith in Romans"
- User wants to find where a concept appears in questions

REFERENCE SCOPES (all supported):
- Verse: "John 3:16"
- Chapter: "Romans 8"
- Book: "Romans"
- Testament: "NT", "OT"`,
      parameters: {
        type: "object",
        properties: {
          reference: { 
            type: "string", 
            description: "Scripture scope: verse, chapter, book, or testament" 
          },
          filter: {
            type: "string",
            description: "Optional term to find within questions"
          }
        },
        required: ["reference"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_translation_word",
      description: `Get detailed information about a biblical term - definition, translation suggestions, and Bible references.

USE 'reference' PARAMETER WHEN:
- User wants word usage in a specific scope: "word 'love' in Romans"
- User wants to see where a term is used in a book/testament`,
      parameters: {
        type: "object",
        properties: {
          term: { 
            type: "string", 
            description: "Translation word term like 'love', 'faith', 'grace'" 
          },
          reference: {
            type: "string",
            description: "Optional scripture scope to filter word occurrences"
          }
        },
        required: ["term"],
        additionalProperties: false
      }
    }
  },
  // Note management tools
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a note for the user. Read content back to confirm before saving.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The note content to save" },
          source_reference: { type: "string", description: "Optional scripture reference" }
        },
        required: ["content"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_notes",
      description: "Retrieve user's saved notes. Can filter by scope: 'all', 'book', 'chapter', 'verse'.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["all", "book", "chapter", "verse"], description: "Scope level for filtering" },
          reference: { type: "string", description: "Scripture reference for filtering (e.g., 'John 3')" },
          limit: { type: "number", description: "Maximum notes to return (default 10)" }
        },
        required: [],
        additionalProperties: false
      }
    }
  }
];

// Removed: fetchMcpResourcesSearch - replaced by filter-based discovery on each endpoint

// Fetch verse-specific resources from MCP server using FETCH endpoints
// Now supports optional 'filter' parameter to find specific terms within resources
async function fetchVerseResources(reference: string, language?: string, organization?: string, filter?: string): Promise<any[]> {
  const results: any[] = [];
  const langParam = language ? `&language=${encodeURIComponent(language)}` : '';
  const orgParam = organization ? `&organization=${encodeURIComponent(organization)}` : '';
  const filterParam = filter ? `&filter=${encodeURIComponent(filter)}` : '';
  
  // Fetch translation notes
  try {
    const notesUrl = `${MCP_BASE_URL}/api/fetch-translation-notes?reference=${encodeURIComponent(reference)}${langParam}${orgParam}${filterParam}`;
    console.log(`Fetching translation notes: ${notesUrl}`);
    const notesResponse = await fetch(notesUrl);
    if (notesResponse.ok) {
      const text = await notesResponse.text();
      console.log(`Notes response (first 500 chars): ${text.substring(0, 500)}`);
      // Try to parse as JSON first
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            // Direct array of notes
            console.log(`Parsed ${data.length} JSON notes array`);
            results.push(...data.map((r: any) => ({ ...r, resourceType: 'tn' })));
          } else if (data && typeof data === 'object') {
            // Filter response format with matches array
            if (data.matches && Array.isArray(data.matches)) {
              console.log(`Parsed ${data.matches.length} notes from filter response (total: ${data.totalMatches})`);
              results.push(...data.matches.map((match: any) => ({
                resourceType: 'tn',
                reference: match.reference,
                title: match.reference,
                content: match.note,
                quote: match.quote,
                matchedTerms: match.matchedTerms,
                matchCount: match.matchCount
              })));
            } else {
              // Single note object
              console.log(`Parsed single JSON note object`);
              results.push({ ...data, resourceType: 'tn' });
            }
          }
        } catch (parseError) {
          console.log(`JSON parse failed, falling back to markdown: ${parseError}`);
          if (text.trim()) {
            const notes = parseMarkdownNotes(text, reference);
            console.log(`Parsed ${notes.length} markdown notes`);
            results.push(...notes.map((n: any) => ({ ...n, resourceType: 'tn' })));
          }
        }
      } else if (text.trim()) {
        const notes = parseMarkdownNotes(text, reference);
        console.log(`Parsed ${notes.length} markdown notes`);
        results.push(...notes.map((n: any) => ({ ...n, resourceType: 'tn' })));
      }
    }
  } catch (error) {
    console.error('Error fetching translation notes:', error);
  }

  // Fetch translation questions
  try {
    const questionsUrl = `${MCP_BASE_URL}/api/fetch-translation-questions?reference=${encodeURIComponent(reference)}${langParam}${orgParam}${filterParam}`;
    console.log(`Fetching translation questions: ${questionsUrl}`);
    const questionsResponse = await fetch(questionsUrl);
    if (questionsResponse.ok) {
      const text = await questionsResponse.text();
      console.log(`Questions response (first 500 chars): ${text.substring(0, 500)}`);
      // Try to parse as JSON first
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            // Direct array of questions
            console.log(`Parsed ${data.length} JSON questions array`);
            results.push(...data.map((r: any) => ({ ...r, resourceType: 'tq' })));
          } else if (data && typeof data === 'object') {
            // Filter response format with matches array
            if (data.matches && Array.isArray(data.matches)) {
              console.log(`Parsed ${data.matches.length} questions from filter response (total: ${data.totalMatches})`);
              results.push(...data.matches.map((match: any) => ({
                resourceType: 'tq',
                reference: match.reference,
                title: match.question || match.reference,
                question: match.question,
                content: match.response || match.answer,
                matchedTerms: match.matchedTerms,
                matchCount: match.matchCount
              })));
            } else {
              // Single question object
              console.log(`Parsed single JSON question object`);
              results.push({ ...data, resourceType: 'tq' });
            }
          }
        } catch (parseError) {
          console.log(`JSON parse failed, falling back to markdown: ${parseError}`);
          if (text.trim()) {
            const questions = parseMarkdownQuestions(text, reference);
            console.log(`Parsed ${questions.length} markdown questions`);
            results.push(...questions.map((q: any) => ({ ...q, resourceType: 'tq' })));
          }
        }
      } else if (text.trim()) {
        const questions = parseMarkdownQuestions(text, reference);
        console.log(`Parsed ${questions.length} markdown questions`);
        results.push(...questions.map((q: any) => ({ ...q, resourceType: 'tq' })));
      }
    }
  } catch (error) {
    console.error('Error fetching translation questions:', error);
  }

  // Fetch word links (only when not filtering - filter on tw uses fetch-translation-word with reference)
  if (!filter) {
    try {
      const wordLinksUrl = `${MCP_BASE_URL}/api/fetch-translation-word-links?reference=${encodeURIComponent(reference)}${langParam}${orgParam}`;
      console.log(`Fetching word links: ${wordLinksUrl}`);
      const wordLinksResponse = await fetch(wordLinksUrl);
      if (wordLinksResponse.ok) {
        const contentType = wordLinksResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await wordLinksResponse.json();
          if (Array.isArray(data)) {
            results.push(...data.map((r: any) => ({ ...r, resourceType: 'tw' })));
          }
        } else {
          const text = await wordLinksResponse.text();
          if (text && text.trim()) {
            const wordLinks = parseMarkdownWordLinks(text, reference);
            results.push(...wordLinks.map((w: any) => ({ ...w, resourceType: 'tw' })));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching word links:', error);
    }
  }

  console.log(`Fetched ${results.length} resources for ${reference}${filter ? ` with filter "${filter}"` : ''}`);
  return results;
}

// Parse markdown notes into structured array
function parseMarkdownNotes(content: string, reference: string): any[] {
  const notes: any[] = [];
  const lines = content.split('\n');
  let currentNote: any = null;
  
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentNote && currentNote.content) {
        notes.push(currentNote);
      }
      currentNote = { 
        reference: reference,
        title: line.replace(/^#+\s*/, '').trim(),
        content: ''
      };
    } else if (currentNote) {
      currentNote.content += line + '\n';
    }
  }
  
  if (currentNote && currentNote.content) {
    notes.push(currentNote);
  }
  
  if (notes.length === 0 && content.trim()) {
    notes.push({
      reference: reference,
      title: 'Translation Note',
      content: content.trim()
    });
  }
  
  return notes;
}

// Parse markdown questions
function parseMarkdownQuestions(content: string, reference: string): any[] {
  const questions: any[] = [];
  const lines = content.split('\n');
  let currentQuestion: any = null;
  
  for (const line of lines) {
    if (line.startsWith('#') || line.match(/^\d+\./)) {
      if (currentQuestion && currentQuestion.question) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        reference: reference,
        question: line.replace(/^#+\s*|\d+\.\s*/, '').trim(),
        response: ''
      };
    } else if (currentQuestion) {
      currentQuestion.response += line + '\n';
    }
  }
  
  if (currentQuestion && currentQuestion.question) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

// Parse markdown word links
function parseMarkdownWordLinks(content: string, reference: string): any[] {
  const wordLinks: any[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldMatch = line.match(/\*\*([^*]+)\*\*/);
    
    if (linkMatch) {
      wordLinks.push({
        reference: reference,
        word: linkMatch[1],
        articleId: linkMatch[2].split('/').pop() || linkMatch[1],
        content: line
      });
    } else if (boldMatch) {
      wordLinks.push({
        reference: reference,
        word: boldMatch[1],
        articleId: boldMatch[1].toLowerCase().replace(/\s+/g, '-'),
        content: line
      });
    }
  }
  
  return wordLinks;
}

// Detect if the user's message indicates pastoral/emotional support needs
function detectPastoralIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const pastoralKeywords = [
    'lonely', 'depressed', 'depression', 'anxious', 'anxiety', 'scared', 'afraid',
    'hurting', 'hurt', 'pain', 'suffering', 'struggling', 'lost', 'hopeless',
    'worried', 'stress', 'stressed', 'grief', 'grieving', 'mourning', 'sad', 'sadness',
    'broken', 'desperate', 'help me', 'need help', 'pray for', 'prayers',
    'dying', 'death', 'divorce', 'betrayed', 'abandoned', 'alone', 'suicide',
    'tempted', 'temptation', 'sin', 'guilt', 'shame', 'forgive', 'forgiveness',
    'angry', 'anger', 'rage', 'bitter', 'resentment', 'hate', 'hatred',
    'comfort', 'peace', 'healing', 'hope', 'strength', 'courage',
    "can't go on", "don't know what to do", 'overwhelmed', 'exhausted'
  ];
  
  for (const keyword of pastoralKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }
  
  const pastoralPatterns = [
    /i('m| am) (feeling|so|very|really)\s/,
    /my (heart|soul|spirit|life)\s/,
    /what (should|do) i do/,
    /help me (understand|cope|deal|get through)/,
    /going through/,
    /i need/,
    /i feel/,
  ];
  
  for (const pattern of pastoralPatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
  }
  
  return false;
}

interface ScriptureSearchMatch {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScripturePassageResult {
  text: string | null;
  isFilterSearch: boolean;
  matches: ScriptureSearchMatch[];
}

async function fetchScripturePassage(reference: string, filter?: string, language?: string, organization?: string, resource?: string): Promise<ScripturePassageResult> {
  try {
    let url = `${MCP_BASE_URL}/api/fetch-scripture?reference=${encodeURIComponent(reference)}`;
    if (filter) url += `&filter=${encodeURIComponent(filter)}`;
    if (language) url += `&language=${encodeURIComponent(language)}`;
    if (organization) url += `&organization=${encodeURIComponent(organization)}`;
    if (resource) url += `&resource=${encodeURIComponent(resource)}`;
    console.log(`Fetching scripture: ${url}`);
    
    const response = await fetch(url);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let text: string | null = null;
      let rawData: any = null;
      
      if (contentType.includes('application/json')) {
        rawData = await response.json();
        text = rawData.text || rawData.passage || rawData.content || rawData.markdown || JSON.stringify(rawData);
      } else {
        text = await response.text();
      }
      
      const matches: ScriptureSearchMatch[] = [];

      // Prefer structured matches from MCP when doing a filtered search
      if (filter && rawData && Array.isArray(rawData.matches)) {
        for (const m of rawData.matches) {
          const refStr: string = m.reference || '';
          const refMatch = refStr.match(/^(.+?)\s+(\d+):(\d+)/);
          if (!refMatch) continue;

          const book = refMatch[1];
          const chapter = parseInt(refMatch[2], 10);
          const verse = parseInt(refMatch[3], 10);
          const verseText: string = m.text || m.content || '';

          matches.push({
            book,
            chapter,
            verse,
            text: verseText.trim(),
          });
        }

        console.log(`[fetchScripturePassage] Using MCP matches: ${matches.length} for filter "${filter}"`);

        // If scripture text wasn't provided, build a simple concatenation for context
        if (!text && matches.length > 0) {
          text = matches
            .map((m) => `${m.book} ${m.chapter}:${m.verse} ${m.text}`)
            .join('\n');
        }
      } else if (filter && text) {
        // Fallback: parse plain text to find verses containing the filter term
        const filterLower = filter.toLowerCase();
        const lines = text.split('\n');
        let currentBook = reference.split(/\s+\d/)[0] || reference;

        for (const line of lines) {
          // Match verse patterns like "3:16 For God so loved..." or "16. For God so loved..."
          const verseMatch =
            line.match(/^(\d+):(\d+)\s+(.+)/) ||
            line.match(/^(\d+)\.\s+(.+)/);

          if (verseMatch) {
            const chapter = verseMatch[1] ? parseInt(verseMatch[1], 10) : 1;
            const verse = verseMatch[2]
              ? parseInt(verseMatch[2], 10)
              : parseInt(verseMatch[1], 10);
            const verseText = verseMatch[3] || verseMatch[2] || '';

            if (verseText.toLowerCase().includes(filterLower)) {
              matches.push({
                book: currentBook,
                chapter,
                verse,
                text: verseText.trim(),
              });
            }
          }
        }

        console.log(
          `[fetchScripturePassage] Parsed ${matches.length} matching verses for filter "${filter}" from plain text`,
        );
      }
      
      return { text, isFilterSearch: !!filter, matches };
    } else {
      console.log(`Scripture fetch returned ${response.status}`);
    }
  } catch (error) {
    console.error('Error fetching scripture:', error);
  }
  return { text: null, isFilterSearch: false, matches: [] };
}

// Detect if input is a scripture reference
function isScriptureReference(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim().toLowerCase();
  
  const bibleBooks = [
    'genesis', 'gen', 'exodus', 'exod', 'ex', 'leviticus', 'lev', 'numbers', 'num', 
    'deuteronomy', 'deut', 'joshua', 'josh', 'judges', 'judg', 'ruth', 
    '1 samuel', '2 samuel', '1samuel', '2samuel', '1sam', '2sam', '1 sam', '2 sam',
    '1 kings', '2 kings', '1kings', '2kings', '1kgs', '2kgs', '1 kgs', '2 kgs',
    '1 chronicles', '2 chronicles', '1chronicles', '2chronicles', '1chr', '2chr', '1 chr', '2 chr',
    'ezra', 'nehemiah', 'neh', 'esther', 'esth', 'job', 
    'psalms', 'psalm', 'ps', 'proverbs', 'prov', 'ecclesiastes', 'eccl', 'eccles',
    'song of solomon', 'song', 'sos', 'isaiah', 'isa', 'jeremiah', 'jer',
    'lamentations', 'lam', 'ezekiel', 'ezek', 'daniel', 'dan',
    'hosea', 'hos', 'joel', 'amos', 'obadiah', 'obad', 'jonah', 'jon',
    'micah', 'mic', 'nahum', 'nah', 'habakkuk', 'hab', 'zephaniah', 'zeph',
    'haggai', 'hag', 'zechariah', 'zech', 'malachi', 'mal',
    'matthew', 'matt', 'mt', 'mark', 'mk', 'luke', 'lk', 'john', 'jn',
    'acts', 'romans', 'rom', 
    '1 corinthians', '2 corinthians', '1corinthians', '2corinthians', '1cor', '2cor', '1 cor', '2 cor',
    'galatians', 'gal', 'ephesians', 'eph', 'philippians', 'phil', 'php',
    'colossians', 'col', '1 thessalonians', '2 thessalonians', '1thess', '2thess', '1 thess', '2 thess',
    '1 timothy', '2 timothy', '1timothy', '2timothy', '1tim', '2tim', '1 tim', '2 tim',
    'titus', 'tit', 'philemon', 'phlm', 'hebrews', 'heb',
    'james', 'jas', '1 peter', '2 peter', '1peter', '2peter', '1pet', '2pet', '1 pet', '2 pet',
    '1 john', '2 john', '3 john', '1john', '2john', '3john', '1jn', '2jn', '3jn',
    'jude', 'revelation', 'rev',
    // Spanish
    'génesis', 'gén', 'éxodo', 'éx', 'levítico', 'lv', 'números', 'nm', 
    'deuteronomio', 'dt', 'josué', 'jos', 'jueces', 'jue', 'rut',
    '1 samuel', '2 samuel', '1 reyes', '2 reyes', '1 crónicas', '2 crónicas',
    'esdras', 'esd', 'nehemías', 'ne', 'ester', 'est', 
    'salmos', 'sal', 'proverbios', 'pr', 'eclesiastés', 'ec',
    'cantares', 'cantar', 'isaías', 'is', 'jeremías', 'jer',
    'lamentaciones', 'lm', 'ezequiel', 'ez', 
    'oseas', 'os', 'amós', 'am', 'abdías', 'ab', 'jonás', 'jon',
    'miqueas', 'mi', 'nahúm', 'na', 'habacuc', 'hab', 'sofonías', 'sof',
    'hageo', 'ag', 'zacarías', 'zac', 'malaquías', 'mal',
    'mateo', 'mt', 'marcos', 'mc', 'lucas', 'lc', 'juan', 'jn',
    'hechos', 'hch', 'romanos', 'ro', 
    '1 corintios', '2 corintios', '1co', '2co',
    'gálatas', 'gl', 'efesios', 'ef', 'filipenses', 'flp',
    'colosenses', 'col', '1 tesalonicenses', '2 tesalonicenses',
    '1 timoteo', '2 timoteo', 'tito', 'ti', 'filemón', 'flm', 'hebreos', 'he',
    'santiago', 'stg', '1 pedro', '2 pedro', '1p', '2p',
    '1 juan', '2 juan', '3 juan', 'judas', 'apocalipsis', 'ap',
    // Portuguese
    'gênesis', 'êxodo', 'levítico', 'números', 'deuteronômio',
    'josué', 'juízes', 'rute',
    '1 samuel', '2 samuel', '1 reis', '2 reis', '1 crônicas', '2 crônicas',
    'neemias', 'ester', 'jó', 
    'salmos', 'provérbios', 'eclesiastes', 
    'cânticos', 'isaías', 'jeremias', 'lamentações', 'ezequiel',
    'oséias', 'amós', 'obadias', 'jonas', 'miquéias', 'naum',
    'habacuque', 'sofonias', 'ageu', 'zacarias', 'malaquias',
    'mateus', 'marcos', 'joão',
    'atos', 'romanos', '1 coríntios', '2 coríntios',
    'gálatas', 'efésios', 'filipenses', 'colossenses',
    '1 tessalonicenses', '2 tessalonicenses',
    '1 timóteo', '2 timóteo', 'filemon', 'hebreus',
    'tiago', '1 pedro', '2 pedro', '1 joão', '2 joão', '3 joão',
    'judas', 'apocalipse'
  ];
  
  const startsWithBook = bibleBooks.some(book => {
    return trimmed === book || 
           trimmed.startsWith(book + ' ') || 
           trimmed.startsWith(book + ':');
  });
  
  const bookChapterPattern = /^(\d?\s*[a-záéíóúüñâêôãõç]+)\s+(\d+)(\s*:\s*\d+(-\d+)?)?$/i;
  const matchesPattern = bookChapterPattern.test(trimmed);
  
  return startsWithBook || (matchesPattern && bibleBooks.some(book => trimmed.toLowerCase().startsWith(book.split(' ')[0])));
}

// Classify user intent using AI
async function classifyIntent(userMessage: string, OPENAI_API_KEY: string): Promise<'locate' | 'understand' | 'read' | 'note'> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `Classify the user's intent. Respond with ONLY one word:
- "locate" if they want to FIND WHERE a word/phrase appears in scripture (e.g., "find verses about love in Romans", "where does Paul mention grace", "¿dónde está 'gracia' en Romanos?")
- "understand" if they want to LEARN ABOUT a concept, get definitions, or ask complex questions (e.g., "what does justification mean", "explain redemption", "qu'est-ce que signifie la rédemption?")
- "read" if they want to READ a specific scripture passage (e.g., "John 3:16", "Romans 8", "read me Matthew 5")
- "note" if they want to manage notes (create, read, update, delete notes)

This works in ANY language - classify based on intent patterns, not keywords.`
        }, {
          role: "user",
          content: userMessage
        }],
        max_tokens: 10,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const intent = data.choices?.[0]?.message?.content?.toLowerCase().trim();
      if (intent === 'locate' || intent === 'understand' || intent === 'note') {
        return intent;
      }
    }
  } catch (error) {
    console.error("Error classifying intent:", error);
  }
  return 'read';
}

// Direct scripture/resource fetch without AI (for scripture references)
async function fetchDirectResources(reference: string, userPrefs?: { language?: string; organization?: string; resource?: string }): Promise<{
  resources: any[],
  scriptureText: string | null,
  scriptureReference: string,
  searchQuery: string | null,
  navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null
}> {
  console.log(`Direct fetch for scripture reference: ${reference}`);
  console.log('Direct fetch using prefs:', userPrefs);
  
  const [resources, scriptureResult] = await Promise.all([
    fetchVerseResources(reference, userPrefs?.language, userPrefs?.organization),
    fetchScripturePassage(reference, undefined, userPrefs?.language, userPrefs?.organization, userPrefs?.resource)
  ]);
  
  return {
    resources,
    scriptureText: scriptureResult.text,
    scriptureReference: reference,
    searchQuery: null,
    navigationHint: 'scripture'
  };
}

// Process tool calls from AI response - returns signatures AND results
async function processToolCalls(toolCalls: any[], userPrefs?: { language?: string; organization?: string; resource?: string; deviceId?: string }): Promise<{ 
  resources: any[], 
  scriptureText: string | null, 
  scriptureReference: string | null, 
  searchQuery: string | null,
  navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null,
  isFilterSearch: boolean,
  searchMatches: ScriptureSearchMatch[],
  noteResult?: string,
  toolCallSignatures: Array<{ tool: string; args: any }> // NEW: tool call signatures for storage
}> {
  const resources: any[] = [];
  let scriptureText: string | null = null;
  let scriptureReference: string | null = null;
  let searchQuery: string | null = null;
  let navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null = null;
  let isFilterSearch = false;
  let searchMatches: ScriptureSearchMatch[] = [];
  let noteResult: string | undefined;
  const toolCallSignatures: Array<{ tool: string; args: any }> = [];
  
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    console.log(`Processing tool call: ${functionName}`, args);
    
    // Store the tool call signature (recipe, not results)
    toolCallSignatures.push({ tool: functionName, args });
    
    if (functionName === 'get_scripture_passage') {
      // MCP supports testament scopes (OT, NT) and book references directly - let the AI use them
      console.log(`Processing tool call: ${functionName}`, { reference: args.reference, filter: args.filter });
      const result = await fetchScripturePassage(args.reference, args.filter, userPrefs?.language, userPrefs?.organization, userPrefs?.resource);
      if (result.text) {
        scriptureText = scriptureText ? scriptureText + '\n\n' + result.text : result.text;
      }
      isFilterSearch = isFilterSearch || result.isFilterSearch;
      searchMatches = [...searchMatches, ...result.matches];
      scriptureReference = args.reference;
      navigationHint = args.filter ? 'search' : 'scripture';
      if (args.filter) searchQuery = args.filter;
    } else if (functionName === 'get_translation_notes') {
      // Now supports filter parameter
      const results = await fetchVerseResources(args.reference, userPrefs?.language, userPrefs?.organization, args.filter);
      // Filter to only tn resources
      resources.push(...results.filter((r: any) => r.resourceType === 'tn'));
      scriptureReference = args.reference;
      navigationHint = 'resources';
      if (args.filter) searchQuery = args.filter;
    } else if (functionName === 'get_translation_questions') {
      // Now supports filter parameter
      const results = await fetchVerseResources(args.reference, userPrefs?.language, userPrefs?.organization, args.filter);
      // Filter to only tq resources
      resources.push(...results.filter((r: any) => r.resourceType === 'tq'));
      scriptureReference = args.reference;
      navigationHint = 'resources';
      if (args.filter) searchQuery = args.filter;
    } else if (functionName === 'get_translation_word') {
      try {
        // Now supports reference parameter for scoped word lookups
        let url = `${MCP_BASE_URL}/api/fetch-translation-word?term=${encodeURIComponent(args.term)}`;
        if (args.reference) url += `&reference=${encodeURIComponent(args.reference)}`;
        console.log(`Fetching translation word: ${url}`);
        const response = await fetch(url);
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            resources.push({ ...data, resourceType: 'tw', term: args.term });
          } else {
            // MCP returns markdown for translation words
            const text = await response.text();
            if (text && text.trim()) {
              resources.push({
                resourceType: 'tw',
                term: args.term,
                title: args.term,
                content: text.trim(),
                definition: text.trim()
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching translation word:', error);
      }
      navigationHint = 'resources';
    } else if (functionName === 'create_note' || functionName === 'get_notes' || functionName === 'update_note' || functionName === 'delete_note') {
      navigationHint = 'notes';
      // Note operations handled in streaming response
    }
  }
  
  return { resources, scriptureText, scriptureReference, searchQuery, navigationHint, isFilterSearch, searchMatches, noteResult, toolCallSignatures };
}

// Call OpenAI with tool calling
async function callAIWithTools(userMessage: string, conversationHistory: any[], scriptureContext?: string, intentHint?: 'locate' | 'understand' | 'note', userPrefs?: { language?: string; organization?: string; resource?: string }): Promise<{
  resources: any[],
  scriptureText: string | null,
  scriptureReference: string | null,
  searchQuery: string | null,
  navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null,
  searchMatches: ScriptureSearchMatch[],
  toolCalls: Array<{ tool: string; args: any }> // Tool call signatures for storage
}> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Build intent-specific guidance
  let intentGuidance = '';
  if (intentHint === 'locate') {
    intentGuidance = `
The user wants to FIND WHERE specific terms appear in scripture.
Use get_scripture_passage with the 'filter' parameter.
Extract the search term and the scripture scope from the user's message.
Example: "find love in Romans" → get_scripture_passage(reference="Romans", filter="love")`;
  } else if (intentHint === 'understand') {
    intentGuidance = `
The user wants to LEARN and UNDERSTAND a concept.
Use search_resources to find translation notes, word studies, and academy articles.
Do NOT use filter - use semantic search for conceptual understanding.`;
  } else if (intentHint === 'note') {
    intentGuidance = `
The user wants to manage their notes (create, read, update, or delete).
Use the appropriate note tool based on their request.`;
  }

  const systemPrompt = `${CONVERSATIONAL_SYSTEM_PROMPT}
${intentGuidance}

Available tools: search_resources, get_scripture_passage (with optional filter), get_translation_notes, get_translation_questions, get_translation_word, create_note, get_notes

User's language preference: ${userPrefs?.language || 'en'}
User's organization: ${userPrefs?.organization || 'unfoldingWord'}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: "user", content: `${userMessage}${scriptureContext ? `\n\nCurrent context: ${scriptureContext}` : ''}` }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      tools: mcpTools,
      tool_choice: "auto",
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  
  console.log("AI response with tools:", JSON.stringify(message, null, 2));

  let resources: any[] = [];
  let scriptureText: string | null = null;
  let scriptureReference: string | null = null;
  let searchQuery: string | null = null;
  let navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null = null;
  let searchMatches: ScriptureSearchMatch[] = [];
  let toolCalls: Array<{ tool: string; args: any }> = [];

  if (message?.tool_calls && message.tool_calls.length > 0) {
    const result = await processToolCalls(message.tool_calls, userPrefs);
    resources = result.resources;
    scriptureText = result.scriptureText;
    scriptureReference = result.scriptureReference;
    searchQuery = result.searchQuery;
    navigationHint = result.navigationHint;
    searchMatches = result.searchMatches;
    toolCalls = result.toolCallSignatures;
  } else {
    // No tool calls - AI should always use tools, but if not, we just proceed with empty resources
    console.log("No tool calls from AI - proceeding with empty resources");
    navigationHint = null;
  }

  return { resources, scriptureText, scriptureReference, searchQuery, navigationHint, searchMatches, toolCalls };
}

// Generate a streaming response based on fetched resources
async function* generateStreamingResponse(
  userMessage: string,
  resources: any[],
  scriptureText: string | null,
  responseLanguage: string,
  conversationHistory: any[],
  searchMatches: ScriptureSearchMatch[] = []
): AsyncGenerator<string, void, unknown> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const isEnglish = !responseLanguage || 
    responseLanguage.toLowerCase() === 'en' || 
    responseLanguage.toLowerCase() === 'english';
  
  const languageInstruction = !isEnglish
    ? `\n\n**CRITICAL LANGUAGE REQUIREMENT**: You MUST respond ENTIRELY in ${responseLanguage}. Every single word of your response must be in ${responseLanguage}. Do NOT respond in English under any circumstances.`
    : '';

  const noteResources = resources.filter(r => r.resourceType === 'tn');
  const questionResources = resources.filter(r => r.resourceType === 'tq');
  const wordResources = resources.filter(r => r.resourceType === 'tw');
  const academyResources = resources.filter(r => r.resourceType === 'ta');

  const formatResource = (r: any): string => {
    const title = r.title || r.reference || r.term || r.word || 'Resource';
    const content = r.content || r.snippet || r.text || r.note || r.response || r.definition || r.question || '';
    return `- ${title}: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
  };

  const resourceContext = `
AVAILABLE RESOURCES FROM MCP SERVER (use ONLY these to answer):

${scriptureText ? `SCRIPTURE TEXT:\n${scriptureText}\n` : ''}

${noteResources.length > 0 ? `TRANSLATION NOTES (${noteResources.length}):\n${noteResources.slice(0, 5).map(formatResource).join('\n')}\n` : ''}

${questionResources.length > 0 ? `TRANSLATION QUESTIONS (${questionResources.length}):\n${questionResources.slice(0, 5).map(formatResource).join('\n')}\n` : ''}

${wordResources.length > 0 ? `WORD STUDIES (${wordResources.length}):\n${wordResources.slice(0, 5).map(formatResource).join('\n')}\n` : ''}

${academyResources.length > 0 ? `ACADEMY ARTICLES (${academyResources.length}):\n${academyResources.slice(0, 5).map(formatResource).join('\n')}\n` : ''}

${searchMatches.length > 0 ? `SCRIPTURE SEARCH RESULTS (${searchMatches.length} matches found):\n${searchMatches.slice(0, 10).map(m => `- ${m.book} ${m.chapter}:${m.verse}: "${m.text.substring(0, 100)}${m.text.length > 100 ? '...' : ''}"`).join('\n')}\n` : ''}
`;

  const isPastoralQuery = detectPastoralIntent(userMessage);

  const pastoralTone = isPastoralQuery ? `
IMPORTANT - PASTORAL SENSITIVITY:
The user appears to be seeking comfort or support. Respond with warmth and compassion while still pointing to relevant resources. 
- Acknowledge their feelings briefly
- Share a relevant scripture or resource that might bring comfort
- Remind them that speaking with a pastor or trusted friend may also be valuable
Keep your response gentle and supportive.` : '';

  const systemPrompt = `${CONVERSATIONAL_SYSTEM_PROMPT}
${pastoralTone}

You must ONLY use the resources provided below to answer. Do NOT use your own knowledge.

Keep responses SHORT - 2-4 sentences summarizing what was found. Sound natural and conversational, not robotic.

${resourceContext}

If scripture search results are provided, acknowledge the matches found and mention they can swipe to see them.
If no relevant resources are found, say so honestly and suggest what to search for.${languageInstruction}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-4),
        { role: "user", content: userMessage }
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limits exceeded, please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required, please add funds.");
    }
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

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
      if (jsonStr === "[DONE]") return;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

// Strip markdown for voice-friendly text
function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold
    .replace(/\*([^*]+)\*/g, '$1')      // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
    .replace(/#+\s*/g, '')              // Headers
    .replace(/```[^`]*```/g, '')        // Code blocks
    .replace(/`([^`]+)`/g, '$1')        // Inline code
    .replace(/\n+/g, ' ')               // Multiple newlines
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
      responseLanguage, 
      stream = true,
      // Voice mode support
      isVoiceRequest = false,
      userPrefs = {}
    } = await req.json();
    
    console.log("Received message:", message);
    console.log("Scripture context:", scriptureContext);
    console.log("Response language:", responseLanguage);
    console.log("Is voice request:", isVoiceRequest);
    console.log("User prefs:", userPrefs);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let resources: any[];
    let scriptureText: string | null;
    let scriptureReference: string | null;
    let searchQuery: string | null;
    let navigationHint: 'scripture' | 'resources' | 'search' | 'notes' | null = null;
    let searchMatches: ScriptureSearchMatch[] = [];

    // Extract resource override from message (e.g., "in the ULT", "in the UST")
    const { cleanedMessage, resourceOverride } = extractResourceFromMessage(message);
    const effectiveMessage = cleanedMessage || message;
    const effectivePrefs = {
      ...userPrefs,
      resource: resourceOverride || userPrefs?.resource,
    };

    console.log('Is voice request:', isVoiceRequest);
    console.log('Response language:', responseLanguage);
    console.log('User prefs:', effectivePrefs);

    // Classify intent using AI (works for any language)
    const isReference = isScriptureReference(effectiveMessage);
    let intentHint: 'locate' | 'understand' | 'note' | undefined;
    
    if (!isReference) {
      const classifiedIntent = await classifyIntent(effectiveMessage, OPENAI_API_KEY);
      // Only use intent hint if it's not 'read' (read is handled by isScriptureReference)
      if (classifiedIntent !== 'read') {
        intentHint = classifiedIntent;
      }
      console.log("Classified intent:", classifiedIntent, "using hint:", intentHint);
    }

    let toolCalls: Array<{ tool: string; args: any }> = [];

    if (isReference) {
      console.log("Detected scripture reference, using direct fetch");
      const result = await fetchDirectResources(effectiveMessage, effectivePrefs);
      resources = result.resources;
      scriptureText = result.scriptureText;
      scriptureReference = result.scriptureReference;
      searchQuery = null;
      navigationHint = result.navigationHint;
      // Create tool call signature for direct fetch
      toolCalls = [{ tool: 'get_scripture_passage', args: { reference: effectiveMessage } }];
      
      if (resources.length === 0 && !scriptureText) {
        console.log("No resources from direct fetch, falling back to search");
        const searchResult = await callAIWithTools(effectiveMessage, conversationHistory, scriptureContext, undefined, effectivePrefs);
        resources = searchResult.resources;
        scriptureText = searchResult.scriptureText;
        scriptureReference = searchResult.scriptureReference || scriptureReference;
        searchQuery = searchResult.searchQuery;
        navigationHint = searchResult.navigationHint;
        searchMatches = searchResult.searchMatches;
        toolCalls = searchResult.toolCalls;
      }
    } else {
      console.log("Using AI search with intent:", intentHint);
      const result = await callAIWithTools(effectiveMessage, conversationHistory, scriptureContext, intentHint, effectivePrefs);
      resources = result.resources;
      scriptureText = result.scriptureText;
      scriptureReference = result.scriptureReference;
      searchQuery = result.searchQuery;
      navigationHint = result.navigationHint;
      searchMatches = result.searchMatches;
      toolCalls = result.toolCalls;
    }

    console.log(`Fetched ${resources.length} resources, scripture ref: ${scriptureReference}, query: ${searchQuery}, navigation: ${navigationHint}, matches: ${searchMatches.length}`);

    const noteResources = resources.filter(r => r.resourceType === 'tn');
    const questionResources = resources.filter(r => r.resourceType === 'tq');
    const wordResources = resources.filter(r => r.resourceType === 'tw');
    const academyResources = resources.filter(r => r.resourceType === 'ta');
    
    const resourceCounts = {
      notes: noteResources.length,
      questions: questionResources.length,
      words: wordResources.length,
      academy: academyResources.length
    };

    if (stream) {
      const encoder = new TextEncoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // First, send metadata as a special event
            const metadata = {
              type: 'metadata',
              scripture_reference: scriptureReference,
              search_query: searchQuery || message,
              tool_calls: toolCalls, // Tool call signatures for replay
              navigation_hint: navigationHint,
              search_matches: searchMatches,
              search_resource: effectivePrefs.resource || 'ult'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));
            
            // Stream the AI response
            let fullContent = '';
            const generator = generateStreamingResponse(
              message,
              resources,
              scriptureText,
              responseLanguage || 'en',
              conversationHistory,
              searchMatches
            );
            
            for await (const chunk of generator) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
            }
            
            // For voice requests, send voice-optimized response at the end
            if (isVoiceRequest) {
              const voiceResponse = stripMarkdownForVoice(fullContent);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'voice_response', content: voiceResponse })}\n\n`));
            }
            
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
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
    let content = "";
    const generator = generateStreamingResponse(
      message,
      resources,
      scriptureText,
      responseLanguage || 'en',
      conversationHistory,
      searchMatches
    );
    
    for await (const chunk of generator) {
      content += chunk;
    }

    if (!content && resources.length === 0 && !scriptureText) {
      content = "I couldn't find specific resources for your question. Try asking about a specific Bible passage or topic.";
    }

    const response = {
      scripture_reference: scriptureReference,
      search_query: searchQuery || message,
      content,
      voice_response: stripMarkdownForVoice(content),
      resource_counts: resourceCounts,
      total_resources: resources.length,
      mcp_resources: resources,
      navigation_hint: navigationHint,
      search_matches: searchMatches,
      search_resource: effectivePrefs.resource || 'ult',
      tool_calls: toolCalls
    };

    console.log(`Sending response with ${resources.length} resources, navigation: ${navigationHint}`);

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
