import { useCallback } from 'react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryPanel } from '@/components/HistoryPanel';
import { ResourceLink, HistoryItem, Message } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useScriptureData } from '@/hooks/useScriptureData';
import { useMultiAgentChat } from '@/hooks/useMultiAgentChat';
import { useNotes } from '@/hooks/useNotes';
import { useConversations } from '@/hooks/useConversations';

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

  const { scripture, resources, isLoading: scriptureLoading, error: scriptureError, loadScriptureData, loadKeywordResources, clearData: clearScriptureData } = useScriptureData();
  const { messages, isLoading: chatLoading, sendMessage, setMessages, clearMessages } = useMultiAgentChat();
  const { notes, addNote, deleteNote } = useNotes();
  const { 
    conversations, 
    currentConversationId, 
    setCurrentConversationId,
    createConversation, 
    updateConversation,
    saveMessage,
    loadConversationMessages,
  } = useConversations();

  // Use resources from useScriptureData (now handles both scripture refs and keyword searches)
  // The aggregatedResources useMemo is no longer needed since loadKeywordResources populates resources directly

  const handleSendMessage = useCallback(async (content: string) => {
    // Create conversation on first message if needed
    let convId = currentConversationId;
    if (!convId) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      convId = await createConversation(title, content);
    }

    // Create user message object
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Save user message
    if (convId) {
      await saveMessage(convId, userMessage);
    }

    // Send to multi-agent chat and get the new messages
    const result = await sendMessage(
      content,
      scripture?.reference,
      async (scriptureRef) => {
        // Load scripture when AI identifies a reference
        try {
          await loadScriptureData(scriptureRef);
          // Update conversation with scripture reference
          if (convId) {
            await updateConversation(convId, { scriptureReference: scriptureRef });
          }
          toast({
            title: 'Scripture loaded',
            description: `Loaded ${scriptureRef} and related resources`,
          });
        } catch (error) {
          console.error('Failed to load scripture:', error);
        }
      }
    );

    // Save assistant messages that were just created
    if (convId && result?.newMessages) {
      for (const msg of result.newMessages) {
        await saveMessage(convId, msg);
      }
    }

    // If AI found a scripture reference, notify user
    if (result?.scriptureReference) {
      toast({
        title: 'Resources updated',
        description: 'Swipe right to view scripture and resources',
      });
    } else if (result?.searchQuery) {
      // For keyword searches, load resources from search API
      await loadKeywordResources(result.searchQuery);
      toast({
        title: 'Resources found',
        description: `Found resources for "${result.searchQuery}"`,
      });
    }
  }, [sendMessage, scripture?.reference, loadScriptureData, loadKeywordResources, toast, currentConversationId, createConversation, saveMessage, updateConversation]);

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

  const handleAddToNotes = useCallback(async (content: string, sourceReference?: string) => {
    const note = await addNote(content, sourceReference);
    if (note) {
      toast({
        title: 'Added to notes',
        description: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      });
    }
  }, [addNote, toast]);

  const handleDeleteNote = useCallback(async (id: string) => {
    await deleteNote(id);
  }, [deleteNote]);

  const handleHistorySelect = useCallback(async (item: HistoryItem) => {
    closeHistory();
    toast({
      title: 'Loading conversation',
      description: item.title,
    });
    
    // Load conversation messages
    const loadedMessages = await loadConversationMessages(item.id);
    setMessages(loadedMessages);
    setCurrentConversationId(item.id);
    
    // Load scripture if available
    if (item.scriptureReference) {
      await loadScriptureData(item.scriptureReference);
    }
  }, [closeHistory, toast, loadConversationMessages, setMessages, setCurrentConversationId, loadScriptureData]);

  const handleNewConversation = useCallback(() => {
    clearMessages();
    clearScriptureData();
    setCurrentConversationId(null);
    closeHistory();
    toast({
      title: 'New conversation',
      description: 'Starting fresh',
    });
  }, [clearMessages, clearScriptureData, setCurrentConversationId, closeHistory, toast]);

  const handleLoadFullChapter = useCallback(async (chapterRef: string) => {
    try {
      await loadScriptureData(chapterRef);
      toast({
        title: 'Loading full chapter',
        description: chapterRef,
      });
    } catch (error) {
      console.error('Failed to load full chapter:', error);
    }
  }, [loadScriptureData, toast]);

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
            onLoadFullChapter={handleLoadFullChapter}
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
        items={conversations}
        onClose={closeHistory}
        onSelectItem={handleHistorySelect}
        onNewConversation={handleNewConversation}
      />
    </div>
  );
};

export default Index;
