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

// Parse scripture reference (e.g., "John 3:16-17" -> { book: "JHN", chapter: 3, verse: 16, endVerse: 17 })
function parseReference(reference: string): { book: string; chapter: number; verse?: number; endVerse?: number } {
  const bookMap: Record<string, string> = {
    'genesis': 'GEN', 'gen': 'GEN',
    'exodus': 'EXO', 'exo': 'EXO',
    'leviticus': 'LEV', 'lev': 'LEV',
    'numbers': 'NUM', 'num': 'NUM',
    'deuteronomy': 'DEU', 'deu': 'DEU',
    'joshua': 'JOS', 'jos': 'JOS',
    'judges': 'JDG', 'jdg': 'JDG',
    'ruth': 'RUT', 'rut': 'RUT',
    '1 samuel': '1SA', '1 sam': '1SA', '1sa': '1SA',
    '2 samuel': '2SA', '2 sam': '2SA', '2sa': '2SA',
    '1 kings': '1KI', '1 ki': '1KI', '1ki': '1KI',
    '2 kings': '2KI', '2 ki': '2KI', '2ki': '2KI',
    '1 chronicles': '1CH', '1 chr': '1CH', '1ch': '1CH',
    '2 chronicles': '2CH', '2 chr': '2CH', '2ch': '2CH',
    'ezra': 'EZR', 'ezr': 'EZR',
    'nehemiah': 'NEH', 'neh': 'NEH',
    'esther': 'EST', 'est': 'EST',
    'job': 'JOB',
    'psalms': 'PSA', 'psalm': 'PSA', 'psa': 'PSA', 'ps': 'PSA',
    'proverbs': 'PRO', 'prov': 'PRO', 'pro': 'PRO',
    'ecclesiastes': 'ECC', 'ecc': 'ECC',
    'song of solomon': 'SNG', 'song': 'SNG', 'sng': 'SNG',
    'isaiah': 'ISA', 'isa': 'ISA',
    'jeremiah': 'JER', 'jer': 'JER',
    'lamentations': 'LAM', 'lam': 'LAM',
    'ezekiel': 'EZK', 'ezk': 'EZK', 'eze': 'EZK',
    'daniel': 'DAN', 'dan': 'DAN',
    'hosea': 'HOS', 'hos': 'HOS',
    'joel': 'JOL', 'jol': 'JOL',
    'amos': 'AMO', 'amo': 'AMO',
    'obadiah': 'OBA', 'oba': 'OBA',
    'jonah': 'JON', 'jon': 'JON',
    'micah': 'MIC', 'mic': 'MIC',
    'nahum': 'NAM', 'nam': 'NAM',
    'habakkuk': 'HAB', 'hab': 'HAB',
    'zephaniah': 'ZEP', 'zep': 'ZEP',
    'haggai': 'HAG', 'hag': 'HAG',
    'zechariah': 'ZEC', 'zec': 'ZEC',
    'malachi': 'MAL', 'mal': 'MAL',
    'matthew': 'MAT', 'matt': 'MAT', 'mat': 'MAT',
    'mark': 'MRK', 'mrk': 'MRK',
    'luke': 'LUK', 'luk': 'LUK',
    'john': 'JHN', 'jhn': 'JHN',
    'acts': 'ACT', 'act': 'ACT',
    'romans': 'ROM', 'rom': 'ROM',
    '1 corinthians': '1CO', '1 cor': '1CO', '1co': '1CO',
    '2 corinthians': '2CO', '2 cor': '2CO', '2co': '2CO',
    'galatians': 'GAL', 'gal': 'GAL',
    'ephesians': 'EPH', 'eph': 'EPH',
    'philippians': 'PHP', 'phil': 'PHP', 'php': 'PHP',
    'colossians': 'COL', 'col': 'COL',
    '1 thessalonians': '1TH', '1 thess': '1TH', '1th': '1TH',
    '2 thessalonians': '2TH', '2 thess': '2TH', '2th': '2TH',
    '1 timothy': '1TI', '1 tim': '1TI', '1ti': '1TI',
    '2 timothy': '2TI', '2 tim': '2TI', '2ti': '2TI',
    'titus': 'TIT', 'tit': 'TIT',
    'philemon': 'PHM', 'phm': 'PHM',
    'hebrews': 'HEB', 'heb': 'HEB',
    'james': 'JAS', 'jas': 'JAS',
    '1 peter': '1PE', '1 pet': '1PE', '1pe': '1PE',
    '2 peter': '2PE', '2 pet': '2PE', '2pe': '2PE',
    '1 john': '1JN', '1jn': '1JN',
    '2 john': '2JN', '2jn': '2JN',
    '3 john': '3JN', '3jn': '3JN',
    'jude': 'JUD', 'jud': 'JUD',
    'revelation': 'REV', 'rev': 'REV',
  };

  const match = reference.match(/^(\d?\s?[a-zA-Z]+)\s*(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!match) {
    throw new Error(`Invalid reference format: ${reference}`);
  }

  const bookName = match[1].toLowerCase().trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;
  const endVerse = match[4] ? parseInt(match[4], 10) : undefined;

  const book = bookMap[bookName];
  if (!book) {
    throw new Error(`Unknown book: ${bookName}`);
  }

  return { book, chapter, verse, endVerse };
}

async function callProxy(endpoint: string, params: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
    body: { endpoint, params },
  });

  if (error) {
    console.error(`Proxy error for ${endpoint}:`, error);
    throw new Error(error.message);
  }

  if (data?.error) {
    console.error(`API error for ${endpoint}:`, data.error);
    throw new Error(data.error);
  }

  return data;
}

