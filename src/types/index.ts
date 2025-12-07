export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  timestamp: Date;
  resources?: ResourceLink[];
}

export type AgentType = 'scripture' | 'notes' | 'questions' | 'academy' | 'words' | 'main';

export interface ResourceLink {
  type: 'scripture' | 'note' | 'question' | 'academy' | 'word';
  reference: string;
  title: string;
  preview?: string;
}

export interface ScripturePassage {
  reference: string;
  text: string;
  verses: { number: number; text: string }[];
  translation: string;
}

export interface Note {
  id: string;
  content: string;
  sourceReference?: string;
  createdAt: Date;
  highlighted?: boolean;
}

export interface Resource {
  id: string;
  type: 'translation-note' | 'translation-question' | 'translation-word' | 'academy-article';
  title: string;
  content: string;
  reference?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  scripture?: string;
}

export type CardType = 'chat' | 'scripture' | 'resources' | 'notes';

export interface SwipeState {
  direction: 'up' | 'down' | 'left' | 'right' | null;
  velocity: number;
}
