import { supabase } from '@/integrations/supabase/client';

export interface ScriptureVerse {
  number: number;
  text: string;
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
  
  // Extract translation from markdown
  const ultMatch = content.match(/\*\*ULT v\d+ \(([^)]+)\)\*\*\s*\n\n([^*]+?)(?=\n\n\*\*|$)/s);
  if (ultMatch) {
    translation = ultMatch[1];
    const verseText = ultMatch[2].trim();
    
    // Parse verses - try to split by verse numbers if present
    const verseMatch = reference.match(/:(\d+)(?:-(\d+))?$/);
    if (verseMatch) {
      const startVerse = parseInt(verseMatch[1], 10);
      const endVerse = verseMatch[2] ? parseInt(verseMatch[2], 10) : startVerse;
      
      // Split text by sentence boundaries for multi-verse passages
      const sentences = verseText.split(/(?<=[.!?])\s+/);
      const verseCount = endVerse - startVerse + 1;
      
      if (sentences.length >= verseCount) {
        // Distribute sentences across verses
        const sentencesPerVerse = Math.ceil(sentences.length / verseCount);
        for (let i = 0; i < verseCount; i++) {
          const start = i * sentencesPerVerse;
          const end = Math.min(start + sentencesPerVerse, sentences.length);
          const text = sentences.slice(start, end).join(' ');
          if (text.trim()) {
            verses.push({ number: startVerse + i, text: text.trim() });
          }
        }
      } else {
        // Single sentence or fewer sentences than verses
        verses.push({ number: startVerse, text: verseText });
      }
    } else {
      // No verse number in reference, treat as single verse
      verses.push({ number: 1, text: verseText });
    }
  }
  
  // Fallback: if no ULT found, try to extract any text after the header
  if (verses.length === 0) {
    const headerMatch = content.match(/# [^\n]+\n\n([\s\S]+)/);
    if (headerMatch) {
      const textContent = headerMatch[1]
        .replace(/---[\s\S]*?---/g, '') // Remove frontmatter
        .replace(/\*\*[^*]+\*\*/g, '') // Remove bold markers
        .replace(/\n{2,}/g, '\n')
        .trim();
      
      if (textContent) {
        verses.push({ number: 1, text: textContent.substring(0, 500) });
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
    const data = await callProxy('fetch-translation-word', { articleId });
    const content = data.content || '';
    
    // Parse word from markdown - preserve full content
    let term = articleId;
    let definition = '';
    
    if (typeof content === 'string') {
      // Extract title
      const titleMatch = content.match(/^#\s+([^\n]+)/m);
      if (titleMatch) term = titleMatch[1].trim();
      
      // Extract definition (first paragraph after title) - keep full paragraph
      const defMatch = content.match(/^#[^\n]+\n\n([^\n#]+)/m);
      if (defMatch) definition = defMatch[1].trim();
    }
    
    return {
      id: data.id || articleId,
      term: data.term || data.title || term,
      definition: data.definition || definition,
      content: content, // Full content, no truncation
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
    
    const data = await callProxy('search', params);
    return data.results || data.data || (Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('[translationHelpsApi] Error searching resources:', error);
    return [];
  }
}
