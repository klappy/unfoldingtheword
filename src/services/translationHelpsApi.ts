import { supabase } from '@/integrations/supabase/client';

export interface ScriptureVerse {
  number: number;
  text: string;
  isParagraphStart?: boolean;
}

export interface ScriptureResponse {
  reference: string;
  translation: string;
  text: string;
  verses: ScriptureVerse[];
}

export interface TranslationNote {
  id: string;
  reference: string;
  quote: string;
  note: string;
}

export interface TranslationQuestion {
  id: string;
  reference: string;
  question: string;
  response: string;
}

export interface TranslationWordLink {
  id: string;
  reference: string;
  word: string;
  articleId: string;
}

export interface TranslationWord {
  id: string;
  term: string;
  definition: string;
  content: string;
}

export interface TranslationAcademy {
  id: string;
  title: string;
  content: string;
}

async function callProxy(endpoint: string, params: Record<string, any>) {
  console.log(`[translationHelpsApi] Calling ${endpoint} with params:`, params);
  
  const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
    body: { endpoint, params },
  });

  if (error) {
    console.error(`[translationHelpsApi] Proxy error for ${endpoint}:`, error);
    throw new Error(error.message);
  }

  if (data?.error) {
    console.error(`[translationHelpsApi] API error for ${endpoint}:`, data.error, data.details);
    throw new Error(data.error);
  }

  console.log(`[translationHelpsApi] Response for ${endpoint}:`, data);
  return data;
}

// Parse markdown scripture response into structured verses
function parseScriptureMarkdown(content: string, reference: string): { verses: ScriptureVerse[], translation: string } {
  const verses: ScriptureVerse[] = [];
  let translation = 'unfoldingWord Literal Text';
  
  // Try to find verse markers in the content (e.g., "1 In the beginning..." or numbered lines)
  // First, extract the main text content
  const ultMatch = content.match(/\*\*ULT v\d+ \(([^)]+)\)\*\*\s*\n\n([\s\S]+?)(?=\n\n\*\*|$)/s);
  
  if (ultMatch) {
    translation = ultMatch[1];
    let verseText = ultMatch[2].trim();
    
    // Try to parse individual verses by looking for verse number patterns
    // Pattern: number at start of line or after newline, followed by text
    const versePattern = /(?:^|\n)(\d+)\s+([^\n]+(?:\n(?!\d+\s)[^\n]*)*)/g;
    let match;
    
    while ((match = versePattern.exec(verseText)) !== null) {
      const verseNum = parseInt(match[1], 10);
      let text = match[2].trim();
      // Preserve paragraph breaks within verse text
      text = text.replace(/\n\n+/g, '\n\n').replace(/\n(?!\n)/g, ' ');
      verses.push({ number: verseNum, text });
    }
    
    // If no verse patterns found, try splitting by reference from URL
    if (verses.length === 0) {
      const verseMatch = reference.match(/:(\d+)(?:-(\d+))?$/);
      if (verseMatch) {
        const startVerse = parseInt(verseMatch[1], 10);
        // Clean up the text - preserve paragraph structure
        verseText = verseText.replace(/\n\n+/g, '\n\n').replace(/\n(?!\n)/g, ' ');
        verses.push({ number: startVerse, text: verseText });
      } else {
        // Chapter only - try to split by sentence/paragraph
        const paragraphs = verseText.split(/\n\n+/);
        let verseNum = 1;
        for (const para of paragraphs) {
          const cleanPara = para.trim().replace(/\n/g, ' ');
          if (cleanPara) {
            verses.push({ number: verseNum++, text: cleanPara, isParagraphStart: true });
          }
        }
      }
    }
  }
  
  // Fallback: if no ULT found, try to extract any text after the header
  if (verses.length === 0) {
    const headerMatch = content.match(/# [^\n]+\n\n([\s\S]+)/);
    if (headerMatch) {
      let textContent = headerMatch[1]
        .replace(/---[\s\S]*?---/g, '') // Remove frontmatter
        .replace(/\*\*[^*]+\*\*/g, ''); // Remove bold markers
      
      // Try to parse verses from extracted content
      const versePattern = /(?:^|\n)(\d+)\s+([^\n]+(?:\n(?!\d+\s)[^\n]*)*)/g;
      let match;
      
      while ((match = versePattern.exec(textContent)) !== null) {
        const verseNum = parseInt(match[1], 10);
        let text = match[2].trim().replace(/\n(?!\n)/g, ' ');
        verses.push({ number: verseNum, text });
      }
      
      // Still no verses? Use the whole text
      if (verses.length === 0) {
        textContent = textContent.trim();
        if (textContent) {
          verses.push({ number: 1, text: textContent });
        }
      }
    }
  }
  
  return { verses, translation };
}

