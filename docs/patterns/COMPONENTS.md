# Component Patterns

## Search Result Items

All search results render through `SearchResultItem`, which handles:

1. **Type-based styling** - Icon, colors from `sectionConfig`
2. **Click behavior** - Scripture → direct nav, others → expand
3. **Actions** - Play (TTS), Copy, Add to Notes
4. **Markdown rendering** - Scripture reference parsing, search highlighting

### Adding a New Resource Type

1. Add type to `SearchResultType` union
2. Add entry to `sectionConfig` with icon, color, bgColor
3. Add entry to `typeLabels` for display name
4. Handle in `getHeaderInfo` for title extraction

## Progressive Rendering

For lists with potentially 100+ items:

```tsx
const INITIAL_VISIBLE_COUNT = 10;
const [showAll, setShowAll] = useState(false);

const visibleItems = showAll ? items : items.slice(0, INITIAL_VISIBLE_COUNT);
const hiddenCount = items.length - INITIAL_VISIBLE_COUNT;

return (
  <>
    {visibleItems.map(item => <Item key={item.id} {...item} />)}
    {!showAll && hiddenCount > 0 && (
      <button onClick={() => setShowAll(true)}>
        Show {hiddenCount} more
      </button>
    )}
  </>
);
```

## Scripture Reference Parsing

Use `createMarkdownComponents(searchQuery, onVerseClick)` to make all scripture references clickable in markdown content.

This applies to:
- Headings (h1-h6)
- Paragraphs
- Lists
- Blockquotes
- Strong/em text

## Exclusive Section Expansion

For accordion-style behavior where only one section opens at a time:

```tsx
const expandOnlySection = (section: string) => {
  setExpandedSections({
    sectionA: section === 'sectionA',
    sectionB: section === 'sectionB',
    sectionC: section === 'sectionC',
  });
};
```

## Edge Function Patterns

### Error Handling
Return 200 with error info in body so clients can handle fallbacks:

```ts
if (!response.ok) {
  return new Response(JSON.stringify({ 
    error: `API returned ${response.status}`,
    details: errorText,
    status: response.status
  }), {
    status: 200, // Client can parse and handle gracefully
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### CORS Headers
Always include:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
