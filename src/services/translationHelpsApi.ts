import { supabase } from '@/integrations/supabase/client';

export interface ScriptureVerse {
  number: number;
  text: string;
  isParagraphEnd?: boolean;
}

export interface ScriptureResponse {
  reference: string;
  translation: string;
  text: string;
  verses: ScriptureVerse[];
  metadata?: {
    language: string;
    organization: string;
    availableTranslations: string[];
    license: string;
  };
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

// Get the current language from localStorage
function getCurrentLanguage(): string {
  return localStorage.getItem('bible-study-language') || 'en';
}

async function callProxy(endpoint: string, params: Record<string, any>) {
  // Inject language parameter if not already present
  const language = params.language || getCurrentLanguage();
  const paramsWithLanguage = { ...params, language };
  
  console.log(`[translationHelpsApi] Calling ${endpoint} with params:`, paramsWithLanguage);
  
  const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
    body: { endpoint, params: paramsWithLanguage },
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

// Parse YAML frontmatter from markdown content
function parseYamlFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return { metadata: {}, body: content };
  }

  const yamlContent = frontmatterMatch[1];
  const body = frontmatterMatch[2];
  
  const metadata: Record<string, string> = {};
  yamlContent.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      metadata[match[1]] = match[2].trim();
    }
  });

  return { metadata, body };
}

// Parse scripture content - extract ULT translation with proper verse handling
function parseScriptureMarkdown(content: string, reference: string): { 
  verses: ScriptureVerse[]; 
  translation: string;
  metadata?: ScriptureResponse['metadata'];
} {
  const verses: ScriptureVerse[] = [];
  let translation = 'unfoldingWord Literal Text';
  
  // Parse YAML frontmatter
  const { metadata, body } = parseYamlFrontmatter(content);
  
  const scriptureMetadata: ScriptureResponse['metadata'] = metadata.language ? {
    language: metadata.language || 'en',
    organization: metadata.organization || 'unfoldingWord',
    availableTranslations: (metadata.resources || '').split(',').map(s => s.trim()),
    license: metadata.license || 'CC BY-SA 4.0',
  } : undefined;

  // Find the ULT section - this is the primary translation we want to display
  // Format: **ULT v87 (unfoldingWord® Literal Text)**\n\nContent...
  const ultMatch = body.match(/\*\*ULT v\d+[^*]*\*\*\s*\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/);
  
  if (ultMatch) {
    translation = 'unfoldingWord Literal Text';
    const ultContent = ultMatch[1].trim();
    
    // Parse verses from ULT content
    // Format: "1 Text of verse one. 2 Text of verse two. \"
    // Backslash \ indicates paragraph end
    
    // Split into segments by verse numbers
    // Pattern: Look for numbers at the start or after paragraph breaks
    const versePattern = /(?:^|\s)(\d+)\s+/g;
    const potentialMatches: { index: number; verseNum: number }[] = [];
    let match;
    
    while ((match = versePattern.exec(ultContent)) !== null) {
      potentialMatches.push({ index: match.index, verseNum: parseInt(match[1], 10) });
    }
    
    // Filter to only valid verse numbers - they must be in ascending order
    // with reasonable gaps (to handle verse ranges like "16-18")
    const validMatches: { index: number; verseNum: number }[] = [];
    let lastVerseNum = 0;
    
    for (const pm of potentialMatches) {
      // Valid verse number must be:
      // 1. Greater than the last verse
      // 2. Not more than ~10 verses ahead (to handle ranges, but catch random numbers like "70")
      const isValidSequence = pm.verseNum > lastVerseNum && pm.verseNum <= lastVerseNum + 10;
      
      // Special case: first verse can be 1 or start of a passage
      const isFirstVerse = validMatches.length === 0 && pm.verseNum >= 1 && pm.verseNum <= 50;
      
      if (isValidSequence || isFirstVerse) {
        validMatches.push(pm);
        lastVerseNum = pm.verseNum;
      }
    }
    
    // Extract text for each verse
    for (let i = 0; i < validMatches.length; i++) {
      const current = validMatches[i];
      const next = validMatches[i + 1];
      
      // Get the start position after the verse number
      const verseNumStr = current.verseNum.toString();
      const textStart = current.index + ultContent.slice(current.index).indexOf(verseNumStr) + verseNumStr.length;
      const textEnd = next ? next.index : ultContent.length;
      
      let verseText = ultContent.slice(textStart, textEnd).trim();
      
      // Check if this verse ends with a paragraph marker (backslash)
      const isParagraphEnd = verseText.endsWith('\\');
      
      // Clean up the verse text
      verseText = verseText
        .replace(/\\\s*$/, '') // Remove trailing backslash
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (verseText) {
        verses.push({
          number: current.verseNum,
          text: verseText,
          isParagraphEnd,
        });
      }
    }
  }
  
  // Fallback: if no ULT section found, try to parse any numbered content
  if (verses.length === 0) {
    console.log('[parseScriptureMarkdown] No ULT section found, using fallback parsing');
    
    // Try to find any section with verse-like content
    const lines = body.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      // Skip headers and empty lines for this parsing
      if (line.startsWith('#') || line.startsWith('**') || !line.trim()) {
        if (currentSection && !line.startsWith('**')) continue;
        currentSection = line;
        continue;
      }
      
      // Try to parse verses from this line
      const versePattern = /(\d+)\s+([^0-9]+?)(?=\d+\s|$|\\)/g;
      let match;
      
      while ((match = versePattern.exec(line)) !== null) {
        const verseNum = parseInt(match[1], 10);
        let verseText = match[2].trim();
        const isParagraphEnd = verseText.endsWith('\\') || line.endsWith('\\');
        verseText = verseText.replace(/\\\s*$/, '').trim();
        
        if (verseText && verseNum > 0) {
          // Avoid duplicates
          if (!verses.find(v => v.number === verseNum)) {
            verses.push({ number: verseNum, text: verseText, isParagraphEnd });
          }
        }
      }
    }
  }

  console.log('[parseScriptureMarkdown] Parsed verses:', verses.length);
  
  return { verses, translation, metadata: scriptureMetadata };
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
    
    console.log('[translationHelpsApi] Raw scripture content preview:', content.substring(0, 500));
    
    const { verses, translation, metadata } = parseScriptureMarkdown(content, reference);

    return {
      reference: data.reference || reference,
      translation,
      text: content,
      verses: verses.length > 0 ? verses : [{ number: 1, text: 'Scripture content not available' }],
      metadata,
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching scripture:', error);
    throw error;
  }
}

