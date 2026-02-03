
# SearchCard Secondary Pane UI/UX Improvements

## Summary

This plan addresses 4 specific UI/UX improvements for the SearchCard secondary pane:

1. **Result card width** - Keep current max-w-xl constraint (already good for readability)
2. **Clickable result cards** - Scripture results should navigate directly to that book/chapter/verse
3. **Clickable resource type badges** - Header stats become filter buttons that expand one category and collapse others
4. **Instant category expand/collapse** - Eliminate delays by limiting initial render count

---

## Current State Analysis

**SearchCard.tsx (468 lines):**
- 5 collapsible sections: Scripture, Notes, Questions, Words, Academy
- Color-coded icons and badges in header stats (lines 194-223)
- Header stat badges are passive `<span>` elements, not interactive
- Section toggle via `toggleSection()` at line 96-98, no animation delays
- All matches render immediately when section expands (potential performance issue with 100+ items)

**SearchResultItem.tsx (393 lines):**
- `handleClick()` at lines 209-240 handles click behavior by type
- Scripture clicks currently send `onInteraction({ type: 'read_scripture', reference })` which routes to LLM
- Falls back to `onVerseClick(reference)` only if `onInteraction` is undefined
- The `onInteraction` pattern was designed for LLM-driven responses, but direct navigation would be faster

---

## Implementation Plan

### 1. Keep Result Card Width (No Changes)

Current implementation uses `max-w-xl mx-auto` at line 143. You noted this is easy to read. No changes needed.

---

### 2. Direct Scripture Navigation on Click

**Current behavior:** Scripture clicks call `onInteraction({ type: 'read_scripture', reference })` which sends a prompt to the LLM and waits for a response.

**New behavior:** Scripture clicks should call `onVerseClick(reference)` directly for instant navigation.

**File: `src/components/SearchResultItem.tsx`**

Change lines 209-221:

```typescript
const handleClick = () => {
  if (isScriptureType) {
    // Direct navigation for instant response
    if (onVerseClick) {
      onVerseClick(reference);
    }
  } else if (type === 'words' || type === 'academy') {
    // ... rest unchanged
  }
};
```

This bypasses the LLM interaction and uses the existing `onVerseClick` prop which is wired to `handleSearchVerseClick` in Index.tsx. That function already handles:
- Fast navigation (same book): scrolls to verse
- Full load (different book): loads chapter data

---

### 3. Clickable Resource Type Badges as Filters

**Current behavior:** Header shows colored icon+count stats as passive indicators (lines 194-223 in SearchCard.tsx).

**New behavior:** Clicking a stat badge expands that category exclusively (collapses all others).

**File: `src/components/SearchCard.tsx`**

Add new function after line 98:

```typescript
const expandOnlySection = (section: string) => {
  setExpandedSections({
    scripture: section === 'scripture',
    notes: section === 'notes',
    questions: section === 'questions',
    words: section === 'words',
    academy: section === 'academy',
  });
};
```

Convert stat spans (lines 194-223) to clickable buttons:

```typescript
{totalScriptureMatches > 0 && (
  <button
    onClick={() => expandOnlySection('scripture')}
    className="flex items-center gap-1 px-2 py-1 rounded-md 
               hover:bg-amber-400/10 active:bg-amber-400/20 
               transition-colors cursor-pointer"
    aria-label={`Filter to ${totalScriptureMatches} scripture results`}
  >
    <BookMarked className="h-3 w-3 text-amber-400" />
    <span className="text-amber-400 font-medium">{totalScriptureMatches}</span>
  </button>
)}
```

Same pattern for all 5 resource types with their respective colors:
- Scripture: amber-400
- Notes: emerald-400
- Questions: violet-400
- Words: rose-400
- Academy: sky-400

**Visual improvements:**
- Larger touch targets (px-2 py-1 padding)
- Hover/active background feedback
- Rounded corners for button appearance
- Font-medium for counts
- ARIA labels for accessibility

---

### 4. Instant Category Expand/Collapse with Progressive Rendering

**Current behavior:** All matches render immediately when a section expands. With 100+ items, this causes a noticeable delay as React mounts all components.

**New behavior:** Limit initial render to 10 items, with "Show more" button to load the rest.

**File: `src/components/SearchCard.tsx`**

Add state for tracking which sections show all results (after line 77):

```typescript
const [showAllMatches, setShowAllMatches] = useState<Record<string, boolean>>({});
const INITIAL_VISIBLE_COUNT = 10;
```

Modify `renderSection` (lines 111-165) to limit matches:

```typescript
const renderSection = (
  title: string,
  key: SearchResultType,
  data: { markdown: string; matches: any[]; totalCount: number; breakdown?: any } | null
) => {
  if (!data || data.totalCount === 0) return null;

  const isExpanded = expandedSections[key];
  const config = sectionConfig[key];
  const Icon = config.icon;
  const showAll = showAllMatches[key];
  const visibleMatches = showAll 
    ? data.matches 
    : data.matches.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = data.matches.length - INITIAL_VISIBLE_COUNT;

  return (
    <div key={key} className="border border-border/50 rounded-lg overflow-hidden">
      {/* ... header unchanged ... */}

      {isExpanded && (
        <div className="p-3 space-y-2 max-w-xl mx-auto">
          {visibleMatches.map((match, idx) => (
            <SearchResultItem ... />
          ))}
          
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllMatches(prev => ({ ...prev, [key]: true }))}
              className="w-full py-2 text-sm text-primary hover:underline 
                         flex items-center justify-center gap-1"
            >
              Show {hiddenCount} more
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

**Performance benefits:**
- Initial expand renders only 10 items (instant)
- User can load more on demand
- No animation library overhead for section toggle

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/components/SearchCard.tsx` | Add `expandOnlySection()`, add `showAllMatches` state, convert stat badges to buttons, add progressive rendering |
| `src/components/SearchResultItem.tsx` | Change scripture click from `onInteraction` to direct `onVerseClick` call |

---

## User Experience Flow

```text
User views search results
    |
    v
Clicks colored "Scripture: 15" badge in header
    |
    v
Scripture section expands, all others collapse
First 10 results render instantly
    |
    v
"Show 5 more" button appears
    |
    v
User clicks a scripture result card (e.g., "Romans 8:28")
    |
    v
App navigates directly to Scripture card at Romans 8:28
(No LLM round-trip, instant navigation)
```

---

## Testing Checklist

After implementation:
1. Verify clicking header stat badges expands only that section
2. Verify scripture result clicks navigate directly (check network tab for no LLM calls)
3. Verify "Show more" button appears for sections with >10 results
4. Verify expand/collapse feels instant with 100+ results
5. Test keyboard navigation (Enter key on badges and result cards)
