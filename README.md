# Conversational Bible Translation Assistant

A mobile-first Bible study and translation review application featuring AI-powered voice conversations, multi-agent chat orchestration, and seamless access to translation resources from the unfoldingWord ecosystem.

## ✨ Features

### 🎙️ Voice Conversation Mode
- **Natural spoken conversations** using OpenAI Realtime API with WebRTC
- **Translation review workflow**: Speak in English while reviewing resources in your target language
- **Automatic scripture sync**: Mentioned passages auto-load in the UI
- **Adjustable playback speed**: 0.5x to 2x speech rate

### 💬 Multi-Agent Chat
- **Streaming responses** via Server-Sent Events (SSE)
- **MCP-grounded responses**: All answers sourced exclusively from translation resources, never AI training data
- **Multilingual support**: Chat responses generated in user's selected language
- **Pastoral intent detection**: Compassionate responses for emotional/spiritual needs

### 📖 Scripture & Resources
- **Full book rendering** with chapter-level lazy loading
- **Verse-level resource filtering**: Click any verse to see related notes, questions, and word studies
- **Resource types**: Translation Notes (TN), Translation Questions (TQ), Translation Words (TW), Translation Academy (TA)
- **Automatic fallback**: Falls back to English when resources unavailable in selected language

### 🔄 Swipe Navigation
- **Card-based UI**: History → Chat → Scripture → Resources → Notes
- **Real-time drag interaction**: Pages follow your finger with peek-ahead visibility
- **Gesture-first design**: Minimal UI elements, intuitive swiping

### 🌍 Internationalization
- **Gateway language support**: English, Spanish (es-419), Portuguese, French, Hindi, Indonesian, Arabic
- **Hybrid localization**: Static translations + on-demand AI translation
- **Text-to-Speech**: Native pronunciation for all supported languages

## 🏗️ Architecture

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Edge Functions  │────▶│   MCP Server    │
│  (Vite + TS)    │     │   (Supabase)     │     │ (Door43/uW)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌──────────────────┐
        │               │   Lovable AI     │
        │               │  (LLM Gateway)   │
        │               └──────────────────┘
        │
        ▼
┌─────────────────┐
│    Supabase     │
│  (Persistence)  │
└─────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **MCP-exclusive data** | All scripture and resources fetched from MCP server only—never bypassed |
| **Device-based identity** | No authentication required; data isolated by device ID |
| **Book-level scripture loading** | Full books loaded in background for smooth navigation |
| **Streaming responses** | SSE for real-time chat, WebRTC for voice |
| **Hybrid localization** | Static JSON for major languages, AI translation for others |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `multi-agent-chat` | Orchestrates AI chat with MCP tool calling |
| `realtime-voice-token` | Generates ephemeral tokens for OpenAI Realtime API |
| `translation-helps-proxy` | Proxies MCP server requests with error handling |
| `text-to-speech` | OpenAI TTS with language-specific voice instructions |
| `translate-content` | AI translation for fallback content |
| `translate-ui` | On-demand UI string translation |
| `transcribe-audio` | Whisper-based audio transcription |

### Database Schema

```sql
-- Conversations (chat sessions)
conversations (id, device_id, language, title, preview, scripture_reference, created_at, updated_at)

-- Messages (chat history with resources)
messages (id, conversation_id, role, content, agent, resources, created_at)

-- Notes (user annotations and feedback)
notes (id, device_id, content, source_reference, note_type, resource_type, resource_id, highlighted, created_at, updated_at)
```

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Animation**: Framer Motion
- **State**: React Query, React Context
- **Backend**: Supabase (Lovable Cloud)
- **AI**: OpenAI (GPT-4o-mini, Realtime API, TTS, Whisper)
- **Data Source**: [Translation Helps MCP Server](https://translation-helps-mcp.pages.dev)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd <project-directory>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

The following environment variables are required (automatically configured in Lovable):

```env
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```

Edge functions require additional secrets:
- `OPENAI_API_KEY` - For chat, voice, TTS, and transcription
- `LOVABLE_API_KEY` - For Lovable AI gateway access

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── ChatCard.tsx     # Multi-agent chat interface
│   ├── ScriptureCard.tsx # Scripture display with verse selection
│   ├── ResourcesCard.tsx # Translation resources browser
│   ├── NotesCard.tsx    # User notes and feedback
│   ├── HistoryCard.tsx  # Conversation history
│   ├── SwipeContainer.tsx # Card navigation container
│   └── VoiceConversation.tsx # Voice mode UI
├── hooks/
│   ├── useMultiAgentChat.ts # Chat orchestration
│   ├── useVoiceConversation.ts # OpenAI Realtime integration
│   ├── useScriptureData.ts # Scripture & resource loading
│   ├── useConversations.ts # Persistence management
│   └── useSwipeNavigation.ts # Gesture handling
├── contexts/
│   └── TTSContext.tsx   # Text-to-speech provider
├── services/
│   └── translationHelpsApi.ts # MCP API client
├── i18n/
│   └── translations.ts  # Static translations
└── pages/
    └── Index.tsx        # Main application page

supabase/
└── functions/
    ├── multi-agent-chat/
    ├── realtime-voice-token/
    ├── translation-helps-proxy/
    ├── text-to-speech/
    ├── translate-content/
    ├── translate-ui/
    └── transcribe-audio/
```

## 🎨 Design Philosophy

- **Post-modern futuristic minimal**: Clean UI with nearly invisible elements
- **Gesture-first**: Swiping as primary interaction model
- **Resource-centric**: Chat guides users to authoritative resources, not AI interpretations
- **Translation review friendly**: Dual-language workflows for checking translations

## 🔗 Related Projects

- [Translation Helps MCP Server](https://github.com/klappy/translation-helps-mcp) - Data source for all translation resources
- [Conversational Bible Translation PoC](https://github.com/klappy/conversational-bible-translation-poc) - Original navigation inspiration

## 📄 License

This project uses translation resources from [unfoldingWord](https://www.unfoldingword.org/) under Creative Commons licenses.

---

Built with [Lovable](https://lovable.dev)