// Bible book chapter counts
const BOOK_CHAPTERS: Record<string, number> = {
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
  'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
  'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14,
  'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7, 'Nahum': 3,
  'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
  'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6,
  'Ephesians': 6, 'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5,
  '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
  'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
  '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22,
};

export interface BookChapter {
  chapter: number;
  verses: ScriptureVerse[];
}

export interface BookData {
  book: string;
  chapters: BookChapter[];
  translation: string;
  metadata?: ScriptureResponse['metadata'];
}

// Fetch entire book - all chapters
export async function fetchBook(bookName: string): Promise<BookData> {
  const totalChapters = BOOK_CHAPTERS[bookName];
  if (!totalChapters) {
    throw new Error(`Unknown book: ${bookName}`);
  }

  console.log(`[translationHelpsApi] Fetching full book: ${bookName} (${totalChapters} chapters)`);

  // Fetch all chapters in parallel (batch to avoid overwhelming the API)
  const chapters: BookChapter[] = [];
  const batchSize = 5;
  
  for (let i = 1; i <= totalChapters; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, totalChapters + 1); j++) {
      batch.push(j);
    }
    
    const batchResults = await Promise.all(
      batch.map(async (chapterNum) => {
        try {
          const reference = `${bookName} ${chapterNum}`;
          const data = await callProxy('fetch-scripture', { reference });
          const content = data.content || data.text || '';
          const { verses } = parseScriptureMarkdown(content, reference);
          return { chapter: chapterNum, verses };
        } catch (err) {
          console.error(`[fetchBook] Failed to fetch ${bookName} ${chapterNum}:`, err);
          return { chapter: chapterNum, verses: [] };
        }
      })
    );
    
    chapters.push(...batchResults);
  }

  // Sort by chapter number
  chapters.sort((a, b) => a.chapter - b.chapter);

  // Get metadata from first chapter
  let translation = 'unfoldingWord Literal Text';
  let metadata: ScriptureResponse['metadata'] | undefined;

  if (chapters.length > 0 && chapters[0].verses.length > 0) {
    try {
      const firstChapterRef = `${bookName} 1`;
      const firstData = await callProxy('fetch-scripture', { reference: firstChapterRef });
      const content = firstData.content || '';
      const parsed = parseScriptureMarkdown(content, firstChapterRef);
      translation = parsed.translation;
      metadata = parsed.metadata;
    } catch {
      // Use defaults
    }
  }

  console.log(`[translationHelpsApi] Fetched ${bookName}: ${chapters.length} chapters, ${chapters.reduce((sum, c) => sum + c.verses.length, 0)} total verses`);

  return {
    book: bookName,
    chapters,
    translation,
    metadata,
  };
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
      title,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    };
  } catch (error) {
    console.error('[translationHelpsApi] Error fetching translation academy:', error);
    return null;
  }
}

export async function searchResources(query: string, resource: string): Promise<any[]> {
  try {
    const data = await callProxy('search', { query, resource });
    return data?.hits || [];
  } catch (error) {
    console.error('[translationHelpsApi] Error searching resources:', error);
    return [];
  }
}
