import { useCallback, useState, useMemo, useEffect } from 'react';
import { Resource, SearchResults, ToolCall } from '@/types';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useCardVisibility } from '@/hooks/useCardVisibility';
import { useLanguage } from '@/hooks/useLanguage';
import { useI18n } from '@/hooks/useI18n';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { SwipeContainer } from '@/components/SwipeContainer';
import { ChatCard } from '@/components/ChatCard';
import { ScriptureCard } from '@/components/ScriptureCard';
import { ResourcesCard } from '@/components/ResourcesCard';
import { NotesCard } from '@/components/NotesCard';
import { HistoryCard } from '@/components/HistoryCard';
import { SearchCard } from '@/components/SearchCard';
import { LanguageSelectionChat } from '@/components/LanguageSelectionChat';
import { TranslationDialog } from '@/components/TranslationDialog';
import { DismissConfirmDialog } from '@/components/DismissConfirmDialog';
import { PersistentInputBar } from '@/components/PersistentInputBar';
import { ResourceLink, HistoryItem, Message, CardType } from '@/types';
import { useScriptureData } from '@/hooks/useScriptureData';
import { useMultiAgentChat } from '@/hooks/useMultiAgentChat';
import { useNotes } from '@/hooks/useNotes';
import { useConversations } from '@/hooks/useConversations';
import { useTranslation, TranslationItem } from '@/hooks/useTranslation';
import { useMcpReplay } from '@/hooks/useMcpReplay';

