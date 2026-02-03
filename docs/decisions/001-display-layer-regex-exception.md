# ADR-001: Display Layer Regex Exception

**Status:** Accepted  
**Date:** 2026-02-03  
**Context:** [Principle 6: Prompt over Code](../architecture/PRINCIPLES.md#6-prompt-over-code)

## Problem

The "Prompt over Code" principle states: "Always choose prompts over hardcoded logic. When routing, classification, or parameter extraction is needed, use AI tool calling."

However, we need to make scripture references clickable in rendered markdown content (e.g., "See also Romans 8:28" should be a link). Should this use AI or regex?

## Decision

**Use regex for display-layer scripture reference detection.**

The `scriptureReferenceParser.ts` uses a regex pattern to find scripture references in already-rendered content and wrap them in clickable elements.

```
User Input → LLM (routing/normalization) → Response Content → Regex (display enhancement) → UI
```

This is acceptable because:
1. It operates on **output content**, not user input
2. It does not affect **routing** or **intent classification**
3. The LLM has already processed and normalized references before this layer

## Rationale

### Why Not AI?

| Concern | AI Approach | Regex Approach |
|---------|-------------|----------------|
| **Latency** | ~500ms per paragraph | <1ms |
| **Cost** | API call per render | Zero |
| **Frequency** | Every markdown render | Every markdown render |
| **Determinism** | Variable | Consistent |

Scripture reference patterns are:
- **Finite**: ~66 book names + abbreviations
- **Well-defined**: Book + Chapter + optional Verse
- **Language-agnostic at display time**: Content is already in English after LLM processing

### Where AI IS Used

| Layer | Method | Why |
|-------|--------|-----|
| User input routing | LLM tool calling | Intent is ambiguous, multilingual |
| Reference normalization | LLM tool descriptions | Handles abbreviations, languages |
| Search classification | LLM | "locate" vs "understand" vs "read" |

## Consequences

**Positive:**
- Instant clickable references with no latency
- Works offline (no API dependency)
- Predictable behavior

**Negative:**
- Must maintain book name list if new abbreviations emerge
- Won't catch creative misspellings (but LLM handles those at input)

**Neutral:**
- Regex complexity is contained in one file (`scriptureReferenceParser.ts`)

## References

- [scriptureReferenceParser.ts](../../src/lib/scriptureReferenceParser.ts)
- [markdownTransformers.ts](../../src/lib/markdownTransformers.ts)
- [multi-agent-chat tool definitions](../../supabase/functions/multi-agent-chat/index.ts) (lines 36-143)
