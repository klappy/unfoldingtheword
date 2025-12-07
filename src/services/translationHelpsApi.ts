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

export async function fetchScripture(reference: string): Promise<ScriptureResponse> {
  try {
    // Use the reference directly as the API expects it (e.g., "John 3:16")
    const data = await callProxy('fetch-scripture', { reference });
    
    // Parse the scripture content - handle markdown format
    let content = data.content || data.text || '';
    const verses: ScriptureVerse[] = [];
    
    // Try to extract verses from markdown content
    // Format might be: "**16** For God so loved..." or "16 For God so loved..."
    const versePattern = /\*?\*?(\d+)\*?\*?\s+([^*\d][^\n]*)/g;
    let match;
    while ((match = versePattern.exec(content)) !== null) {
      verses.push({
        number: parseInt(match[1], 10),
        text: match[2].trim(),
      });
    }

    // If no verses parsed with that pattern, try USFM format
    if (verses.length === 0 && content.includes('\\v ')) {
      const usfmPattern = /\\v\s+(\d+)\s+([^\\]+)/g;
      while ((match = usfmPattern.exec(content)) !== null) {
        verses.push({
          number: parseInt(match[1], 10),
          text: match[2].trim().replace(/\s+/g, ' '),
        });
      }
    }

    // If still no verses, treat entire content as single verse
    if (verses.length === 0 && content) {
      // Clean up any remaining markers
      content = content.replace(/\\[a-z]+\s*/g, '').replace(/\*\*/g, '').trim();
      verses.push({
        number: 1,
        text: content,
      });
    }

    return {
      reference: data.reference || reference,
      translation: data.translation || data.resource || 'unfoldingWord Literal Text',
      text: content,
      verses,
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching scripture:', error);
    throw error;
  }
}

export async function fetchTranslationNotes(reference: string): Promise<TranslationNote[]> {
  try {
    // Use reference directly, with optional format=md for markdown
    const data = await callProxy('translation-notes', { reference, format: 'json' });
    
    // Handle various response formats
    const notes = data.notes || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(notes)) {
      return notes.slice(0, 10).map((note: any, index: number) => ({
        id: note.id || `note-${index}`,
        reference: note.reference || note.ref || note.Reference || reference,
        quote: note.quote || note.Quote || note.original || note.OrigQuote || '',
        note: note.note || note.Note || note.content || note.text || note.OccurrenceNote || '',
      }));
    }
    
    // If content is markdown string, parse it
    if (typeof data.content === 'string') {
      const noteMatches = data.content.matchAll(/### ([^\n]+)\n([^#]+)/g);
      const parsedNotes: TranslationNote[] = [];
      for (const match of noteMatches) {
        parsedNotes.push({
          id: `note-${parsedNotes.length}`,
          reference,
          quote: match[1].trim(),
          note: match[2].trim(),
        });
      }
      return parsedNotes.slice(0, 10);
    }
    
    return [];
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation notes:', error);
    return [];
  }
}

export async function fetchTranslationQuestions(reference: string): Promise<TranslationQuestion[]> {
  try {
    const data = await callProxy('translation-questions', { reference, format: 'json' });
    
    const questions = data.questions || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(questions)) {
      return questions.slice(0, 10).map((q: any, index: number) => ({
        id: q.id || `question-${index}`,
        reference: q.reference || q.ref || q.Reference || reference,
        question: q.question || q.Question || q.text || '',
        response: q.response || q.Response || q.answer || q.Answer || '',
      }));
    }
    
    // If content is markdown string, parse it
    if (typeof data.content === 'string') {
      const qMatches = data.content.matchAll(/\*\*Q:\*\*\s*([^\n]+)\n\*\*A:\*\*\s*([^\n]+)/g);
      const parsedQuestions: TranslationQuestion[] = [];
      for (const match of qMatches) {
        parsedQuestions.push({
          id: `question-${parsedQuestions.length}`,
          reference,
          question: match[1].trim(),
          response: match[2].trim(),
        });
      }
      return parsedQuestions.slice(0, 10);
    }
    
    return [];
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation questions:', error);
    return [];
  }
}

export async function fetchTranslationWordLinks(reference: string): Promise<TranslationWordLink[]> {
  try {
    const data = await callProxy('translation-word-links', { reference });
    
    const links = data.links || data.words || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(links)) {
      return links.slice(0, 8).map((link: any, index: number) => ({
        id: link.id || `word-link-${index}`,
        reference: link.reference || link.ref || link.Reference || reference,
        word: link.word || link.Word || link.term || link.OrigWords || link.text || '',
        articleId: link.articleId || link.article || link.rc || link.TWLink || link.link || '',
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
    // articleId might be a full RC link or just the word name
    const data = await callProxy('translation-word', { articleId });
    
    return {
      id: data.id || articleId,
      term: data.term || data.title || data.name || articleId,
      definition: data.definition || data.brief || data.description || '',
      content: data.content || data.text || data.markdown || data.body || '',
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation word:', error);
    return null;
  }
}

export async function fetchTranslationAcademy(moduleId: string): Promise<TranslationAcademy | null> {
  try {
    const data = await callProxy('translation-academy', { moduleId });
    
    return {
      id: data.id || moduleId,
      title: data.title || data.name || moduleId,
      content: data.content || data.text || data.markdown || data.body || '',
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching academy article:', error);
    return null;
  }
}

// Search across all resources
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
