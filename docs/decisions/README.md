# Architecture Decision Records (ADRs)

This folder contains Architecture Decision Records documenting significant technical decisions.

## Format

Each ADR follows this template:

```markdown
# ADR-XXX: [Short Title]

**Status:** Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Context:** [Link to principle or constraint this relates to]

## Problem

What problem are we solving? What triggered this decision?

## Decision

What did we decide? Be specific.

## Rationale

Why this approach over alternatives?

## Consequences

- **Positive:** What benefits does this bring?
- **Negative:** What tradeoffs are we accepting?
- **Neutral:** What other effects should we note?

## References

- Related ADRs, docs, or external resources
```

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-display-layer-regex-exception.md) | Display Layer Regex Exception | Accepted | 2026-02-03 |
| [002](./002-unified-text-voice-orchestration.md) | Unified Text/Voice Orchestration | Accepted | 2026-02-03 |
| [003](./003-voice-mcp-only-grounding.md) | Voice Mode MCP-Only Grounding | Accepted | 2026-02-03 |

## When to Write an ADR

Write an ADR when:
- A decision contradicts or creates an exception to documented principles
- You're choosing between multiple valid approaches with significant tradeoffs
- Future developers might question "why did we do it this way?"
- A constraint or requirement drives a non-obvious technical choice

## Governance

- ADRs are proposed via code review
- Accepted ADRs become part of the project canon
- To supersede an ADR, create a new one linking to the old