// Parse translation notes from markdown - each numbered section is a separate note
function parseNotesMarkdown(content: string, defaultReference: string): TranslationNote[] {
  const notes: TranslationNote[] = [];
  
  // Split by sections starting with "## number." - the content after the number can be anything
  const sectionPattern = /^## (\d+)\.\s+/gm;
  const sectionMatches = [...content.matchAll(sectionPattern)];
  
  console.log('[parseNotesMarkdown] Found sections:', sectionMatches.length);
  
  for (let i = 0; i < sectionMatches.length; i++) {
    const match = sectionMatches[i];
    const sectionNum = match[1];
    const startIndex = match.index!;
    const endIndex = i < sectionMatches.length - 1 ? sectionMatches[i + 1].index! : content.length;
    const section = content.substring(startIndex, endIndex).trim();
    
    if (!section) continue;
    
    // Extract the **Reference** field for this specific note
    const refMatch = section.match(/\*\*Reference\*\*:\s*([^\n]+)/);
    const noteReference = refMatch ? refMatch[1].trim() : defaultReference;
    
    // Extract the **Quote** field if present (the Greek/Hebrew text)
    const quoteMatch = section.match(/\*\*Quote\*\*:\s*([^\n]+)/);
    
    // Extract the **ID** field
    const idMatch = section.match(/\*\*ID\*\*:\s*([^\n]+)/);
    const noteId = idMatch ? idMatch[1].trim() : `note-${sectionNum}`;
    
    // Get the first line after ## N. as the title/quote
    const firstLineMatch = section.match(/^## \d+\.\s+(.+)$/m);
    const firstLine = firstLineMatch ? firstLineMatch[1].trim() : '';
    
    // Get any # heading in the section as the title
    const titleMatch = section.match(/^# ([^\n]+)/m);
    const title = titleMatch ? titleMatch[1].trim() : firstLine;
    
    // The quote is either from Quote field, or the first line after ##, or the title
    const quote = quoteMatch ? quoteMatch[1].trim() : (firstLine || title);
    
    // Get content - everything except metadata fields and section headers
    let noteContent = section
      .replace(/^## \d+\.\s+.+$/m, '') // Remove section header
      .replace(/^# [^\n]+$/m, '') // Remove title
      .replace(/\*\*Reference\*\*:[^\n]+\n?/g, '')
      .replace(/\*\*ID\*\*:[^\n]+\n?/g, '')
      .replace(/\*\*Support Reference\*\*:[^\n]+\n?/g, '')
      .replace(/\*\*Quote\*\*:[^\n]+\n?/g, '')
      .replace(/\*\*Occurrence\*\*:[^\n]+\n?/g, '')
      .trim();
    
    console.log(`[parseNotesMarkdown] Note ${sectionNum}: ref=${noteReference}, quote=${quote.substring(0, 30)}...`);
    
    if (quote || noteContent) {
      notes.push({
        id: noteId,
        reference: noteReference,
        quote: quote || `Note ${sectionNum}`,
        note: noteContent,
      });
    }
  }
  
  return notes;
}

// Parse translation questions from markdown
function parseQuestionsMarkdown(content: string, defaultReference: string): TranslationQuestion[] {
  const questions: TranslationQuestion[] = [];
  
  // Split by sections starting with "## number."
  const sectionPattern = /^## (\d+)\.\s+/gm;
  const sectionMatches = [...content.matchAll(sectionPattern)];
  
  console.log('[parseQuestionsMarkdown] Found sections:', sectionMatches.length);
  
  for (let i = 0; i < sectionMatches.length; i++) {
    const match = sectionMatches[i];
    const sectionNum = match[1];
    const startIndex = match.index!;
    const endIndex = i < sectionMatches.length - 1 ? sectionMatches[i + 1].index! : content.length;
    const section = content.substring(startIndex, endIndex).trim();
    
    if (!section) continue;
    
    // Get the question text (first line after ## N.)
    const questionMatch = section.match(/^## \d+\.\s+(.+)$/m);
    const questionText = questionMatch ? questionMatch[1].trim() : '';
    
    // Extract the **Reference** field
    const refMatch = section.match(/\*\*Reference\*\*:\s*([^\n]+)/);
    const qReference = refMatch ? refMatch[1].trim() : defaultReference;
    
    // Extract the **ID** field
    const idMatch = section.match(/\*\*ID\*\*:\s*([^\n]+)/);
    const qId = idMatch ? idMatch[1].trim() : `question-${sectionNum}`;
    
    // Get the answer - content between question and metadata
    let answer = section
      .replace(/^## \d+\.\s+.+$/m, '') // Remove question line
      .replace(/\*\*Reference\*\*:[^\n]+\n?/g, '')
      .replace(/\*\*ID\*\*:[^\n]+\n?/g, '')
      .trim();
    
    console.log(`[parseQuestionsMarkdown] Q${sectionNum}: ${questionText.substring(0, 40)}...`);
    
    if (questionText) {
      questions.push({
        id: qId,
        reference: qReference,
        question: questionText,
        response: answer,
      });
    }
  }
  
  return questions;
}

// Parse translation word links from markdown
function parseWordLinksMarkdown(content: string, defaultReference: string): TranslationWordLink[] {
  const links: TranslationWordLink[] = [];
  
  // Split by sections starting with "## number."
  const sectionPattern = /^## (\d+)\.\s+/gm;
  const sectionMatches = [...content.matchAll(sectionPattern)];
  
  console.log('[parseWordLinksMarkdown] Found sections:', sectionMatches.length);
  
  for (let i = 0; i < sectionMatches.length; i++) {
    const match = sectionMatches[i];
    const sectionNum = match[1];
    const startIndex = match.index!;
    const endIndex = i < sectionMatches.length - 1 ? sectionMatches[i + 1].index! : content.length;
    const section = content.substring(startIndex, endIndex).trim();
    
    if (!section) continue;
    
    // Get the word (text after ## N.)
    const wordMatch = section.match(/^## \d+\.\s+(.+)$/m);
    const word = wordMatch ? wordMatch[1].trim() : '';
    
    // Extract the **Reference** field
    const refMatch = section.match(/\*\*Reference\*\*:\s*([^\n]+)/);
    const linkReference = refMatch ? refMatch[1].trim() : defaultReference;
    
    console.log(`[parseWordLinksMarkdown] Word ${sectionNum}: ${word}`);
    
    if (word) {
      links.push({
        id: `word-link-${sectionNum}`,
        reference: linkReference,
        word: word,
        articleId: word.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      });
    }
  }
  
  return links;
}

export async function fetchScripture(reference: string): Promise<ScriptureResponse> {
  try {
    const data = await callProxy('fetch-scripture', { reference });
    const content = data.content || data.text || '';
    const { verses, translation } = parseScriptureMarkdown(content, reference);

    return {
      reference: data.reference || reference,
      translation,
      text: content,
      verses: verses.length > 0 ? verses : [{ number: 1, text: 'Scripture content not available' }],
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching scripture:', error);
    throw error;
  }
}

export async function fetchTranslationNotes(reference: string): Promise<TranslationNote[]> {
  try {
    const data = await callProxy('fetch-translation-notes', { reference });
    const content = data.content || '';
    
    if (typeof content === 'string' && content.length > 0) {
      return parseNotesMarkdown(content, reference);
    }
    
    // Handle array response - no limits
    if (Array.isArray(data.notes || data)) {
      const notes = data.notes || data;
      return notes.map((note: any, index: number) => ({
        id: note.id || `note-${index}`,
        reference: note.reference || reference,
        quote: note.quote || note.Quote || note.title || '',
        note: note.note || note.Note || note.content || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation notes:', error);
    return [];
  }
}

export async function fetchTranslationQuestions(reference: string): Promise<TranslationQuestion[]> {
  try {
    const data = await callProxy('fetch-translation-questions', { reference });
    const content = data.content || '';
    
    if (typeof content === 'string' && content.length > 0) {
      return parseQuestionsMarkdown(content, reference);
    }
    
    // Handle array response - no limits
    if (Array.isArray(data.questions || data)) {
      const questions = data.questions || data;
      return questions.map((q: any, index: number) => ({
        id: q.id || `question-${index}`,
        reference: q.reference || reference,
        question: q.question || q.Question || '',
        response: q.response || q.Response || q.answer || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation questions:', error);
    return [];
  }
}

export async function fetchTranslationWordLinks(reference: string): Promise<TranslationWordLink[]> {
  try {
    const data = await callProxy('fetch-translation-word-links', { reference });
    const content = data.content || '';
    
    // Use the new parser for markdown content
    if (typeof content === 'string' && content.length > 0) {
      return parseWordLinksMarkdown(content, reference);
    }
    
    // Handle array response
    if (Array.isArray(data.links || data.words || data)) {
      const rawLinks = data.links || data.words || data;
      return rawLinks.map((link: any, index: number) => ({
        id: link.id || `word-link-${index}`,
        reference: link.reference || reference,
        word: link.word || link.Word || link.term || '',
        articleId: link.articleId || link.article || link.rc || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching word links:', error);
    return [];
  }
}

export async function fetchTranslationWord(articleId: string): Promise<TranslationWord | null> {
  try {
    // Use search endpoint with article filter to get full word content
    // The fetch-translation-word endpoint returns ToC without proper articleId format
    const data = await callProxy('search', { 
      query: `${articleId} definition meaning`,
      resource: 'tw',
      article: articleId 
    });
    
    console.log('[fetchTranslationWord] Search result for', articleId, ':', data?.hits?.length || 0, 'hits');
    
    // Find the best match from search results
    const hits = data?.hits || [];
    const exactMatch = hits.find((hit: any) => {
      const path = hit.path || hit.id || '';
      const wordFromPath = path.split('/').pop()?.replace('.md', '') || '';
      return wordFromPath.toLowerCase() === articleId.toLowerCase();
    });
    
    const hit = exactMatch || hits[0];
    
    if (!hit) {
      console.log('[fetchTranslationWord] No results found for', articleId);
      return null;
    }
    
    // Parse content from the search result
    let rawContent = hit.content || '';
    let term = articleId;
    let definition = '';
    let fullContent = '';
    
    // The content is JSON-stringified array of text blocks
    try {
      const contentBlocks = JSON.parse(rawContent);
      if (Array.isArray(contentBlocks)) {
        fullContent = contentBlocks
          .map((block: any) => block.text || '')
          .join('\n')
          .trim();
      }
    } catch {
      // If not JSON, use as-is
      fullContent = rawContent;
    }
    
    // Extract term from title
    const titleMatch = fullContent.match(/^#\s+([^\n]+)/m);
    if (titleMatch) term = titleMatch[1].trim();
    
    // Extract definition section
    const defMatch = fullContent.match(/## Definition:\s*\n\n?([\s\S]*?)(?=\n##|\n\(|$)/);
    if (defMatch) {
      definition = defMatch[1].trim();
    } else {
      // Fallback: first paragraph after title
      const firstParaMatch = fullContent.match(/^#[^\n]+\n\n([^\n#]+)/m);
      if (firstParaMatch) definition = firstParaMatch[1].trim();
    }
    
    return {
      id: hit.id || articleId,
      term: term,
      definition: definition,
      content: fullContent,
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation word:', error);
    return null;
  }
}

export async function fetchTranslationAcademy(moduleId: string): Promise<TranslationAcademy | null> {
  try {
    const data = await callProxy('fetch-translation-academy', { moduleId });
    const content = data.content || '';
    
    let title = moduleId;
    if (typeof content === 'string') {
      const titleMatch = content.match(/^#\s+([^\n]+)/m);
      if (titleMatch) title = titleMatch[1].trim();
    }
    
    return {
      id: data.id || moduleId,
      title: data.title || title,
      content: content.substring(0, 2000),
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching academy article:', error);
    return null;
  }
}

export async function searchResources(query: string, resource?: string): Promise<any[]> {
  try {
    const params: Record<string, string> = { query };
    if (resource) params.resource = resource;
    
    console.log('[searchResources] Searching with params:', params);
    const data = await callProxy('search', params);
    console.log('[searchResources] Raw response:', data);
    
    // The API returns { hits: [...] } or { results: [...] }
    const hits = data.hits || data.results || data.data || (Array.isArray(data) ? data : []);
    console.log('[searchResources] Found', hits.length, 'results for', resource || 'all');
    return hits;
  } catch (error) {
    console.error('[translationHelpsApi] Error searching resources:', error);
    return [];
  }
}
