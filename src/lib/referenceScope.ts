/**
 * Utilities for parsing and matching scripture references for hierarchical note scoping
 */

export interface ParsedReference {
  book: string;
  chapter?: number;
  verse?: number;
  endVerse?: number;
}

// Common book name patterns for parsing
const BOOK_PATTERN = /^(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*/i;
const CHAPTER_VERSE_PATTERN = /(\d+)(?::(\d+)(?:-(\d+))?)?/;

/**
 * Parse a scripture reference into its components
 * Examples:
 *   "John 3:16" → { book: "John", chapter: 3, verse: 16 }
 *   "1 Corinthians 13" → { book: "1 Corinthians", chapter: 13 }
 *   "Romans" → { book: "Romans" }
 *   "Genesis 1:1-5" → { book: "Genesis", chapter: 1, verse: 1, endVerse: 5 }
 */
export function parseReference(ref: string): ParsedReference | null {
  if (!ref || typeof ref !== 'string') return null;
  
  const trimmed = ref.trim();
  if (!trimmed) return null;
  
  // Extract book name
  const bookMatch = trimmed.match(BOOK_PATTERN);
  if (!bookMatch) return null;
  
  const book = bookMatch[1].trim();
  const remainder = trimmed.slice(bookMatch[0].length).trim();
  
  // If nothing after book name, it's a book-level reference
  if (!remainder) {
    return { book };
  }
  
  // Extract chapter and verse
  const cvMatch = remainder.match(CHAPTER_VERSE_PATTERN);
  if (!cvMatch) {
    return { book };
  }
  
  const chapter = parseInt(cvMatch[1], 10);
  const verse = cvMatch[2] ? parseInt(cvMatch[2], 10) : undefined;
  const endVerse = cvMatch[3] ? parseInt(cvMatch[3], 10) : undefined;
  
  return { book, chapter, verse, endVerse };
}

/**
 * Get the scope level of a reference
 */
export function getScopeLevel(ref: string): 'all' | 'book' | 'chapter' | 'verse' {
  const parsed = parseReference(ref);
  if (!parsed) return 'all';
  if (parsed.verse !== undefined) return 'verse';
  if (parsed.chapter !== undefined) return 'chapter';
  return 'book';
}

/**
 * Normalize book name for comparison (handles variations like "1 John" vs "1John")
 */
function normalizeBookName(book: string): string {
  return book
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/^(\d)/, '$1 ') // Add space after leading number
    .trim();
}

/**
 * Check if a note reference falls within a scope reference
 * 
 * Examples:
 *   isNoteInScope("John 3:16", "John") → true (verse in book)
 *   isNoteInScope("John 3:16", "John 3") → true (verse in chapter)
 *   isNoteInScope("John 3:16", "John 3:16") → true (exact match)
 *   isNoteInScope("John 4:1", "John 3") → false (different chapter)
 *   isNoteInScope("Romans 3:16", "John") → false (different book)
 *   isNoteInScope(undefined, "John") → false (no note reference)
 */
export function isNoteInScope(noteRef: string | undefined, scopeRef: string): boolean {
  // Notes without references are included in 'all' scope only
  if (!noteRef) return false;
  
  const noteP = parseReference(noteRef);
  const scopeP = parseReference(scopeRef);
  
  if (!noteP || !scopeP) return false;
  
  // Book names must match
  if (normalizeBookName(noteP.book) !== normalizeBookName(scopeP.book)) {
    return false;
  }
  
  // If scope is book-level, any note in that book matches
  if (scopeP.chapter === undefined) {
    return true;
  }
  
  // Chapter must match
  if (noteP.chapter !== scopeP.chapter) {
    return false;
  }
  
  // If scope is chapter-level, any note in that chapter matches
  if (scopeP.verse === undefined) {
    return true;
  }
  
  // Verse level - check if note verse is within scope verse range
  if (noteP.verse === undefined) {
    // Note has no verse but scope requires one - chapter-level notes don't match verse scope
    return false;
  }
  
  // Check if verse is within range
  const scopeStart = scopeP.verse;
  const scopeEnd = scopeP.endVerse || scopeP.verse;
  const noteStart = noteP.verse;
  const noteEnd = noteP.endVerse || noteP.verse;
  
  // Note overlaps with scope if ranges intersect
  return noteStart <= scopeEnd && noteEnd >= scopeStart;
}

/**
 * Filter notes array by scope reference
 * Returns all notes if scopeRef is undefined/empty
 */
export function filterNotesByScope<T extends { sourceReference?: string }>(
  notes: T[],
  scopeRef?: string
): T[] {
  if (!scopeRef) return notes;
  
  return notes.filter(note => isNoteInScope(note.sourceReference, scopeRef));
}

/**
 * Format scope for display
 * Examples:
 *   "John 3:16" → "John 3:16"
 *   "John 3" → "John 3"
 *   "John" → "John"
 */
export function formatScopeLabel(ref: string): string {
  const parsed = parseReference(ref);
  if (!parsed) return ref;
  
  let label = parsed.book;
  if (parsed.chapter !== undefined) {
    label += ` ${parsed.chapter}`;
    if (parsed.verse !== undefined) {
      label += `:${parsed.verse}`;
      if (parsed.endVerse !== undefined) {
        label += `-${parsed.endVerse}`;
      }
    }
  }
  return label;
}
