/**
 * Utilities for formatting MCP resource data into natural, speakable text
 * for voice conversation mode
 */

// Strip markdown formatting from text
export function stripMarkdown(text: string): string {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Remove bullet points
    .replace(/^[-*+]\s+/gm, '')
    // Remove numbered lists
    .replace(/^\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Format scripture passage for natural speech
export function formatScriptureForSpeech(text: string, reference: string): string {
  if (!text) return `I couldn't find that passage. Could you check the reference?`;
  
  const cleanText = stripMarkdown(text);
  
  // Convert verse numbers to spoken format
  // Pattern: matches verse numbers like \"1\", \"2\", etc. at start of lines or after periods
  const withSpokenVerses = cleanText
    .replace(/^(\d+)\s+/gm, 'Verse $1: ')
    .replace(/\.\s*(\d+)\s+/g, '. Verse $1: ');
  
  return `Here's ${reference}. ${withSpokenVerses}`;
}

// Format translation notes for speech
export function formatNotesForSpeech(notes: any[]): string {
  if (!notes || notes.length === 0) {
    return "I didn't find any translation notes for this passage.";
  }
  
  const formattedNotes = notes.slice(0, 3).map((note, index) => {
    const content = stripMarkdown(note.content || note.note || '');
    const title = note.title || note.reference || '';
    
    if (index === 0) {
      return `Here's a helpful translation note${title ? ` about ${title}` : ''}. ${content}`;
    } else if (index === 1) {
      return `There's also another note that says: ${content}`;
    } else {
      return `And one more point: ${content}`;
    }
  });
  
  const result = formattedNotes.join(' ');
  
  if (notes.length > 3) {
    return `${result} There are ${notes.length - 3} more notes if you'd like to hear them.`;
  }
  
  return result;
}

// Format translation questions for speech
export function formatQuestionsForSpeech(questions: any[]): string {
  if (!questions || questions.length === 0) {
    return "I didn't find any translation questions for this passage.";
  }
  
  const formattedQuestions = questions.slice(0, 3).map((q, index) => {
    const question = stripMarkdown(q.question || q.content || '');
    const response = q.response ? stripMarkdown(q.response) : '';
    
    if (index === 0) {
      return `Here's a good question to consider: ${question}${response ? ` The suggested answer is: ${response}` : ''}`;
    } else {
      return `Another question: ${question}${response ? ` And the answer: ${response}` : ''}`;
    }
  });
  
  const result = formattedQuestions.join(' ');
  
  if (questions.length > 3) {
    return `${result} Would you like to hear the other ${questions.length - 3} questions?`;
  }
  
  return result;
}

// Format word studies for speech
export function formatWordStudiesForSpeech(words: any[]): string {
  if (!words || words.length === 0) {
    return "I didn't find any word studies for this passage.";
  }
  
  const formattedWords = words.slice(0, 3).map((w, index) => {
    const word = w.word || w.term || '';
    const content = stripMarkdown(w.content || w.definition || '');
    
    if (index === 0) {
      return `Let me tell you about the word \"${word}\". ${content}`;
    } else {
      return `Another important word is \"${word}\". ${content}`;
    }
  });
  
  const result = formattedWords.join(' ');
  
  if (words.length > 3) {
    return `${result} There are ${words.length - 3} more word studies available.`;
  }
  
  return result;
}

// Format academy articles for speech
export function formatAcademyForSpeech(articles: any[]): string {
  if (!articles || articles.length === 0) {
    return "I didn't find any academy articles on this topic.";
  }
  
  const formattedArticles = articles.slice(0, 2).map((article, index) => {
    const title = article.title || '';
    const content = stripMarkdown(article.content || article.body || '').slice(0, 500);
    
    if (index === 0) {
      return `I found an academy article called \"${title}\". ${content}`;
    } else {
      return `There's also an article about \"${title}\". ${content}`;
    }
  });
  
  const result = formattedArticles.join(' ');
  
  if (articles.length > 2) {
    return `${result} Would you like me to tell you about the other ${articles.length - 2} articles?`;
  }
  
  return result;
}

// Format combined search results for speech
export function formatSearchResultsForSpeech(results: any[]): string {
  if (!results || results.length === 0) {
    return "I didn't find any resources on that topic. Could you try a different search term or scripture reference?";
  }
  
  // Group by resource type
  const notes = results.filter(r => r.resourceType === 'tn');
  const questions = results.filter(r => r.resourceType === 'tq');
  const words = results.filter(r => r.resourceType === 'tw');
  const academy = results.filter(r => r.resourceType === 'ta');
  
  const parts: string[] = [];
  
  parts.push(`I found ${results.length} resources for you.`);
  
  if (notes.length > 0) {
    parts.push(formatNotesForSpeech(notes.slice(0, 2)));
  }
  
  if (questions.length > 0 && parts.length < 3) {
    parts.push(formatQuestionsForSpeech(questions.slice(0, 1)));
  }
  
  if (words.length > 0 && parts.length < 3) {
    parts.push(formatWordStudiesForSpeech(words.slice(0, 1)));
  }
  
  if (academy.length > 0 && parts.length < 3) {
    parts.push(formatAcademyForSpeech(academy.slice(0, 1)));
  }
  
  parts.push("Would you like me to go deeper into any of these?");
  
  return parts.join(' ');
}

// Format error messages for speech
export function formatErrorForSpeech(error: string): string {
  if (error.includes('not found') || error.includes('404')) {
    return "I couldn't find what you're looking for. Could you try rephrasing your question or using a different reference?";
  }
  
  if (error.includes('timeout') || error.includes('network')) {
    return "I'm having trouble connecting right now. Let's try that again in a moment.";
  }
  
  return "Something went wrong while searching. Let me try that again.";
}

// Format user notes for voice conversation
export function formatNotesForVoice(notes: any[], scopeReference?: string): string {
  if (!notes || notes.length === 0) {
    if (scopeReference) {
      return `You don't have any notes for ${scopeReference}. Would you like me to create one?`;
    }
    return "You don't have any saved notes yet. Would you like me to create one?";
  }
  
  const count = notes.length;
  let response = '';
  
  // Add scope context if filtering
  if (scopeReference) {
    response += `You have ${count} note${count > 1 ? 's' : ''} related to ${scopeReference}. `;
  } else {
    response += `You have ${count} note${count > 1 ? 's' : ''} in total. `;
  }
  
  // Read up to 3 notes with their references
  const toRead = notes.slice(0, 3);
  toRead.forEach((note, i) => {
    const content = note.content || '';
    const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
    const ordinal = ['First', 'Second', 'Third'][i];
    
    response += `${ordinal}: "${truncated}"`;
    if (note.source_reference) {
      response += ` - from ${note.source_reference}`;
    }
    response += '. ';
  });
  
  if (count > 3) {
    response += `There are ${count - 3} more note${count - 3 > 1 ? 's' : ''}. Would you like me to continue?`;
  }
  
  return response;
}
