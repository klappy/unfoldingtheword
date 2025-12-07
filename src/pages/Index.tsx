import { useState, useCallback, useEffect } from 'react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryPanel } from '@/components/HistoryPanel';
import { Note, ResourceLink, HistoryItem } from '@/types';
import { mockHistory, mockNotes } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { useScriptureData } from '@/hooks/useScriptureData';
import { useMultiAgentChat } from '@/hooks/useMultiAgentChat';

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

  const { scripture, resources, isLoading: scriptureLoading, error: scriptureError, loadScriptureData } = useScriptureData();
  const { messages, isLoading: chatLoading, error: chatError, sendMessage } = useMultiAgentChat();
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [history] = useState<HistoryItem[]>(mockHistory);

  // Scripture is loaded when AI identifies a reference in chat

  const handleSendMessage = useCallback(async (content: string) => {
    // Send to multi-agent chat
    const result = await sendMessage(
      content,
      scripture?.reference,
      async (scriptureRef) => {
        // Load scripture when AI identifies a reference
        try {
          await loadScriptureData(scriptureRef);
          toast({
            title: 'Scripture loaded',
            description: `Loaded ${scriptureRef} and related resources`,
          });
        } catch (error) {
          console.error('Failed to load scripture:', error);
        }
      }
    );

    // If AI found a scripture reference, notify user
    if (result?.scriptureReference) {
      toast({
        title: 'Resources updated',
        description: 'Swipe right to view scripture and resources',
      });
    }
  }, [sendMessage, scripture?.reference, loadScriptureData, toast]);

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
            isLoading={chatLoading}
          />
        );
      case 'scripture':
        return (
          <ScriptureCard
            passage={scripture}
            onAddToNotes={(text) => handleAddToNotes(text, scripture?.reference)}
            isLoading={scriptureLoading}
            error={scriptureError}
            onRetry={() => scripture?.reference && loadScriptureData(scripture.reference)}
          />
        );
      case 'resources':
        return (
          <ResourcesCard
            resources={resources}
            onAddToNotes={(text) => handleAddToNotes(text)}
            isLoading={scriptureLoading}
            error={scriptureError}
            onRetry={() => scripture?.reference && loadScriptureData(scripture.reference)}
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