const Index = () => {
  const {
    language,
    organization,
    availableLanguages,
    availableOrganizations,
    getOrganizationsForLanguage,
    isLoading: languageLoading,
    needsSelection,
    getCurrentLanguage,
    completeSelection,
    resourcePreferences,
    setActiveResource,
  } = useLanguage();

  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dismissCard, setDismissCard] = useState<CardType | null>(null);

  const { scripture, resources, searchResults, isLoading: scriptureLoading, isResourcesLoading, error: scriptureError, verseFilter, fallbackState, loadScriptureData, loadKeywordResources, loadFilteredSearch, filterByVerse, clearVerseFilter, clearSearchResults, setSearchResultsFromMetadata, navigateToVerse, clearData: clearScriptureData, setScripture, setResources, setSearchResults } = useScriptureData();
  const { notes, addNote, addBugReport, deleteNote, updateNote, refetchNotes } = useNotes();
  const { messages, isLoading: chatLoading, sendMessage, setMessages, clearMessages } = useMultiAgentChat({
    onBugReport: addBugReport,
  });
  
  // MCP replay for tool calls from messages
  const mcpReplay = useMcpReplay();

  const { 
    conversations, 
    currentConversationId, 
    setCurrentConversationId,
    createConversation, 
    updateConversation,
    saveMessage,
    loadConversationMessages,
  } = useConversations(language || 'en');
  
  // Replay tool calls when MCP state changes
  useEffect(() => {
    if (mcpReplay.scripture && !mcpReplay.isLoading) {
      setScripture(mcpReplay.scripture);
    }
    if (mcpReplay.resources.length > 0 && !mcpReplay.isLoading) {
      setResources(mcpReplay.resources);
    }
    if (mcpReplay.searchResults && !mcpReplay.isLoading) {
      // Build breakdown from matches
      const byBook: Record<string, number> = {};
      for (const match of mcpReplay.searchResults.matches) {
        byBook[match.book] = (byBook[match.book] || 0) + 1;
      }
      setSearchResults({
        query: mcpReplay.searchResults.query,
        reference: mcpReplay.searchResults.reference,
        matches: mcpReplay.searchResults.matches,
        resource: mcpReplay.searchResults.resource || 'ult',
        totalMatches: mcpReplay.searchResults.matches.length,
        breakdown: { byBook },
      });
    }
  }, [mcpReplay.scripture, mcpReplay.resources, mcpReplay.searchResults, mcpReplay.isLoading, setScripture, setResources, setSearchResults]);

  // Compute content state for dynamic card visibility
  const contentState = useMemo(() => ({
    hasHistory: conversations.length > 0,
    hasSearch: searchResults !== null,
    hasScripture: scripture !== null,
    hasResources: resources.length > 0,
    hasNotes: notes.length > 0,
  }), [conversations.length, searchResults, scripture, resources.length, notes.length]);

  // Use card visibility hook
  const {
    visibleCards,
    dismissCard: handleDismissCard,
    shouldConfirmDismiss,
    isCardVisible,
  } = useCardVisibility(contentState);

  // Handle swipe up to dismiss
  const handleSwipeUp = useCallback((card: CardType) => {
    // Don't allow dismissing chat
    if (card === 'chat') return;
    
    if (shouldConfirmDismiss(card)) {
      setDismissCard(card);
    } else {
      handleDismissCard(card, false);
    }
  }, [shouldConfirmDismiss, handleDismissCard]);

  const {
    currentCard,
    swipeDirection,
    dragOffset,
    dragOffsetY,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    navigateToCard,
    cardOrder,
  } = useSwipeNavigation({ 
    visibleCards, 
    onSwipeUp: handleSwipeUp 
  });

  // Voice conversation - managed at top level so it persists across card navigation
  const voiceConversation = useVoiceConversation({
    language: language || 'en',
    onScriptureReference: useCallback(async (reference: string, resource?: string) => {
      console.log('[Index] Voice scripture reference:', reference, 'resource:', resource);
      
      // Pass resource directly to loadScriptureData - avoids race condition with localStorage
      await loadScriptureData(reference, resource);
      // Navigate AFTER data loads to prevent blank card
      navigateToCard('scripture');
    }, [loadScriptureData, navigateToCard]),
    onToolCall: useCallback(async (toolName: string, args: any) => {
      console.log('[Index] Voice tool call:', toolName, args);
      // Handle bible_study_assistant responses with search data
      if (toolName === 'bible_study_assistant' && args.response) {
        const { navigation_hint, scripture_reference, search_query } = args.response;
        if (navigation_hint === 'search' && scripture_reference && search_query) {
          await loadFilteredSearch(scripture_reference, search_query);
          navigateToCard('search');
        }
      }
      // Legacy tool handling
      else if (toolName === 'get_scripture_passage') {
        if (args.filter) {
          await loadFilteredSearch(args.reference, args.filter);
          navigateToCard('search');
        } else {
          navigateToCard('scripture');
        }
      } else if (!toolName.includes('note')) {
        navigateToCard('resources');
      }
    }, [navigateToCard, loadFilteredSearch]),
    onNavigate: useCallback(async (hint: 'scripture' | 'resources' | 'search' | 'notes', metadata?: any) => {
      console.log('[Index] Voice navigate:', hint, metadata);
      if (hint === 'search' && metadata?.scripture_reference && metadata?.search_query) {
        // Use search matches from metadata if available
        if (metadata?.search_matches && metadata.search_matches.length > 0) {
          setSearchResultsFromMetadata(metadata.scripture_reference, metadata.search_query, metadata.search_matches);
        } else {
          await loadFilteredSearch(metadata.scripture_reference, metadata.search_query);
        }
        navigateToCard('search');
      } else if (hint === 'scripture') {
        // Scripture loading handled by onScriptureReference
      } else if (hint === 'resources') {
        navigateToCard('resources');
      } else if (hint === 'notes') {
        navigateToCard('notes');
      }
    }, [navigateToCard, loadFilteredSearch, setSearchResultsFromMetadata]),
    onError: (error) => {
      console.error('[Index] Voice error:', error);
    },
    // Note management callbacks - navigate to notes card
    onNoteCreated: useCallback((note) => {
      console.log('[Index] Voice note created:', note);
      refetchNotes(); // Refresh notes list
      navigateToCard('notes');
    }, [navigateToCard, refetchNotes]),
    onNoteUpdated: useCallback((id, content) => {
      console.log('[Index] Voice note updated:', id);
      refetchNotes();
      navigateToCard('notes');
    }, [navigateToCard, refetchNotes]),
    onNoteDeleted: useCallback((id) => {
      console.log('[Index] Voice note deleted:', id);
      refetchNotes();
      navigateToCard('notes');
    }, [navigateToCard, refetchNotes]),
    onNotesAccessed: useCallback(() => {
      console.log('[Index] Voice reading notes');
      navigateToCard('notes');
    }, [navigateToCard]),
    onBugReport: useCallback((errorMessage: string, context: string) => {
      console.log('[Index] Creating bug report from voice error');
      addBugReport(errorMessage, context);
    }, [addBugReport]),
  });

  // Get target language for AI responses - prefer native name for better localization
  const targetLanguageName = useMemo(() => {
    if (!language) return 'English';
    const lang = availableLanguages.find(l => l.id === language);
    // Use native name first (e.g., "Español" instead of "Spanish") for better AI localization
    const name = lang?.nativeName || lang?.name || language;
    console.log('[Index] Target language name:', name, 'from language code:', language);
    return name;
  }, [availableLanguages, language]);

  // UI localization
  const { t, isLoading: i18nLoading, hasStaticTranslations, translateUiStrings } = useI18n(language || 'en');

  const {
    isTranslating,
    pendingBatch,
    requestBatchTranslation,
    cancelTranslation,
    confirmTranslation,
    getTranslatedContent,
  } = useTranslation(targetLanguageName);

  // Build batch translation items from fallback content
  const buildBatchItems = useCallback((): TranslationItem[] => {
    const items: TranslationItem[] = [];
    
    // Add scripture if it used fallback
    if (fallbackState?.hasFallback && scripture?.book) {
      const scriptureText = scripture.book.chapters
        .map(ch => ch.verses.map(v => `${v.number} ${v.text}`).join(' '))
        .join('\n\n');
      items.push({
        id: 'scripture',
        content: scriptureText.substring(0, 10000), // Limit to avoid too large requests
        contentType: 'scripture',
      });
    }
    
    return items;
  }, [fallbackState, scripture]);

  const handleTranslateAllRequest = useCallback(() => {
    const items = buildBatchItems();
    if (items.length > 0) {
      requestBatchTranslation(items);
    }
  }, [buildBatchItems, requestBatchTranslation]);

  const handleSendMessage = useCallback(async (content: string) => {
    let convId = currentConversationId;
    if (!convId) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      convId = await createConversation(title, content, undefined, language || 'en');
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
          // Navigate to scripture card after loading
          navigateToCard('scripture');
        } catch (error) {
          console.error('[Index] Failed to load scripture:', error);
        }
      },
      targetLanguageName // Pass language for localized chat responses
    );

    if (convId && result?.newMessages) {
      for (const msg of result.newMessages) {
        await saveMessage(convId, msg);
      }
    }

    if (result) {
      const { toolCalls, navigationHint, scriptureReference } = result;
      
      // Replay tool calls to populate UI state (scripture, resources, search)
      if (toolCalls && toolCalls.length > 0) {
        console.log('[Index] Replaying tool calls from new message:', toolCalls);
        mcpReplay.replayToolCalls(toolCalls);
      }
      
      // Navigate based on navigation hint
      if (navigationHint === 'search') {
        navigateToCard('search');
      } else if (navigationHint === 'scripture') {
        navigateToCard('scripture');
      } else if (navigationHint === 'resources') {
        navigateToCard('resources');
      } else if (navigationHint === 'notes') {
        navigateToCard('notes');
      }
      
      // Update conversation with scripture reference
      if (scriptureReference && convId) {
        await updateConversation(convId, { scriptureReference });
      }
    }
  }, [sendMessage, scripture?.reference, loadScriptureData, currentConversationId, createConversation, saveMessage, updateConversation, language, targetLanguageName, navigateToCard, mcpReplay]);

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
    
    // Find last assistant message with tool calls and replay them
    const lastAssistantWithTools = [...loadedMessages].reverse().find(
      m => m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0
    );
    
    if (lastAssistantWithTools?.toolCalls) {
      console.log('[Index] Replaying tool calls from history:', lastAssistantWithTools.toolCalls);
      mcpReplay.replayToolCalls(lastAssistantWithTools.toolCalls);
    } else if (item.scriptureReference) {
      // Fallback for old conversations without tool calls
      await loadScriptureData(item.scriptureReference);
    }
    
    navigateToCard('chat');
  }, [loadConversationMessages, setMessages, setCurrentConversationId, loadScriptureData, navigateToCard, mcpReplay]);

  const handleNewConversation = useCallback(() => {
    clearMessages();
    clearScriptureData();
    setCurrentConversationId(null);
    clearSearchResults();
    navigateToCard('chat');
  }, [clearMessages, clearScriptureData, setCurrentConversationId, clearSearchResults, navigateToCard]);

  const handleVerseSelect = useCallback((reference: string) => {
    console.log('[Index] Verse selected:', reference);
    filterByVerse(reference);
  }, [filterByVerse]);

  // Handle scripture reference clicks from chat messages
  const handleScriptureReferenceClick = useCallback(async (reference: string) => {
    console.log('[Index] Scripture reference clicked:', reference);
    await loadScriptureData(reference);
    navigateToCard('scripture');
  }, [loadScriptureData, navigateToCard]);

  // Handle search result verse click - fast scroll if same book, otherwise full load
  const handleSearchVerseClick = useCallback(async (reference: string) => {
    console.log('[Index] Search result verse clicked:', reference);
    
    // Try fast navigation first (same book already loaded)
    const fastNav = navigateToVerse(reference);
    if (fastNav) {
      console.log('[Index] Using fast navigation to:', reference);
      navigateToCard('scripture');
      return;
    }
    
    // Different book - need full load
    await loadScriptureData(reference);
    navigateToCard('scripture');
  }, [navigateToVerse, loadScriptureData, navigateToCard]);

  // Clear search results
  const handleClearSearch = useCallback(() => {
    clearSearchResults();
  }, [clearSearchResults]);

  const renderCard = useCallback((card: CardType) => {
    switch (card) {
      case 'history':
        return (
          <HistoryCard
            items={conversations}
            onSelectItem={handleHistorySelect}
            onNewConversation={handleNewConversation}
            t={t}
          />
        );
      case 'chat':
        return (
          <ChatCard
            messages={messages}
            onResourceClick={handleResourceClick}
            onScriptureClick={handleScriptureReferenceClick}
            isLoading={chatLoading}
            currentLanguage={getCurrentLanguage()}
            onChangeLanguage={() => setShowLanguageSelector(true)}
            t={t}
            hasStaticTranslations={hasStaticTranslations}
            onTranslateUi={translateUiStrings}
            isTranslatingUi={i18nLoading}
            // Voice mode props
            showVoiceMode={showVoiceMode}
            onShowVoiceMode={setShowVoiceMode}
            voiceStatus={voiceConversation.status}
            voiceIsAgentSpeaking={voiceConversation.isAgentSpeaking}
            voiceUserTranscript={voiceConversation.userTranscript}
            voiceAgentTranscript={voiceConversation.agentTranscript}
            voiceIsConnected={voiceConversation.isConnected}
            onStartVoice={voiceConversation.startConversation}
            onEndVoice={voiceConversation.endConversation}
            // Reset dialog
            showResetConfirm={showResetConfirm}
            onShowResetConfirm={setShowResetConfirm}
          />
        );
      case 'search':
        return (
          <SearchCard
            results={searchResults}
            onClearSearch={handleClearSearch}
            onVerseClick={handleSearchVerseClick}
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
            fallbackState={fallbackState}
            onTranslateRequest={handleTranslateAllRequest}
            isTranslating={isTranslating}
            resourcePreferences={resourcePreferences}
            onResourceSelect={async (resource) => {
              setActiveResource(resource);
              // Reload scripture with new resource - don't clear, just overlay with loading
              if (scripture?.reference) {
                const ref = scripture.reference;
                // Don't clear - keep stale content visible while loading
                loadScriptureData(ref, resource.resource);
              }
            }}
            currentLanguage={language || 'en'}
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
            isLoading={isResourcesLoading}
            error={scriptureError}
            onRetry={() => scripture?.reference && loadScriptureData(scripture.reference)}
            scrollToType={scrollToResourceType}
            onScrollComplete={() => setScrollToResourceType(null)}
            currentLanguage={language}
          />
        );
      case 'notes':
        return (
          <NotesCard
            notes={notes}
            onAddNote={(content) => handleAddToNotes(content)}
            onDeleteNote={handleDeleteNote}
            t={t}
            currentLanguage={language}
          />
        );
      default:
        return null;
    }
  }, [conversations, handleHistorySelect, handleNewConversation, messages, handleResourceClick, handleScriptureReferenceClick, chatLoading, scripture, handleAddToNotes, handleVerseSelect, scriptureLoading, isResourcesLoading, scriptureError, loadScriptureData, resources, verseFilter, filterByVerse, navigateToCard, notes, handleDeleteNote, getCurrentLanguage, resourcePreferences, setActiveResource, language, t, hasStaticTranslations, translateUiStrings, i18nLoading, showVoiceMode, voiceConversation, showResetConfirm, handleSendMessage, scrollToResourceType, clearVerseFilter, fallbackState, handleTranslateAllRequest, isTranslating, clearScriptureData, searchResults, handleClearSearch, handleSearchVerseClick]);

  // Show chat-based language selection on first launch or when manually triggered
  if (needsSelection || showLanguageSelector) {
    return (
      <div className="h-full w-full bg-background">
        <LanguageSelectionChat
          languages={availableLanguages}
          getOrganizationsForLanguage={getOrganizationsForLanguage}
          isLoading={languageLoading}
          onComplete={(langId, orgId) => {
            completeSelection(langId, orgId);
            setShowLanguageSelector(false);
          }}
        />
      </div>
    );
  }

  const batchItemCount = pendingBatch?.length || 0;
  const showInputBar = currentCard !== 'history';

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <SwipeContainer
        currentCard={currentCard}
        cardOrder={cardOrder}
        swipeDirection={swipeDirection}
        dragOffset={dragOffset}
        dragOffsetY={dragOffsetY}
        isDragging={isDragging}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        renderCard={renderCard}
      />
      
      <TranslationDialog
        isOpen={!!pendingBatch && batchItemCount > 0}
        isTranslating={isTranslating}
        contentType="content"
        targetLanguage={targetLanguageName}
        itemCount={batchItemCount}
        onConfirm={confirmTranslation}
        onCancel={cancelTranslation}
      />

      <DismissConfirmDialog
        isOpen={dismissCard !== null}
        cardType={dismissCard}
        onConfirm={(neverAskAgain) => {
          if (dismissCard) {
            handleDismissCard(dismissCard, neverAskAgain);
          }
          setDismissCard(null);
        }}
        onCancel={() => setDismissCard(null)}
      />
      
      {/* Persistent input bar - shown on all cards except history */}
      {showInputBar && (
        <PersistentInputBar
          onSendMessage={handleSendMessage}
          isLoading={chatLoading}
          placeholder={t('chat.placeholder')}
          language={language || undefined}
          voiceStatus={voiceConversation.status}
          voiceIsConnected={voiceConversation.isConnected}
          voiceIsAgentSpeaking={voiceConversation.isAgentSpeaking}
          voiceAgentTranscript={voiceConversation.agentTranscript}
          onStartVoice={voiceConversation.startConversation}
          onEndVoice={voiceConversation.endConversation}
          onShowVoiceMode={() => {
            setShowVoiceMode(true);
            navigateToCard('chat');
          }}
          voicePlaybackSpeed={voiceConversation.playbackSpeed}
          onVoicePlaybackSpeedChange={voiceConversation.setPlaybackSpeed}
          onResetCommand={() => setShowResetConfirm(true)}
        />
      )}
    </div>
  );
};

export default Index;
