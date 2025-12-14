import React from 'react';
import { segmentTextWithReferences, ScriptureReference } from '@/lib/scriptureReferenceParser';

/**
 * Transform text with scripture references into clickable elements
 * Uses the robust parser from scriptureReferenceParser
 */
function transformTextWithReferences(
  text: string, 
  onReferenceClick: (reference: string) => void,
  searchTerm: string | null
): React.ReactNode[] {
  const segments = segmentTextWithReferences(text);
  
  return segments.map((segment, index) => {
    if (segment.type === 'reference' && segment.reference) {
      const ref = segment.reference;
      let refString = `${ref.book} ${ref.chapter}`;
      if (ref.verse) {
        refString += `:${ref.verse}`;
        if (ref.endVerse) {
          refString += `-${ref.endVerse}`;
        }
      }
      
      return React.createElement('button', {
        key: `ref-${index}`,
        className: 'text-primary hover:underline font-medium',
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onReferenceClick(refString);
        },
      }, segment.content);
    }
    
    // Apply search term highlighting to plain text
    if (searchTerm && segment.content) {
      return highlightSearchTerms(segment.content, searchTerm, index);
    }
    
    return segment.content;
  });
}

/**
 * Highlight search terms in text
 */
function highlightSearchTerms(text: string, searchTerm: string, keyPrefix: number = 0): React.ReactNode {
  if (!searchTerm || !text) return text;
  
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  const parts = text.split(regex);
  
  if (parts.length === 1) return text;
  
  return React.createElement(React.Fragment, { key: `hl-${keyPrefix}` },
    ...parts.map((part, i) => 
      regex.test(part) 
        ? React.createElement('mark', {
            key: `mark-${keyPrefix}-${i}`,
            className: 'bg-primary/30 text-foreground rounded px-0.5',
          }, part)
        : part
    )
  );
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Combined transformer: highlights search terms AND makes scripture refs clickable
 */
export function createCombinedTransformer(
  searchTerm: string | null,
  onReferenceClick: (reference: string) => void
) {
  return function transform(text: string): React.ReactNode[] {
    return transformTextWithReferences(text, onReferenceClick, searchTerm);
  };
}

/**
 * Helper to transform children - handles both string and React element children
 */
function transformChildren(
  children: React.ReactNode,
  transform: (text: string) => React.ReactNode[]
): React.ReactNode {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      return React.createElement(React.Fragment, {}, ...transform(child));
    }
    return child;
  });
}

/**
 * Custom react-markdown components that apply transformations to ALL text content
 */
export function createMarkdownComponents(
  searchTerm: string | null,
  onReferenceClick: (reference: string) => void
) {
  const transform = createCombinedTransformer(searchTerm, onReferenceClick);

  // Generic text transformer for any element
  const withTransform = (Tag: string, className: string) => {
    return ({ children, ...props }: any) => {
      const transformedChildren = transformChildren(children, transform);
      return React.createElement(Tag, { ...props, className }, transformedChildren);
    };
  };

  return {
    // All text-containing elements get the transform
    p: withTransform('p', 'mb-3'),
    li: withTransform('li', 'mb-1'),
    h1: withTransform('h1', 'text-xl font-bold mb-3 text-foreground'),
    h2: withTransform('h2', 'text-lg font-semibold mb-2 text-foreground'),
    h3: withTransform('h3', 'text-base font-medium mb-2 text-foreground'),
    h4: withTransform('h4', 'text-sm font-medium mb-2 text-foreground'),
    td: withTransform('td', 'p-2 border border-border/30'),
    th: withTransform('th', 'p-2 border border-border/30 font-semibold'),
    
    // Blockquotes with transform
    blockquote: ({ children, ...props }: any) => {
      const transformedChildren = transformChildren(children, transform);
      return React.createElement('blockquote', { 
        ...props, 
        className: 'border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-3' 
      }, transformedChildren);
    },

    // Bold text - also transform
    strong: ({ children, ...props }: any) => {
      const transformedChildren = transformChildren(children, transform);
      return React.createElement('strong', { ...props, className: 'font-bold' }, transformedChildren);
    },

    // Emphasis - also transform
    em: ({ children, ...props }: any) => {
      const transformedChildren = transformChildren(children, transform);
      return React.createElement('em', { ...props, className: 'italic' }, transformedChildren);
    },

    // Style horizontal rules
    hr: (props: any) => 
      React.createElement('hr', { ...props, className: 'my-4 border-border' }),

    // Style code blocks (no transform - code should be literal)
    code: ({ children, ...props }: any) => 
      React.createElement('code', { 
        ...props, 
        className: 'bg-muted px-1 py-0.5 rounded text-sm' 
      }, children),
  };
}
