# ADR-003: Voice Mode MCP-Only Grounding

**Status:** Accepted
**Date:** 2026-02-03
**Context:** [Memory: ai-resource-grounding-exclusive](../../), [Principle 6: Prompt over Code](../architecture/PRINCIPLES.md)

## Problem

Voice conversation mode was speaking scripture text that differed from what was displayed on screen. Investigation revealed the OpenAI Realtime API was using its training data to quote scripture instead of fetching from the MCP server.

Example: User asks "read Ruth 2" → AI says "Now Naomi had a relative..." from training data, while the screen shows different ULT text from MCP.

This violated the core principle that all AI responses must be generated exclusively from MCP resources.

## Decision

Voice mode enforces MCP-only grounding through two mechanisms:

### 1. Forced Tool Usage
```typescript
tool_choice: "required"  // Not "auto"
```

With `tool_choice: "auto"`, the AI can decide to respond conversationally without calling tools. Setting it to `"required"` forces every response to go through the `bible_study_assistant` tool, which fetches from MCP.

### 2. Zero-Knowledge System Prompt

The voice AI is instructed that it has **no Bible knowledge of its own**:

```
You are a voice interface for a Bible study system. You have NO Bible knowledge of your own. 
ALL content comes from the bible_study_assistant tool.

ABSOLUTE RULES - NO EXCEPTIONS:
1. You know NOTHING about the Bible from your training
2. EVERY piece of scripture, definition, or resource MUST come from the tool
3. If the tool returns content, speak EXACTLY what it returns - never paraphrase
4. If the tool fails or returns empty, say "I couldn't find that" - never fill in from memory
```

## Rationale

**Why `tool_choice: "required"`?**
- `"auto"` allows the model to skip tools when it thinks it knows the answer
- The model's training data contains Bible text that may differ from MCP translations
- Required tool use ensures every response flows through our controlled pipeline

**Why zero-knowledge framing?**
- Telling the AI "don't use training data" is weaker than "you have no knowledge"
- Framing as a "voice interface only" establishes clear role boundaries
- Explicit rules for empty results prevent fallback to training data

## Consequences

**Positive:**
- Scripture text spoken matches scripture text displayed (both from MCP)
- Consistent experience between text and voice modes
- No theological drift from model's training corpus

**Negative:**
- Slightly higher latency (must wait for tool response)
- Greeting is the only "free" speech (no tool call)
- If MCP is down, voice mode cannot help at all (no graceful degradation)

**Neutral:**
- Tool response includes `voice_response` field optimized for speech
- Navigation hints still work for UI synchronization

## Verification

Tested by asking "read Ruth 2:1" - AI now calls tool and speaks MCP content, not training data.

## References

- [useVoiceConversation hook](../../src/hooks/useVoiceConversation.ts) - lines 215-250, 291
- [ADR-002: Unified Text/Voice Orchestration](./002-unified-text-voice-orchestration.md)
- [multi-agent-chat orchestrator](../../supabase/functions/multi-agent-chat/index.ts)
