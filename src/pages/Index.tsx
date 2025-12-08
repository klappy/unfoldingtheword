import { useCallback, useState } from 'react';
import { Resource } from '@/types';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryCard } from '@/components/HistoryCard';
import { ResourceLink, HistoryItem, Message, CardType } from '@/types';
import { useScriptureData } from '@/hooks/useScriptureData';
import { useMultiAgentChat } from '@/hooks/useMultiAgentChat';
import { useNotes } from '@/hooks/useNotes';
import { useConversations } from '@/hooks/useConversations';

const Index = () => {
  const {
    currentCard,
    swipeDirection,
    dragOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    navigateToCard,
    cardOrder,
  } = useSwipeNavigation();

  const { scripture, resources, isLoading: scriptureLoading, error: scriptureError, verseFilter, loadScriptureData, loadKeywordResources, filterByVerse, clearVerseFilter, clearData: clearScriptureData } = useScriptureData();
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

  const handleSendMessage = useCallback(async (content: string) => {
    let convId = currentConversationId;
    if (!convId) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      convId = await createConversation(title, content);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    if (convId) {
      await saveMessage(convId, userMessage);
    }

    const result = await sendMessage(
      content,
      scripture?.reference,
      async (scriptureRef) => {
        console.log('[Index] onScriptureReference callback triggered:', scriptureRef);
        try {
          await loadScriptureData(scriptureRef);
          console.log('[Index] Scripture data loaded successfully');
          if (convId) {
            await updateConversation(convId, { scriptureReference: scriptureRef });
          }
        } catch (error) {
          console.error('[Index] Failed to load scripture:', error);
        }
      }
    );

    if (convId && result?.newMessages) {
      for (const msg of result.newMessages) {
        await saveMessage(convId, msg);
      }
    }

    if (result?.searchQuery) {
      await loadKeywordResources(result.searchQuery);
    }
  }, [sendMessage, scripture?.reference, loadScriptureData, loadKeywordResources, currentConversationId, createConversation, saveMessage, updateConversation]);

  // Map ResourceLink type to Resource type for scrolling
  const getResourceTypeFromLink = (linkType: ResourceLink['type']): Resource['type'] | null => {
    switch (linkType) {
      case 'note': return 'translation-note';
      case 'question': return 'translation-question';
      case 'word': return 'translation-word';
      case 'academy': return 'academy-article';
      default: return null;
    }
  };

  const [scrollToResourceType, setScrollToResourceType] = useState<Resource['type'] | null>(null);

  const handleResourceClick = useCallback((resource: ResourceLink) => {
    if (resource.type === 'scripture') {
      navigateToCard('scripture');
    } else {
      const resourceType = getResourceTypeFromLink(resource.type);
      setScrollToResourceType(resourceType);
      navigateToCard('resources');
    }
  }, [navigateToCard]);

  const handleAddToNotes = useCallback(async (content: string, sourceReference?: string) => {
    await addNote(content, sourceReference);
  }, [addNote]);

  const handleDeleteNote = useCallback(async (id: string) => {
    await deleteNote(id);
  }, [deleteNote]);

  const handleHistorySelect = useCallback(async (item: HistoryItem) => {
    const loadedMessages = await loadConversationMessages(item.id);
    setMessages(loadedMessages);
    setCurrentConversationId(item.id);
    
    if (item.scriptureReference) {
      await loadScriptureData(item.scriptureReference);
    }
    
    navigateToCard('chat');
  }, [loadConversationMessages, setMessages, setCurrentConversationId, loadScriptureData, navigateToCard]);

  const handleNewConversation = useCallback(() => {
    clearMessages();
    clearScriptureData();
    setCurrentConversationId(null);
    navigateToCard('chat');
  }, [clearMessages, clearScriptureData, setCurrentConversationId, navigateToCard]);

  const handleVerseSelect = useCallback((reference: string) => {
    console.log('[Index] Verse selected:', reference);
    filterByVerse(reference);
  }, [filterByVerse]);


  const renderCard = useCallback((card: CardType) => {
    switch (card) {
      case 'history':
        return (
          <HistoryCard
            items={conversations}
            onSelectItem={handleHistorySelect}
            onNewConversation={handleNewConversation}
          />
        );
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
            onVerseSelect={handleVerseSelect}
            verseFilter={verseFilter}
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
            onSearch={(query) => {
              navigateToCard('chat');
              handleSendMessage(query);
            }}
            verseFilter={verseFilter}
            onClearVerseFilter={clearVerseFilter}
            isLoading={scriptureLoading}
            error={scriptureError}
            onRetry={() => scripture?.reference && loadScriptureData(scripture.reference)}
            scrollToType={scrollToResourceType}
            onScrollComplete={() => setScrollToResourceType(null)}
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
  }, [conversations, handleHistorySelect, handleNewConversation, messages, handleSendMessage, handleResourceClick, chatLoading, scripture, handleAddToNotes, handleVerseSelect, scriptureLoading, scriptureError, loadScriptureData, resources, verseFilter, filterByVerse, navigateToCard, notes, handleDeleteNote]);

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <SwipeContainer
        currentCard={currentCard}
        cardOrder={cardOrder}
        swipeDirection={swipeDirection}
        dragOffset={dragOffset}
        isDragging={isDragging}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        renderCard={renderCard}
      />
    </div>
  );
};

export default Index;
