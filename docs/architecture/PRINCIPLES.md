# Architecture Principles

All architectural decisions must be evaluated against these six pillars.

## 1. Consistent

**Single source of truth.** Data flows from one authoritative source. Avoid duplicating state across components.

- Scripture data comes from the translation-helps-proxy edge function
- Search state is managed by `useSearchState` hook
- Language selection is centralized in `useLanguage`

## 2. Antifragile

**Resilient to failures.** The app degrades gracefully when external services fail.

- Edge functions return 200 with error info in body for client-side fallback handling
- Missing resources show helpful empty states, not crashes
- Offline-first patterns where possible

## 3. DRY (Don't Repeat Yourself)

**Extract shared logic into reusable units.**

- `SearchResultItem` is a unified component for all result types
- `createMarkdownComponents` handles scripture reference parsing everywhere
- `sectionConfig` maps resource types to icons/colors once

## 4. KISS (Keep It Simple)

**Prefer simple solutions over clever ones.**

- Direct navigation for scripture clicks instead of LLM round-trips
- Progressive rendering (show 10, then "Show more") over complex virtualization
- Collapsible sections with simple state toggle

## 5. Maintainable

**Easy to understand and modify.**

- Co-locate related code (hooks next to components that use them)
- Clear naming conventions (use verbs for handlers: `handleClick`, `toggleSection`)
- TypeScript for self-documenting interfaces

## 6. Prompt over Code

**Prefer AI-driven decisions through prompts over hardcoded client logic.**

When user intent is ambiguous or context-dependent, send a natural language prompt to the LLM rather than hardcoding behavior.

**Examples:**
- Word article deep-dive: "Tell me more about agape" → LLM decides how to expand
- Cross-reference exploration: "Show me related passages" → LLM finds connections

**Exceptions (use direct navigation):**
- Scripture clicks in search results → Direct navigation (user intent is clear)
- Filter badge clicks → Direct expand/collapse (UI state, not content decisions)
