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

// Get the current language from resource preferences or fallback to primary
function getCurrentLanguage(): string {
  // Support both new and old localStorage keys for backward compatibility
  const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
  if (prefsJson) {
    try {
      const prefs = JSON.parse(prefsJson);
      if (prefs.length > 0) {
        return prefs[0].language;
      }
    } catch {}
  }
  return localStorage.getItem('bible-study-language') || 'en';
}

// Get the current organization from resource preferences or fallback to primary
function getCurrentOrganization(): string {
  // Support both new and old localStorage keys for backward compatibility
  const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
  if (prefsJson) {
    try {
      const prefs = JSON.parse(prefsJson);
      if (prefs.length > 0) {
        return prefs[0].organization;
      }
    } catch {}
  }
  return localStorage.getItem('bible-study-organization') || 'unfoldingWord';
}

// Get the current scripture resource from resource preferences (ult, ust, ulb, udb)
function getCurrentResource(): string {
  // Support both new and old localStorage keys for backward compatibility
  const prefsJson = localStorage.getItem('bible-study-resource-preferences') || localStorage.getItem('bible-study-version-preferences');
  if (prefsJson) {
    try {
      const prefs = JSON.parse(prefsJson);
      if (prefs.length > 0 && prefs[0].resource) {
        return prefs[0].resource;
      }
    } catch {}
  }
  return 'ult'; // Default to ULT
}

export interface FallbackInfo {
  usedFallback: boolean;
  requestedLanguage: string;
  requestedOrganization: string;
  actualLanguage: string;
  actualOrganization: string;
}

interface ProxyResponse {
  data: any;
  fallbackInfo: FallbackInfo;
}

async function callProxyWithFallback(endpoint: string, params: Record<string, any>, throwOnError = true): Promise<ProxyResponse> {
  const requestedLanguage = params.language || getCurrentLanguage();
  const requestedOrganization = params.organization || getCurrentOrganization();
  const paramsWithDefaults = { ...params, language: requestedLanguage, organization: requestedOrganization };
  
  console.log(`[translationHelpsApi] Calling ${endpoint} with params:`, paramsWithDefaults);
  
  // Try with requested language/org first
  let { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
    body: { endpoint, params: paramsWithDefaults },
  });

  let usedFallback = false;
  let actualLanguage = requestedLanguage;
  let actualOrganization = requestedOrganization;

  // Check if we got empty/error response and need to fallback to English
  // Also check for invoke-level errors (e.g., 404/500 from proxy)
  const hasError = error || data?.error;
  const isEmpty = !data || 
    (data?.content === '' && !data?.hits?.length) ||
    (Array.isArray(data) && data.length === 0) ||
    (data?.total_hits === 0);
  
  const needsFallback = (hasError || isEmpty) && requestedLanguage !== 'en';

  if (needsFallback) {
    console.log(`[translationHelpsApi] No content or error for ${requestedLanguage}, falling back to English/unfoldingWord`);
    
    const fallbackParams = { ...params, language: 'en', organization: 'unfoldingWord' };
    const fallbackResult = await supabase.functions.invoke('translation-helps-proxy', {
      body: { endpoint, params: fallbackParams },
    });

    if (!fallbackResult.error && fallbackResult.data && !fallbackResult.data.error) {
      data = fallbackResult.data;
      error = null;
      usedFallback = true;
      actualLanguage = 'en';
      actualOrganization = 'unfoldingWord';
      console.log(`[translationHelpsApi] Fallback successful for ${endpoint}`);
    } else {
      // Both primary and fallback failed - return empty data gracefully
      console.log(`[translationHelpsApi] Both primary and fallback failed for ${endpoint}, returning empty`);
      return {
        data: { content: '', hits: [] },
        fallbackInfo: {
          usedFallback: true,
          requestedLanguage,
          requestedOrganization,
          actualLanguage: 'en',
          actualOrganization: 'unfoldingWord',
        }
      };
    }
  }

  // Handle errors gracefully - don't throw for missing resources
  if (error || data?.error) {
    const errorMsg = error?.message || data?.error || 'Unknown error';
    console.warn(`[translationHelpsApi] Error for ${endpoint}: ${errorMsg}`);
    
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    
    // Return empty data for graceful degradation
    return {
      data: { content: '', hits: [] },
      fallbackInfo: {
        usedFallback,
        requestedLanguage,
        requestedOrganization,
        actualLanguage,
        actualOrganization,
      }
    };
  }

  console.log(`[translationHelpsApi] Response for ${endpoint}:`, data);
  
  return {
    data,
    fallbackInfo: {
      usedFallback,
      requestedLanguage,
      requestedOrganization,
      actualLanguage,
      actualOrganization,
    }
  };
}

