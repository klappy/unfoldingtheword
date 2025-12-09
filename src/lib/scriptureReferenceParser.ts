// Scripture reference detection and parsing utilities

// Regex to match scripture references like "John 3:16", "1 Corinthians 13:4-7", "Genesis 1", etc.
const SCRIPTURE_REFERENCE_REGEX = /\b((?:[1-3]\s?)?(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song\s?of\s?(?:Solomon|Songs)|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|Gen|Exod?|Lev|Num|Deut?|Josh|Judg|Rth|(?:[12]?\s?Sam)|(?:[12]?\s?Kgs?)|(?:[12]?\s?Chr)|Neh|Est|Ps|Prov?|Eccl?|Song|Isa|Jer|Lam|Ezek?|Dan|Hos|Ob(?:ad)?|Jon|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt?|Mrk?|Lk|Jn|Rom|(?:[12]?\s?Cor)|Gal|Eph|Phil|Col|(?:[12]?\s?Thess?)|(?:[12]?\s?Tim)|Tit|Phlm|Heb|Jas|(?:[12]?\s?Pet)|Rev))\s+(\d{1,3})(?::(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?)?/gi;

export interface ScriptureReference {
  full: string;
  book: string;
  chapter: string;
  verse?: string;
  endVerse?: string;
  startIndex: number;
  endIndex: number;
}

export function parseScriptureReferences(text: string): ScriptureReference[] {
  const references: ScriptureReference[] = [];
  let match;

  // Reset regex lastIndex for global matching
  SCRIPTURE_REFERENCE_REGEX.lastIndex = 0;

  while ((match = SCRIPTURE_REFERENCE_REGEX.exec(text)) !== null) {
    references.push({
      full: match[0],
      book: match[1],
      chapter: match[2],
      verse: match[3] || undefined,
      endVerse: match[4] || undefined,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return references;
}

export interface TextSegment {
  type: 'text' | 'reference';
  content: string;
  reference?: ScriptureReference;
}

export function segmentTextWithReferences(text: string): TextSegment[] {
  const references = parseScriptureReferences(text);
  
  if (references.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const ref of references) {
    // Add text before this reference
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, ref.startIndex),
      });
    }

    // Add the reference
    segments.push({
      type: 'reference',
      content: ref.full,
      reference: ref,
    });

    lastIndex = ref.endIndex;
  }

  // Add remaining text after last reference
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
