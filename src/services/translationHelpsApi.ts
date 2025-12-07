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

// Parse translation notes from markdown - preserve full content
function parseNotesMarkdown(content: string, reference: string): TranslationNote[] {
  const notes: TranslationNote[] = [];
  
  // Split by note sections (## number. id format like "## 1. abc123")
  const sectionPattern = /## \d+\.\s+[a-z0-9]+\s*\n/gi;
  const sections = content.split(sectionPattern);
  
  // Start from index 1 to skip the header section
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    // Extract title (first # heading)
    const titleMatch = section.match(/^#\s+([^\n]+)/m);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Get full content after the title - don't truncate!
    const contentStart = titleMatch ? section.indexOf(titleMatch[0]) + titleMatch[0].length : 0;
    const noteContent = section.substring(contentStart).trim();
    
    if (title || noteContent) {
      notes.push({
        id: `note-${i}`,
        reference,
        quote: title || `Note ${i}`,
        note: noteContent, // Full content, no truncation
      });
    }
  }
  
  return notes;
}

// Parse translation questions from markdown - preserve full content
function parseQuestionsMarkdown(content: string, reference: string): TranslationQuestion[] {
  const questions: TranslationQuestion[] = [];
  
  // Look for Q&A patterns in multiple formats
  // Format 1: "**Q:** question\n\n**A:** answer"
  // Format 2: "Q: question\nA: answer"
  const qaPattern = /(?:\*\*)?Q(?:uestion)?:?\*?\*?\s*([^\n]+)\n+(?:\*\*)?A(?:nswer)?:?\*?\*?\s*([^\n]+)/gi;
  let match;
  
  while ((match = qaPattern.exec(content)) !== null) {
    questions.push({
      id: `question-${questions.length}`,
      reference,
      question: match[1].trim(),
      response: match[2].trim(),
    });
  }
  
  // Fallback: look for ### headers with content
  if (questions.length === 0) {
    const sections = content.split(/### /);
    for (let i = 1; i < sections.length; i++) {
      const lines = sections[i].split('\n');
      const question = lines[0]?.trim();
      const response = lines.slice(1).join('\n').trim(); // Keep full response with formatting
      if (question && response) {
        questions.push({
          id: `question-${i}`,
          reference,
          question,
          response,
        });
      }
    }
  }
  
  return questions;
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
    
    // Handle array response
    if (Array.isArray(data.notes || data)) {
      const notes = data.notes || data;
      return notes.slice(0, 10).map((note: any, index: number) => ({
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
    
    // Handle array response
    if (Array.isArray(data.questions || data)) {
      const questions = data.questions || data;
      return questions.slice(0, 10).map((q: any, index: number) => ({
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
    const links: TranslationWordLink[] = [];
    
    // Parse word links from markdown - look for links like [word](rc://...)
    if (typeof content === 'string') {
      const linkPattern = /\[([^\]]+)\]\((rc:\/\/[^)]+|[^)]+)\)/g;
      let match;
      while ((match = linkPattern.exec(content)) !== null && links.length < 8) {
        links.push({
          id: `word-link-${links.length}`,
          reference,
          word: match[1].trim(),
          articleId: match[2],
        });
      }
    }
    
    // Handle array response
    if (Array.isArray(data.links || data.words || data)) {
      const rawLinks = data.links || data.words || data;
      return rawLinks.slice(0, 8).map((link: any, index: number) => ({
        id: link.id || `word-link-${index}`,
        reference: link.reference || reference,
        word: link.word || link.Word || link.term || '',
        articleId: link.articleId || link.article || link.rc || '',
      }));
    }
    
    return links;
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
