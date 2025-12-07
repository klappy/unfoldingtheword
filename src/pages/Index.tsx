import { useState, useCallback } from 'react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryPanel } from '@/components/HistoryPanel';
import { Message, Note, ResourceLink, HistoryItem } from '@/types';
import { mockScripture, mockResources, mockHistory, mockNotes } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

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

  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [isLoading, setIsLoading] = useState(false);
  const [scripture, setScripture] = useState(mockScripture);
  const [resources, setResources] = useState(mockResources);
  const [history] = useState<HistoryItem[]>(mockHistory);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response with resources
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Great question about "${content}"! John 3:16 is often called the "Gospel in miniature" because it summarizes the core message of Christianity. The verse emphasizes three key themes:\n\n1. **God's Love** - "God so loved the world" shows the extent and depth of divine love\n2. **God's Gift** - "He gave his only Son" reveals the cost of redemption\n3. **Our Response** - "whoever believes" shows that salvation is available to all who have faith`,
        agent: 'scripture',
        timestamp: new Date(),
        resources: [
          {
            type: 'scripture',
            reference: 'John 3:16-17',
            title: 'John 3:16-17 (ULT)',
            preview: 'For God so loved the world...',
          },
          {
            type: 'note',
            reference: 'John 3:16',
            title: 'Translation Note: "only Son"',
          },
          {
            type: 'word',
            reference: 'kosmos',
            title: 'Word Study: κόσμος (world)',
          },
        ],
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  }, []);

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
