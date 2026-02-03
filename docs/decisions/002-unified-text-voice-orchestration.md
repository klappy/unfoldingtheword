# ADR-002: Unified Text/Voice Orchestration

**Status:** Accepted
**Date:** 2026-02-03
**Context:** [Principle 3: DRY](../architecture/PRINCIPLES.md), [Principle 5: Maintainable](../architecture/PRINCIPLES.md)

## Problem

Voice conversation mode could easily drift from text chat, creating:
- Duplicate prompt maintenance across two systems
- Feature parity gaps (new capabilities added to one but not the other)
- Inconsistent personality and response quality
- Separate routing logic that diverges over time

## Decision

Voice mode acts as a **thin shim** around the existing `multi-agent-chat` orchestrator rather than implementing parallel logic.

**Architecture:**
```
Text Chat:  User → multi-agent-chat → sub-agents → response
Voice:      User → OpenAI Realtime → bible_study_assistant tool → multi-agent-chat → sub-agents → response
```

The `bible_study_assistant` tool is the only voice-specific wrapper. It:
1. Passes the user's spoken query to `multi-agent-chat`
2. Receives the same structured response (content, navigation_hint, tool_calls)
3. Extracts `voice_response` field for speech synthesis

## Rationale

**Why not separate voice logic?**
- Prompt maintenance: One system prompt to update, not two
- Feature parity: New sub-agents automatically available to voice
- Personality consistency: Same AI behavior regardless of input modality
- Testing: Validate orchestration once, trust it works for both modes

**What IS voice-specific (acceptable shim):**
- `voice_response` field: Plain text optimized for speech (no markdown)
- WebRTC/Realtime API connection handling
- Audio encoding/decoding
- Turn detection and VAD settings

## Consequences

**Positive:**
- Zero routing logic duplication
- Automatic feature parity for new capabilities
- Single source of truth for AI personality and behavior

**Negative:**
- Voice responses depend on orchestrator availability
- Slightly higher latency (extra hop through orchestrator)

**Neutral:**
- Tool definitions must be synchronized between `useVoiceConversation.ts` and edge function schemas

## Verification

Audit performed 2026-02-03 confirmed:
- ✅ Voice uses single `bible_study_assistant` tool wrapper
- ✅ All intent routing handled by `multi-agent-chat`
- ✅ No duplicate sub-agent calls in voice path
- ✅ Same `navigation_hint` metadata for UI sync

## References

- [multi-agent-chat orchestrator](../../supabase/functions/multi-agent-chat/index.ts)
- [useVoiceConversation hook](../../src/hooks/useVoiceConversation.ts)
- [realtime-voice-token function](../../supabase/functions/realtime-voice-token/index.ts)
