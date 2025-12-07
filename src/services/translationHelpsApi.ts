const API_BASE = 'https://translation-helps-mcp.pages.dev';

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

export async function fetchScripture(reference: string): Promise<ScriptureResponse> {
  try {
    const parsed = parseReference(reference);
    const verseRange = parsed.verse 
      ? (parsed.endVerse ? `${parsed.verse}-${parsed.endVerse}` : `${parsed.verse}`)
      : undefined;

    const params = new URLSearchParams({
      book: parsed.book,
      chapter: parsed.chapter.toString(),
      ...(verseRange && { verse: verseRange }),
    });

    const response = await fetch(`${API_BASE}/fetch-scripture?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch scripture: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the scripture content
    const content = data.content || data.text || '';
    const verses: ScriptureVerse[] = [];
    
    // Try to parse verse numbers from content
    const verseMatches = content.matchAll(/(\d+)\s*([^0-9]+)/g);
    for (const match of verseMatches) {
      verses.push({
        number: parseInt(match[1], 10),
        text: match[2].trim(),
      });
    }

    // If no verses parsed, treat entire content as single verse
    if (verses.length === 0 && content) {
      verses.push({
        number: parsed.verse || 1,
        text: content.trim(),
      });
    }

    return {
      reference,
      translation: data.translation || 'unfoldingWord Literal Text',
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
    const params = new URLSearchParams({
      book: parsed.book,
      chapter: parsed.chapter.toString(),
      ...(parsed.verse && { verse: parsed.verse.toString() }),
    });

    const response = await fetch(`${API_BASE}/fetch-translation-notes?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch translation notes: ${response.statusText}`);
    }

    const data = await response.json();
    const notes = data.notes || data.content || data || [];
    
    if (Array.isArray(notes)) {
      return notes.map((note: any, index: number) => ({
        id: note.id || `note-${index}`,
        reference: note.reference || reference,
        quote: note.quote || note.original || '',
        note: note.note || note.content || note.text || '',
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
    const params = new URLSearchParams({
      book: parsed.book,
      chapter: parsed.chapter.toString(),
      ...(parsed.verse && { verse: parsed.verse.toString() }),
    });

    const response = await fetch(`${API_BASE}/fetch-translation-questions?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch translation questions: ${response.statusText}`);
    }

    const data = await response.json();
    const questions = data.questions || data.content || data || [];
    
    if (Array.isArray(questions)) {
      return questions.map((q: any, index: number) => ({
        id: q.id || `question-${index}`,
        reference: q.reference || reference,
        question: q.question || q.text || '',
        response: q.response || q.answer || '',
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
    const params = new URLSearchParams({
      book: parsed.book,
      chapter: parsed.chapter.toString(),
      ...(parsed.verse && { verse: parsed.verse.toString() }),
    });

    const response = await fetch(`${API_BASE}/fetch-translation-word-links?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch word links: ${response.statusText}`);
    }

    const data = await response.json();
    const links = data.links || data.words || data.content || data || [];
    
    if (Array.isArray(links)) {
      return links.map((link: any, index: number) => ({
        id: link.id || `word-link-${index}`,
        reference: link.reference || reference,
        word: link.word || link.term || '',
        articleId: link.articleId || link.article || link.rc || '',
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
    const params = new URLSearchParams({ articleId });

    const response = await fetch(`${API_BASE}/fetch-translation-word?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch translation word: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id || articleId,
      term: data.term || data.title || '',
      definition: data.definition || data.brief || '',
      content: data.content || data.text || data.markdown || '',
    };
  } catch (error) {
    console.error('Error fetching translation word:', error);
    return null;
  }
}

export async function fetchTranslationAcademy(moduleId: string): Promise<TranslationAcademy | null> {
  try {
    const params = new URLSearchParams({ moduleId });

    const response = await fetch(`${API_BASE}/fetch-translation-academy?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch academy article: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id || moduleId,
      title: data.title || data.name || '',
      content: data.content || data.text || data.markdown || '',
    };
  } catch (error) {
    console.error('Error fetching academy article:', error);
    return null;
  }
}

// Search across all resources
export async function searchResources(query: string): Promise<any[]> {
  try {
    const params = new URLSearchParams({ query });

    const response = await fetch(`${API_BASE}/search?${params}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || data || [];
  } catch (error) {
    console.error('Error searching resources:', error);
    return [];
  }
}