// Legacy function for backwards compatibility - graceful fallback, no throws
async function callProxy(endpoint: string, params: Record<string, any>) {
  const result = await callProxyWithFallback(endpoint, params, false);
  return result.data;
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

// Parse scripture content - extract requested translation with proper verse handling
function parseScriptureMarkdown(content: string, reference: string, resource: string = 'ult'): { 
  verses: ScriptureVerse[]; 
  translation: string;
  metadata?: ScriptureResponse['metadata'];
} {
  const verses: ScriptureVerse[] = [];
  
  // Map resource ID to section header pattern and display name
  const resourcePatterns: Record<string, { pattern: RegExp; displayName: string }> = {
    'ult': { 
      pattern: /\*\*ULT v\d+[^*]*\*\*\s*\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/, 
      displayName: 'unfoldingWord Literal Text' 
    },
    'ust': { 
      pattern: /\*\*UST v\d+[^*]*\*\*\s*\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/, 
      displayName: 'unfoldingWord Simplified Text' 
    },
    'ulb': { 
      pattern: /\*\*ULB v\d+[^*]*\*\*\s*\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/, 
      displayName: 'Unlocked Literal Bible' 
    },
    'udb': { 
      pattern: /\*\*UDB v\d+[^*]*\*\*\s*\n\n([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/, 
      displayName: 'Unlocked Dynamic Bible' 
    },
  };
  
  const resourceConfig = resourcePatterns[resource.toLowerCase()] || resourcePatterns['ult'];
  let translation = resourceConfig.displayName;
  
  // Parse YAML frontmatter
  const { metadata, body } = parseYamlFrontmatter(content);
  
  const scriptureMetadata: ScriptureResponse['metadata'] = metadata.language ? {
    language: metadata.language || 'en',
    organization: metadata.organization || 'unfoldingWord',
    availableTranslations: (metadata.resources || '').split(',').map(s => s.trim()),
    license: metadata.license || 'CC BY-SA 4.0',
  } : undefined;

  // Find the requested translation section
  const translationMatch = body.match(resourceConfig.pattern);
  
  // Fallback to ULT if requested resource not found
  let contentToProcess = '';
  if (translationMatch) {
    contentToProcess = translationMatch[1].trim();
  } else if (resource.toLowerCase() !== 'ult') {
    // Try ULT as fallback
    const ultMatch = body.match(resourcePatterns['ult'].pattern);
    if (ultMatch) {
      contentToProcess = ultMatch[1].trim();
      translation = resourcePatterns['ult'].displayName + ' (fallback)';
      console.log(`[parseScriptureMarkdown] ${resource.toUpperCase()} not found, falling back to ULT`);
    }
  }
  
  if (contentToProcess) {
    // Parse verses from content
    // Format: "1 Text of verse one. 2 Text of verse two. \"
    // Backslash \ indicates paragraph end
    
    // Split into segments by verse numbers
    // Pattern: Look for numbers at the start or after paragraph breaks
    const versePattern = /(?:^|\s)(\d+)\s+/g;
    const potentialMatches: { index: number; verseNum: number }[] = [];
    let match;
    
    while ((match = versePattern.exec(contentToProcess)) !== null) {
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
      const textStart = current.index + contentToProcess.slice(current.index).indexOf(verseNumStr) + verseNumStr.length;
      const textEnd = next ? next.index : contentToProcess.length;
      
      let verseText = contentToProcess.slice(textStart, textEnd).trim();
      
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
  
  // Fallback: if no section found, try to parse any numbered content
  if (verses.length === 0) {
    console.log('[parseScriptureMarkdown] No translation section found, using fallback parsing');
    
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

  console.log('[parseScriptureMarkdown] Parsed verses:', verses.length, 'for', resource.toUpperCase());
  
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
    const resource = getCurrentResource();
    const data = await callProxy('fetch-scripture', { reference, resource });
    const content = data.content || data.text || '';
    
    console.log('[translationHelpsApi] Raw scripture content preview:', content.substring(0, 500));
    
    const { verses, translation, metadata } = parseScriptureMarkdown(content, reference, resource);

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

// Map non-English book names and abbreviations to English (for book chapter lookup)
// Combined Spanish, Portuguese, French + common abbreviations
const BOOK_NAME_ALIASES: Record<string, string> = {
  // Common abbreviations
  'Gen': 'Genesis', 'Exo': 'Exodus', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', 'Jdg': 'Judges', 'Rth': 'Ruth',
  '1Sam': '1 Samuel', '2Sam': '2 Samuel', '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1 Kgs': '1 Kings', '2 Kgs': '2 Kings',
  '1Chr': '1 Chronicles', '2Chr': '2 Chronicles', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
  'Neh': 'Nehemiah', 'Est': 'Esther', 'Psa': 'Psalms', 'Ps': 'Psalms', 'Pss': 'Psalms',
  'Pro': 'Proverbs', 'Prov': 'Proverbs', 'Ecc': 'Ecclesiastes', 'Eccl': 'Ecclesiastes',
  'Song': 'Song of Solomon', 'Sos': 'Song of Solomon', 'SOS': 'Song of Solomon', 'SS': 'Song of Solomon',
  'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Eze': 'Ezekiel',
  'Dan': 'Daniel', 'Hos': 'Hosea', 'Joe': 'Joel', 'Amo': 'Amos', 'Oba': 'Obadiah', 'Obad': 'Obadiah',
  'Jon': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zep': 'Zephaniah', 'Zeph': 'Zephaniah',
  'Hag': 'Haggai', 'Zec': 'Zechariah', 'Zech': 'Zechariah', 'Mal': 'Malachi',
  'Mat': 'Matthew', 'Matt': 'Matthew', 'Mrk': 'Mark', 'Luk': 'Luke', 'Joh': 'John', 'Jn': 'John',
  'Act': 'Acts', 'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians', '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians',
  'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Php': 'Philippians',
  'Col': 'Colossians', '1Th': '1 Thessalonians', '2Th': '2 Thessalonians', '1 Th': '1 Thessalonians', '2 Th': '2 Thessalonians',
  '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1 Thess': '1 Thessalonians', '2 Thess': '2 Thessalonians',
  '1Tim': '1 Timothy', '2Tim': '2 Timothy', '1 Tim': '1 Timothy', '2 Tim': '2 Timothy',
  'Tit': 'Titus', 'Phm': 'Philemon', 'Phlm': 'Philemon', 'Heb': 'Hebrews', 'Jas': 'James', 'Jam': 'James',
  '1Pet': '1 Peter', '2Pet': '2 Peter', '1 Pet': '1 Peter', '2 Pet': '2 Peter',
  '1Jn': '1 John', '2Jn': '2 John', '3Jn': '3 John', '1 Jn': '1 John', '2 Jn': '2 John', '3 Jn': '3 John',
  '1John': '1 John', '2John': '2 John', '3John': '3 John',
  'Jud': 'Jude', 'Rev': 'Revelation', 'Apo': 'Revelation',
  // Spanish / Portuguese / French (unique entries only)
  'Génesis': 'Genesis', 'Gênesis': 'Genesis', 'Genèse': 'Genesis',
  'Éxodo': 'Exodus', 'Êxodo': 'Exodus', 'Exode': 'Exodus',
  'Levítico': 'Leviticus', 'Lévitique': 'Leviticus',
  'Números': 'Numbers', 'Nombres': 'Numbers',
  'Deuteronomio': 'Deuteronomy', 'Deutéronome': 'Deuteronomy',
  'Josué': 'Joshua', 'Jueces': 'Judges', 'Juízes': 'Judges', 'Juges': 'Judges',
  'Rut': 'Ruth', 'Rute': 'Ruth',
  '1 Reyes': '1 Kings', '1 Reis': '1 Kings', '1 Rois': '1 Kings',
  '2 Reyes': '2 Kings', '2 Reis': '2 Kings', '2 Rois': '2 Kings',
  '1 Crónicas': '1 Chronicles', '1 Crônicas': '1 Chronicles', '1 Chroniques': '1 Chronicles',
  '2 Crónicas': '2 Chronicles', '2 Crônicas': '2 Chronicles', '2 Chroniques': '2 Chronicles',
  'Esdras': 'Ezra', 'Nehemías': 'Nehemiah', 'Neemias': 'Nehemiah', 'Néhémie': 'Nehemiah',
  'Ester': 'Esther', 'Jó': 'Job',
  'Salmos': 'Psalms', 'Salmo': 'Psalms', 'Psaumes': 'Psalms',
  'Proverbios': 'Proverbs', 'Provérbios': 'Proverbs', 'Proverbes': 'Proverbs',
  'Eclesiastés': 'Ecclesiastes', 'Eclesiastes': 'Ecclesiastes', 'Ecclésiaste': 'Ecclesiastes',
  'Cantares': 'Song of Solomon', 'Cantar de los Cantares': 'Song of Solomon', 'Cânticos': 'Song of Solomon', 'Cantares de Salomão': 'Song of Solomon', 'Cantique des Cantiques': 'Song of Solomon',
  'Isaías': 'Isaiah', 'Ésaïe': 'Isaiah',
  'Jeremías': 'Jeremiah', 'Jeremias': 'Jeremiah', 'Jérémie': 'Jeremiah',
  'Lamentaciones': 'Lamentations', 'Lamentações': 'Lamentations',
  'Ezequiel': 'Ezekiel', 'Ézéchiel': 'Ezekiel',
  'Oseas': 'Hosea', 'Oséias': 'Hosea', 'Osée': 'Hosea',
  'Joël': 'Joel',
  'Abdías': 'Obadiah', 'Obadias': 'Obadiah', 'Abdias': 'Obadiah',
  'Jonás': 'Jonah', 'Jonas': 'Jonah',
  'Miqueas': 'Micah', 'Miquéias': 'Micah', 'Michée': 'Micah',
  'Nahúm': 'Nahum', 'Naum': 'Nahum',
  'Habacuc': 'Habakkuk', 'Habacuque': 'Habakkuk',
  'Sofonías': 'Zephaniah', 'Sofonias': 'Zephaniah', 'Sophonie': 'Zephaniah',
  'Hageo': 'Haggai', 'Ageu': 'Haggai', 'Aggée': 'Haggai',
  'Zacarías': 'Zechariah', 'Zacarias': 'Zechariah', 'Zacharie': 'Zechariah',
  'Malaquías': 'Malachi', 'Malaquias': 'Malachi', 'Malachie': 'Malachi',
  'Mateo': 'Matthew', 'Mateus': 'Matthew', 'Matthieu': 'Matthew',
  'Marcos': 'Mark', 'Marc': 'Mark',
  'Lucas': 'Luke', 'Luc': 'Luke',
  'Juan': 'John', 'João': 'John', 'Jean': 'John',
  'Hechos': 'Acts', 'Atos': 'Acts', 'Actes': 'Acts',
  'Romanos': 'Romans', 'Romains': 'Romans',
  '1 Corintios': '1 Corinthians', '1 Coríntios': '1 Corinthians', '1 Corinthiens': '1 Corinthians',
  '2 Corintios': '2 Corinthians', '2 Coríntios': '2 Corinthians', '2 Corinthiens': '2 Corinthians',
  'Gálatas': 'Galatians', 'Galates': 'Galatians',
  'Efesios': 'Ephesians', 'Efésios': 'Ephesians', 'Éphésiens': 'Ephesians',
  'Filipenses': 'Philippians', 'Philippiens': 'Philippians',
  'Colosenses': 'Colossians', 'Colossenses': 'Colossians',
  '1 Tesalonicenses': '1 Thessalonians', '1 Tessalonicenses': '1 Thessalonians', '1 Thessaloniciens': '1 Thessalonians',
  '2 Tesalonicenses': '2 Thessalonians', '2 Tessalonicenses': '2 Thessalonians', '2 Thessaloniciens': '2 Thessalonians',
  '1 Timoteo': '1 Timothy', '1 Timóteo': '1 Timothy', '1 Timothée': '1 Timothy',
  '2 Timoteo': '2 Timothy', '2 Timóteo': '2 Timothy', '2 Timothée': '2 Timothy',
  'Tito': 'Titus',
  'Filemón': 'Philemon', 'Filemon': 'Philemon', 'Filemom': 'Philemon', 'Philémon': 'Philemon',
  'Hebreos': 'Hebrews', 'Hébreux': 'Hebrews',
  'Santiago': 'James', 'Tiago': 'James', 'Jacques': 'James',
  '1 Pedro': '1 Peter', '1 Pierre': '1 Peter',
  '2 Pedro': '2 Peter', '2 Pierre': '2 Peter',
  '1 Juan': '1 John', '1 João': '1 John',
  '2 Juan': '2 John', '2 João': '2 John',
  '3 Juan': '3 John', '3 João': '3 John',
  'Judas': 'Jude',
  'Apocalipsis': 'Revelation', 'Apocalipse': 'Revelation', 'Apocalypse': 'Revelation',
};

// Normalize book name to English for chapter count lookup
function normalizeBookName(bookName: string): string {
  // First check if it's already in the BOOK_CHAPTERS map (English name)
  if (BOOK_CHAPTERS[bookName]) {
    return bookName;
  }
  // Check alias map (case-insensitive for robustness)
  const normalized = BOOK_NAME_ALIASES[bookName];
  if (normalized) {
    return normalized;
  }
  // Try case-insensitive match
  const lowerBookName = bookName.toLowerCase();
  for (const [alias, english] of Object.entries(BOOK_NAME_ALIASES)) {
    if (alias.toLowerCase() === lowerBookName) {
      return english;
    }
  }
  // Return original if no match found
  return bookName;
}

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
  const normalizedName = normalizeBookName(bookName);
  const totalChapters = BOOK_CHAPTERS[normalizedName];
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
    
    const resource = getCurrentResource();
    const batchResults = await Promise.all(
      batch.map(async (chapterNum) => {
        try {
          const reference = `${bookName} ${chapterNum}`;
          const data = await callProxy('fetch-scripture', { reference, resource });
          const content = data.content || data.text || '';
          const { verses } = parseScriptureMarkdown(content, reference, resource);
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
      const resource = getCurrentResource();
      const firstChapterRef = `${bookName} 1`;
      const firstData = await callProxy('fetch-scripture', { reference: firstChapterRef, resource });
      const content = firstData.content || '';
      const parsed = parseScriptureMarkdown(content, firstChapterRef, resource);
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

export interface BookDataWithFallback extends BookData {
  fallbackInfo: FallbackInfo;
}

// Fetch entire book with fallback support
// resourceOverride: if provided, use this resource instead of reading from localStorage
export async function fetchBookWithFallback(bookName: string, resourceOverride?: string): Promise<BookDataWithFallback> {
  const normalizedName = normalizeBookName(bookName);
  const totalChapters = BOOK_CHAPTERS[normalizedName];
  if (!totalChapters) {
    throw new Error(`Unknown book: ${bookName}`);
  }

  const requestedLanguage = getCurrentLanguage();
  const requestedOrganization = getCurrentOrganization();
  const resource = resourceOverride || getCurrentResource();

  console.log(`[translationHelpsApi] Fetching full book with fallback: ${bookName} (${requestedLanguage}/${requestedOrganization}, resource: ${resource})`);

  // Try first chapter to detect if fallback is needed
  const firstRef = `${bookName} 1`;
  const firstResult = await callProxyWithFallback('fetch-scripture', { reference: firstRef, resource });
  
  const fallbackInfo = firstResult.fallbackInfo;
  const actualLanguage = fallbackInfo.actualLanguage;
  const actualOrganization = fallbackInfo.actualOrganization;

  // If fallback was used, log it
  if (fallbackInfo.usedFallback) {
    console.log(`[translationHelpsApi] Book ${bookName} using fallback: ${actualLanguage}/${actualOrganization}`);
  }

  // Fetch all remaining chapters with the determined language/org
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
          // Use the actual language/org determined from first chapter
          const data = await callProxy('fetch-scripture', { 
            reference, 
            resource,
            language: actualLanguage, 
            organization: actualOrganization 
          });
          const content = data.content || data.text || '';
          const { verses } = parseScriptureMarkdown(content, reference, resource);
          return { chapter: chapterNum, verses };
        } catch (err) {
          console.error(`[fetchBookWithFallback] Failed to fetch ${bookName} ${chapterNum}:`, err);
          return { chapter: chapterNum, verses: [] };
        }
      })
    );
    
    chapters.push(...batchResults);
  }

  chapters.sort((a, b) => a.chapter - b.chapter);

  // Get metadata from first chapter
  let translation = 'unfoldingWord Literal Text';
  let metadata: ScriptureResponse['metadata'] | undefined;

  if (chapters.length > 0 && chapters[0].verses.length > 0) {
    const content = firstResult.data.content || '';
    const parsed = parseScriptureMarkdown(content, firstRef, resource);
    translation = parsed.translation;
    metadata = parsed.metadata;
  }

  console.log(`[translationHelpsApi] Fetched ${bookName} with fallback: ${chapters.length} chapters`);

  return {
    book: bookName,
    chapters,
    translation,
    metadata,
    fallbackInfo,
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
    // Call proxy directly with ONLY the term param - no language/organization
    // The fetch-translation-word endpoint uses "term" not "article"
    const { data, error } = await supabase.functions.invoke('translation-helps-proxy', {
      body: { 
        endpoint: 'fetch-translation-word', 
        params: { term: articleId }  // Use "term" param, not "article"!
      },
    });
    
    console.log('[fetchTranslationWord] Result for', articleId, ':', data?.content ? `${data.content.length} chars` : 'no content');
    
    if (error || !data?.content || data?.error) {
      console.log('[fetchTranslationWord] No content found for', articleId, error || data?.error);
      return null;
    }
    
    const content = data.content;
    
    // Extract term from title
    const titleMatch = content.match(/^#\s+([^\n]+)/m);
    const term = titleMatch?.[1]?.trim() || articleId;
    
    // Extract definition section
    const defMatch = content.match(/## Definition:\s*\n\n?([\s\S]*?)(?=\n##|$)/);
    const definition = defMatch?.[1]?.trim() || '';
    
    return {
      id: articleId,
      term,
      definition,
      content, // Full markdown content including Bible References
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

export interface ScriptureSearchResult {
  query: string;
  filter: string;
  reference: string;
  totalMatches: number;
  breakdown: {
    byTestament: Record<string, number>;
    byBook: Record<string, number>;
  };
  matches: { book: string; chapter: number; verse: number; text: string }[];
}

// DEPRECATED: Client-side search parsing removed in favor of AI-first architecture
// All search results now come from the orchestrator's search_matches metadata
// The AI orchestrator uses get_scripture_passage with filter param for locate queries
// and returns structured matches directly - no client-side parsing needed
export async function searchScripture(reference: string, filter: string): Promise<ScriptureSearchResult> {
  console.warn('[searchScripture] DEPRECATED: Search should come from orchestrator metadata, not client-side parsing');
  // Return empty results - orchestrator provides search_matches via setSearchResultsFromMetadata
  return {
    query: `${filter} in ${reference}`,
    filter,
    reference,
    totalMatches: 0,
    breakdown: { byTestament: {}, byBook: {} },
    matches: [],
  };
}
