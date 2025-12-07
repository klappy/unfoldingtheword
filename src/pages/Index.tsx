import { useState, useCallback, useEffect } from 'react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryPanel } from '@/components/HistoryPanel';
import { Message, Note, ResourceLink, HistoryItem } from '@/types';
import { mockHistory, mockNotes } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { useScriptureData } from '@/hooks/useScriptureData';

const Index = () => {
  const { toast } = useToast();
  const {
    currentCard,
    showHistory,
    handleTouchStart,
    handleTouchEnd,
    navigateToCard,
    closeHistory,
    cardOrder,
  } = useSwipeNavigation();

  const { scripture, resources, isLoading: scriptureLoading, loadScriptureData } = useScriptureData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [isLoading, setIsLoading] = useState(false);
  const [history] = useState<HistoryItem[]>(mockHistory);

  // Load initial scripture on mount
  useEffect(() => {
    loadScriptureData('John 3:16-17');
  }, [loadScriptureData]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Extract scripture reference from message if present
    const refMatch = content.match(/(\d?\s?[a-zA-Z]+)\s*(\d+)(?::(\d+)(?:-(\d+))?)?/i);
    if (refMatch) {
      const extractedRef = refMatch[0];
      try {
        await loadScriptureData(extractedRef);
        toast({
          title: 'Scripture loaded',
          description: `Loaded ${extractedRef} and related resources`,
        });
      } catch {
        // Continue with response even if scripture loading fails
      }
    }

    // Simulate AI response with live resources
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Great question about "${content}"! ${scripture ? `Looking at ${scripture.reference}, we can explore the passage together.` : 'Let me help you explore that topic.'}\n\nThe scripture and related resources are now available - swipe right to view the passage and continue swiping to see translation notes, questions, and word studies.`,
        agent: 'scripture',
        timestamp: new Date(),
        resources: scripture ? [
          {
            type: 'scripture',
            reference: scripture.reference,
            title: `${scripture.reference} (${scripture.translation})`,
            preview: scripture.verses[0]?.text.substring(0, 50) + '...',
          },
          ...(resources.slice(0, 2).map((r) => ({
            type: r.type === 'translation-note' ? 'note' as const : 
                  r.type === 'translation-question' ? 'question' as const :
                  r.type === 'translation-word' ? 'word' as const : 'academy' as const,
            reference: r.reference || '',
            title: r.title,
          }))),
        ] : [],
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 500);
  }, [scripture, resources, loadScriptureData, toast]);

  const handleResourceClick = useCallback((resource: ResourceLink) => {
    if (resource.type === 'scripture') {
      navigateToCard('scripture');
    } else {
      navigateToCard('resources');
    }
    toast({
      title: `Opening ${resource.title}`,
      description: resource.reference,
    });
  }, [navigateToCard, toast]);

  const handleAddToNotes = useCallback((content: string, sourceReference?: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      sourceReference,
      createdAt: new Date(),
      highlighted: true,
    };
    setNotes((prev) => [newNote, ...prev]);
    toast({
      title: 'Added to notes',
      description: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
    });
  }, [toast]);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    closeHistory();
    toast({
      title: 'Loading conversation',
      description: item.title,
    });
    // In a real app, this would load the conversation
  }, [closeHistory, toast]);

  const renderCurrentCard = () => {
    switch (currentCard) {
      case 'chat':
        return (
          <ChatCard
            messages={messages}
            onSendMessage={handleSendMessage}
            onResourceClick={handleResourceClick}
            isLoading={isLoading}
          />
        );
      case 'scripture':
        return (
          <ScriptureCard
            passage={scripture}
            onAddToNotes={(text) => handleAddToNotes(text, scripture?.reference)}
            isLoading={scriptureLoading}
          />
        );
      case 'resources':
        return (
          <ResourcesCard
            resources={resources}
            onAddToNotes={(text) => handleAddToNotes(text)}
          />
        );
      case 'notes':
        return (
          <NotesCard
            notes={notes}
            onAddNote={(content) => handleAddToNotes(content)}
            onDeleteNote={handleDeleteNote}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {/* Main swipeable content */}
      <SwipeContainer
        currentCard={currentCard}
        cardOrder={cardOrder}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderCurrentCard()}
      </SwipeContainer>

      {/* History panel (swipe down) */}
      <HistoryPanel
        isOpen={showHistory}
        items={history}
        onClose={closeHistory}
        onSelectItem={handleHistorySelect}
      />
    </div>
  );
};

export default Index;
