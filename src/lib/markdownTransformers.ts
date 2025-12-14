import React from 'react';

// Common Bible book names for detection (English + some Spanish/Portuguese)
const BIBLE_BOOKS = [
  'genesis', 'gen', 'exodus', 'ex', 'leviticus', 'lev', 'numbers', 'num',
  'deuteronomy', 'deut', 'joshua', 'josh', 'judges', 'judg', 'ruth',
  '1 samuel', '2 samuel', '1 kings', '2 kings', '1 chronicles', '2 chronicles',
  'ezra', 'nehemiah', 'neh', 'esther', 'job', 'psalms', 'psalm', 'ps',
  'proverbs', 'prov', 'ecclesiastes', 'eccl', 'song of solomon', 'songs',
  'isaiah', 'isa', 'jeremiah', 'jer', 'lamentations', 'lam', 'ezekiel', 'ezek',
  'daniel', 'dan', 'hosea', 'joel', 'amos', 'obadiah', 'obad', 'jonah',
  'micah', 'mic', 'nahum', 'habakkuk', 'hab', 'zephaniah', 'zeph',
  'haggai', 'hag', 'zechariah', 'zech', 'malachi', 'mal',
  'matthew', 'matt', 'mark', 'luke', 'john', 'acts',
  'romans', 'rom', '1 corinthians', '2 corinthians', 'galatians', 'gal',
  'ephesians', 'eph', 'philippians', 'phil', 'colossians', 'col',
  '1 thessalonians', '2 thessalonians', '1 timothy', '2 timothy',
  'titus', 'philemon', 'phlm', 'hebrews', 'heb', 'james', 'jas',
  '1 peter', '2 peter', '1 john', '2 john', '3 john', 'jude', 'revelation', 'rev',
  // Spanish
  'génesis', 'éxodo', 'levítico', 'números', 'deuteronomio', 'josué', 'jueces', 'rut',
  'salmos', 'proverbios', 'eclesiastés', 'cantares', 'isaías', 'jeremías', 'ezequiel',
  'mateo', 'marcos', 'lucas', 'juan', 'hechos', 'romanos', 'apocalipsis',
  // Portuguese
  'gênesis', 'êxodo', 'provérbios', 'mateus', 'joão', 'atos',
];

// Build a regex pattern from the book list
const bookPattern = BIBLE_BOOKS.map(b => b.replace(/\s+/g, '\\s+')).join('|');
const SCRIPTURE_REF_PATTERN = new RegExp(
  `\\b((?:${bookPattern}))\\s*(\\d+)(?:\\s*:\\s*(\\d+)(?:\\s*[-–]\\s*(\\d+))?)?\\b`,
  'gi'
);

/**
 * Transform plain text scripture references into clickable elements
 * Used by react-markdown custom components
 */
export function createScriptureLinkTransformer(onReferenceClick: (reference: string) => void) {
  return function transformScriptureLinks(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    SCRIPTURE_REF_PATTERN.lastIndex = 0;
    
    while ((match = SCRIPTURE_REF_PATTERN.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Build reference string
      const book = match[1];
      const chapter = match[2];
      const verseStart = match[3];
      const verseEnd = match[4];

      let reference = `${book} ${chapter}`;
      if (verseStart) {
        reference += `:${verseStart}`;
        if (verseEnd) {
          reference += `-${verseEnd}`;
        }
      }

      // Create clickable element
      parts.push(
        React.createElement('button', {
          key: `ref-${match.index}`,
          className: 'text-primary hover:underline font-medium',
          onClick: () => onReferenceClick(reference),
        }, match[0])
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };
}

/**
 * Highlight search terms in text
 * Returns React nodes with <mark> tags around matched terms
 */
export function highlightSearchTerms(text: string, searchTerm: string): React.ReactNode[] {
  if (!searchTerm || !text) {
    return [text];
  }

  const parts: React.ReactNode[] = [];
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  const splits = text.split(regex);
  
  splits.forEach((part, index) => {
    if (regex.test(part)) {
      parts.push(
        React.createElement('mark', {
          key: `highlight-${index}`,
          className: 'bg-primary/30 text-foreground rounded px-0.5',
        }, part)
      );
    } else if (part) {
      parts.push(part);
    }
  });

  return parts;
}

/**
 * Combined transformer: highlights search terms AND makes scripture refs clickable
 */
export function createCombinedTransformer(
  searchTerm: string | null,
  onReferenceClick: (reference: string) => void
) {
  const scriptureTransformer = createScriptureLinkTransformer(onReferenceClick);

  return function transform(text: string): React.ReactNode[] {
    // First, highlight search terms
    const highlighted = searchTerm ? highlightSearchTerms(text, searchTerm) : [text];
    
    // Then, transform scripture references in each text part
    const result: React.ReactNode[] = [];
    
    for (const part of highlighted) {
      if (typeof part === 'string') {
        result.push(...scriptureTransformer(part));
      } else {
        // Already a React element (highlighted term), keep as-is
        result.push(part);
      }
    }

    return result;
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Custom react-markdown components that apply transformations
 */
export function createMarkdownComponents(
  searchTerm: string | null,
  onReferenceClick: (reference: string) => void
) {
  const transform = createCombinedTransformer(searchTerm, onReferenceClick);

  return {
    // Transform text in paragraphs
    p: ({ children, ...props }: any) => {
      const transformedChildren = React.Children.map(children, child => {
        if (typeof child === 'string') {
          return React.createElement(React.Fragment, {}, ...transform(child));
        }
        return child;
      });
      return React.createElement('p', { ...props, className: 'mb-3' }, transformedChildren);
    },

    // Transform text in list items
    li: ({ children, ...props }: any) => {
      const transformedChildren = React.Children.map(children, child => {
        if (typeof child === 'string') {
          return React.createElement(React.Fragment, {}, ...transform(child));
        }
        return child;
      });
      return React.createElement('li', { ...props, className: 'mb-1' }, transformedChildren);
    },

    // Style headings
    h1: ({ children, ...props }: any) => 
      React.createElement('h1', { ...props, className: 'text-xl font-bold mb-3 text-foreground' }, children),
    h2: ({ children, ...props }: any) => 
      React.createElement('h2', { ...props, className: 'text-lg font-semibold mb-2 text-foreground' }, children),
    h3: ({ children, ...props }: any) => 
      React.createElement('h3', { ...props, className: 'text-base font-medium mb-2 text-foreground' }, children),

    // Style blockquotes (often used for scripture)
    blockquote: ({ children, ...props }: any) => 
      React.createElement('blockquote', { 
        ...props, 
        className: 'border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-3' 
      }, children),

    // Style bold text (often scripture references)
    strong: ({ children, ...props }: any) => {
      const text = typeof children === 'string' ? children : '';
      // Check if this looks like a scripture reference
      if (SCRIPTURE_REF_PATTERN.test(text)) {
        SCRIPTURE_REF_PATTERN.lastIndex = 0;
        return React.createElement('button', {
          ...props,
          className: 'font-bold text-primary hover:underline',
          onClick: () => onReferenceClick(text),
        }, children);
      }
      return React.createElement('strong', { ...props, className: 'font-bold' }, children);
    },

    // Style horizontal rules
    hr: (props: any) => 
      React.createElement('hr', { ...props, className: 'my-4 border-border' }),

    // Style code blocks
    code: ({ children, ...props }: any) => 
      React.createElement('code', { 
        ...props, 
        className: 'bg-muted px-1 py-0.5 rounded text-sm' 
      }, children),
  };
}
