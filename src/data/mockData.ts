import { Message, ScripturePassage, Resource, HistoryItem, Note } from '@/types';

export const mockScripture: ScripturePassage = {
  reference: 'John 3:16-17',
  translation: 'unfoldingWord Literal Text',
  text: '',
  verses: [
    { 
      number: 16, 
      text: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.' 
    },
    { 
      number: 17, 
      text: 'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.' 
    },
  ],
};

export const mockResources: Resource[] = [
  {
    id: '1',
    type: 'translation-note',
    title: 'Meaning of "only Son"',
    reference: 'John 3:16',
    content: 'The Greek word μονογενής (monogenēs) means "one and only" or "unique." It emphasizes Jesus\' unique relationship with the Father, not merely that he was an only child.',
  },
  {
    id: '2',
    type: 'translation-question',
    title: 'Why did God send his Son?',
    reference: 'John 3:17',
    content: 'This verse clarifies God\'s purpose in sending Jesus. The contrast is between condemning and saving. What does this tell us about God\'s character and intentions?',
  },
  {
    id: '3',
    type: 'translation-word',
    title: 'κόσμος (kosmos) - World',
    reference: 'John 3:16',
    content: 'The Greek word κόσμος can refer to the physical universe, humanity, or the system opposed to God. In this context, it emphasizes the extent of God\'s love for all humanity.',
  },
  {
    id: '4',
    type: 'academy-article',
    title: 'Translating Abstract Nouns',
    content: 'When translating concepts like "eternal life" or "salvation," consider how your target language expresses abstract concepts. Some languages prefer verbal forms or descriptive phrases.',
  },
];

export const mockHistory: HistoryItem[] = [
  {
    id: '1',
    title: 'Understanding John 3:16',
    preview: 'We discussed the famous verse about God\'s love for the world...',
    timestamp: new Date(Date.now() - 86400000),
    scripture: 'John 3:16-17',
  },
  {
    id: '2',
    title: 'The Prodigal Son Parable',
    preview: 'Exploring the meaning behind the father\'s unconditional love...',
    timestamp: new Date(Date.now() - 172800000),
    scripture: 'Luke 15:11-32',
  },
  {
    id: '3',
    title: 'Fruits of the Spirit',
    preview: 'What does it mean to walk in the Spirit?',
    timestamp: new Date(Date.now() - 259200000),
    scripture: 'Galatians 5:22-23',
  },
];

export const initialMessages: Message[] = [];

export const mockNotes: Note[] = [
  {
    id: '1',
    content: 'The word "world" (kosmos) emphasizes the extent of God\'s love - not just Israel, but all humanity.',
    sourceReference: 'John 3:16',
    createdAt: new Date(Date.now() - 3600000),
    highlighted: true,
  },
];
