// LLM-driven interaction types - "Prompt over code" principle
// Instead of hardcoded client-side logic, interactions become prompts to the LLM

export type SearchInteractionType = 
  | 'read_scripture'      // User wants to read a specific passage
  | 'expand_article'      // User wants to learn more about a word/academy article  
  | 'follow_reference'    // User clicked a cross-reference
  | 'search_related';     // User wants to find more about a topic

export interface SearchInteraction {
  type: SearchInteractionType;
  // Context for building the prompt
  reference?: string;     // Scripture reference
  term?: string;          // Word/topic term
  articleType?: 'words' | 'academy';
  resource?: string;      // Scripture translation (ult, ust)
  context?: string;       // Additional context for the LLM
}

// Build a natural language prompt from an interaction
export function buildInteractionPrompt(interaction: SearchInteraction): string {
  switch (interaction.type) {
    case 'read_scripture':
      const resourceNote = interaction.resource ? ` (${interaction.resource.toUpperCase()})` : '';
      return `Read ${interaction.reference}${resourceNote}`;
      
    case 'expand_article':
      if (interaction.articleType === 'words') {
        return `Tell me more about the word "${interaction.term}"`;
      }
      return `Tell me more about "${interaction.term}"`;
      
    case 'follow_reference':
      return `Show me ${interaction.reference}`;
      
    case 'search_related':
      return `Find more about "${interaction.term}"`;
      
    default:
      return interaction.term || interaction.reference || '';
  }
}