export async function fetchScripture(reference: string): Promise<ScriptureResponse> {
  try {
    const parsed = parseReference(reference);
    const verseRange = parsed.verse 
      ? (parsed.endVerse ? `${parsed.verse}-${parsed.endVerse}` : `${parsed.verse}`)
      : undefined;

    const data = await callProxy('fetch-scripture', {
      book: parsed.book,
      chapter: parsed.chapter,
      ...(verseRange && { verse: verseRange }),
    });
    
    // Parse the scripture content - handle markdown format
    let content = data.content || data.text || '';
    const verses: ScriptureVerse[] = [];
    
    // Check if content contains verse markers like \v 16 or just numbers
    if (content.includes('\\v ')) {
      // USFM format - parse verse markers
      const versePattern = /\\v\s+(\d+)\s+([^\\]+)/g;
      let match;
      while ((match = versePattern.exec(content)) !== null) {
        verses.push({
          number: parseInt(match[1], 10),
          text: match[2].trim().replace(/\s+/g, ' '),
        });
      }
    } else {
      // Try standard verse number pattern
      const verseMatches = content.matchAll(/(\d+)\s+([^0-9]+)/g);
      for (const match of verseMatches) {
        verses.push({
          number: parseInt(match[1], 10),
          text: match[2].trim(),
        });
      }
    }

    // If no verses parsed, treat entire content as single verse
    if (verses.length === 0 && content) {
      // Clean up any remaining USFM markers
      content = content.replace(/\\[a-z]+\s*/g, '').trim();
      verses.push({
        number: parsed.verse || 1,
        text: content,
      });
    }

    return {
      reference,
      translation: data.translation || data.resource || 'unfoldingWord Literal Text',
      text: content,
      verses,
    };
  } catch (error) {
    console.error('Error fetching scripture:', error);
    throw error;
  }
}

export async function fetchTranslationNotes(reference: string): Promise<TranslationNote[]> {
  try {
    const parsed = parseReference(reference);

    const data = await callProxy('fetch-translation-notes', {
      book: parsed.book,
      chapter: parsed.chapter,
      ...(parsed.verse && { verse: parsed.verse }),
    });
    
    // Handle various response formats
    const notes = data.notes || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(notes)) {
      return notes.slice(0, 10).map((note: any, index: number) => ({
        id: note.id || `note-${index}`,
        reference: note.reference || note.ref || reference,
        quote: note.quote || note.Quote || note.original || '',
        note: note.note || note.Note || note.content || note.text || note.OccurrenceNote || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching translation notes:', error);
    return [];
  }
}

export async function fetchTranslationQuestions(reference: string): Promise<TranslationQuestion[]> {
  try {
    const parsed = parseReference(reference);

    const data = await callProxy('fetch-translation-questions', {
      book: parsed.book,
      chapter: parsed.chapter,
      ...(parsed.verse && { verse: parsed.verse }),
    });
    
    const questions = data.questions || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(questions)) {
      return questions.slice(0, 10).map((q: any, index: number) => ({
        id: q.id || `question-${index}`,
        reference: q.reference || q.ref || reference,
        question: q.question || q.Question || q.text || '',
        response: q.response || q.Response || q.answer || q.Answer || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching translation questions:', error);
    return [];
  }
}

export async function fetchTranslationWordLinks(reference: string): Promise<TranslationWordLink[]> {
  try {
    const parsed = parseReference(reference);

    const data = await callProxy('fetch-translation-word-links', {
      book: parsed.book,
      chapter: parsed.chapter,
      ...(parsed.verse && { verse: parsed.verse }),
    });
    
    const links = data.links || data.words || data.content || data.data || (Array.isArray(data) ? data : []);
    
    if (Array.isArray(links)) {
      return links.slice(0, 5).map((link: any, index: number) => ({
        id: link.id || `word-link-${index}`,
        reference: link.reference || link.ref || reference,
        word: link.word || link.Word || link.term || link.OrigWords || '',
        articleId: link.articleId || link.article || link.rc || link.TWLink || '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching word links:', error);
    return [];
  }
}

export async function fetchTranslationWord(articleId: string): Promise<TranslationWord | null> {
  try {
    const data = await callProxy('fetch-translation-word', { articleId });
    
    return {
      id: data.id || articleId,
      term: data.term || data.title || data.name || '',
      definition: data.definition || data.brief || data.description || '',
      content: data.content || data.text || data.markdown || data.body || '',
    };
  } catch (error) {
    console.error('Error fetching translation word:', error);
    return null;
  }
}

export async function fetchTranslationAcademy(moduleId: string): Promise<TranslationAcademy | null> {
  try {
    const data = await callProxy('fetch-translation-academy', { moduleId });
    
    return {
      id: data.id || moduleId,
      title: data.title || data.name || '',
      content: data.content || data.text || data.markdown || data.body || '',
    };
  } catch (error) {
    console.error('Error fetching academy article:', error);
    return null;
  }
}

// Search across all resources
export async function searchResources(query: string): Promise<any[]> {
  try {
    const data = await callProxy('search', { query });
    return data.results || data.data || (Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Error searching resources:', error);
    return [];
  }
}
