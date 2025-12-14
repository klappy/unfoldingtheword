import React from 'react';

// Regex to detect scripture references in text
const SCRIPTURE_REF_PATTERN = /\b((?:1|2|3|I|II|III)?\s*[A-Za-záéíóúüñâêôãõç]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\b/gi;

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
