# Unfolding the Word - Project Documentation

Welcome to the project governance documentation (ODD).

## Quick Links

- [Architecture Principles](./architecture/PRINCIPLES.md) - The 6 core pillars
- [UI/UX Conventions](./design/UI_CONVENTIONS.md) - Design system and patterns
- [Component Patterns](./patterns/COMPONENTS.md) - How to build features

## Project Overview

A Bible translation study app that provides scripture, translation notes, questions, word studies, and academy articles through an AI-orchestrated multi-agent system.

## Key Architectural Decisions

1. **Multi-agent LLM orchestration** - Backend agents handle scripture, search, resources, and notes
2. **Prompt over Code** - User interactions trigger natural language prompts, not hardcoded logic
3. **Swipe-based card navigation** - Primary/secondary pane UI with horizontal swipe
4. **Progressive rendering** - Virtualized lists for performance with large datasets
