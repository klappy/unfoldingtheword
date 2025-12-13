import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CardType } from '@/types';

const CARD_DISMISS_PREFS_KEY = 'bible-study-card-dismiss-prefs';
const CARD_SHOWN_ONCE_KEY = 'bible-study-cards-shown-once';

interface ContentState {
  hasHistory: boolean;
  hasSearch: boolean;
  hasScripture: boolean;
  hasResources: boolean;
  hasNotes: boolean;
}

interface DismissPrefs {
  dismissed: CardType[];
  neverAskAgain: CardType[];
}

const DEFAULT_PREFS: DismissPrefs = {
  dismissed: [],
  neverAskAgain: [],
};

// Cards that are always visible
const ALWAYS_VISIBLE: CardType[] = ['chat'];

// Full card order when all are visible
const FULL_CARD_ORDER: CardType[] = ['history', 'chat', 'search', 'scripture', 'resources', 'notes'];

export function useCardVisibility(contentState: ContentState) {
  const [dismissPrefs, setDismissPrefs] = useState<DismissPrefs>(() => {
    try {
      const saved = localStorage.getItem(CARD_DISMISS_PREFS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  // Track which cards have EVER had content (sticky visibility)
  const [shownOnce, setShownOnce] = useState<Set<CardType>>(() => {
    try {
      const saved = localStorage.getItem(CARD_SHOWN_ONCE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track previous content state to detect NEW content arriving
  const prevContentRef = useRef<ContentState>(contentState);

  // Persist dismiss prefs to localStorage
  useEffect(() => {
    localStorage.setItem(CARD_DISMISS_PREFS_KEY, JSON.stringify(dismissPrefs));
  }, [dismissPrefs]);

  // Persist shown-once state
  useEffect(() => {
    localStorage.setItem(CARD_SHOWN_ONCE_KEY, JSON.stringify([...shownOnce]));
  }, [shownOnce]);

  // Auto-restore dismissed cards when NEW content arrives
  // This makes dismissal temporary - new AI results will bring the card back
  useEffect(() => {
    const prev = prevContentRef.current;
    const cardsToRestore: CardType[] = [];

    // Check if content went from false → true (new content arrived)
    if (!prev.hasSearch && contentState.hasSearch && dismissPrefs.dismissed.includes('search')) {
      cardsToRestore.push('search');
    }
    if (!prev.hasScripture && contentState.hasScripture && dismissPrefs.dismissed.includes('scripture')) {
      cardsToRestore.push('scripture');
    }
    if (!prev.hasResources && contentState.hasResources && dismissPrefs.dismissed.includes('resources')) {
      cardsToRestore.push('resources');
    }
    if (!prev.hasNotes && contentState.hasNotes && dismissPrefs.dismissed.includes('notes')) {
      cardsToRestore.push('notes');
    }
    // History is less likely to need auto-restore, but include it for completeness
    if (!prev.hasHistory && contentState.hasHistory && dismissPrefs.dismissed.includes('history')) {
      cardsToRestore.push('history');
    }

    if (cardsToRestore.length > 0) {
      console.log('[useCardVisibility] Auto-restoring dismissed cards due to new content:', cardsToRestore);
      setDismissPrefs(prefs => ({
        ...prefs,
        dismissed: prefs.dismissed.filter(c => !cardsToRestore.includes(c)),
      }));
    }

    prevContentRef.current = contentState;
  }, [contentState, dismissPrefs.dismissed]);

  // Mark cards as shown when they have content
  useEffect(() => {
    const updates: CardType[] = [];
    if (contentState.hasHistory && !shownOnce.has('history')) updates.push('history');
    if (contentState.hasSearch && !shownOnce.has('search')) updates.push('search');
    if (contentState.hasScripture && !shownOnce.has('scripture')) updates.push('scripture');
    if (contentState.hasResources && !shownOnce.has('resources')) updates.push('resources');
    if (contentState.hasNotes && !shownOnce.has('notes')) updates.push('notes');
    
    if (updates.length > 0) {
      setShownOnce(prev => {
        const next = new Set(prev);
        updates.forEach(card => next.add(card));
        return next;
      });
    }
  }, [contentState, shownOnce]);

  // Compute which cards are visible - KEEP stale content visible
  const visibleCards = useMemo<CardType[]>(() => {
    const contentCards: CardType[] = [];

    for (const card of FULL_CARD_ORDER) {
      // Always show chat
      if (ALWAYS_VISIBLE.includes(card)) {
        contentCards.push(card);
        continue;
      }

      // Check if card is dismissed
      if (dismissPrefs.dismissed.includes(card)) {
        continue;
      }

      // Show card if it CURRENTLY has content OR has EVER had content (sticky)
      let hasContent = false;
      let wasShownOnce = shownOnce.has(card);
      
      switch (card) {
        case 'history':
          hasContent = contentState.hasHistory;
          break;
        case 'search':
          hasContent = contentState.hasSearch;
          break;
        case 'scripture':
          hasContent = contentState.hasScripture;
          break;
        case 'resources':
          hasContent = contentState.hasResources;
          break;
        case 'notes':
          hasContent = contentState.hasNotes;
          break;
      }

      // Keep card visible if it has content OR was shown before (keeps stale content)
      if (hasContent || wasShownOnce) {
        contentCards.push(card);
      }
    }

    return contentCards;
  }, [contentState, dismissPrefs.dismissed, shownOnce]);

  // Dismiss a card - also remove from shownOnce
  const dismissCard = useCallback((card: CardType, neverAskAgain: boolean = false) => {
    setDismissPrefs(prev => ({
      dismissed: prev.dismissed.includes(card) ? prev.dismissed : [...prev.dismissed, card],
      neverAskAgain: neverAskAgain && !prev.neverAskAgain.includes(card) 
        ? [...prev.neverAskAgain, card] 
        : prev.neverAskAgain,
    }));
    // Also remove from shownOnce so it won't reappear until it has content again
    setShownOnce(prev => {
      const next = new Set(prev);
      next.delete(card);
      return next;
    });
  }, []);

  // Restore a dismissed card
  const restoreCard = useCallback((card: CardType) => {
    setDismissPrefs(prev => ({
      dismissed: prev.dismissed.filter(c => c !== card),
      neverAskAgain: prev.neverAskAgain,
    }));
  }, []);

  // Check if should show confirmation for dismiss
  const shouldConfirmDismiss = useCallback((card: CardType) => {
    return !dismissPrefs.neverAskAgain.includes(card);
  }, [dismissPrefs.neverAskAgain]);

  // Check if card is visible
  const isCardVisible = useCallback((card: CardType) => {
    return visibleCards.includes(card);
  }, [visibleCards]);

  // Get hidden cards that could be restored
  const hiddenCards = useMemo(() => {
    return dismissPrefs.dismissed.filter(card => {
      switch (card) {
        case 'history': return contentState.hasHistory;
        case 'search': return contentState.hasSearch;
        case 'scripture': return contentState.hasScripture;
        case 'resources': return contentState.hasResources;
        case 'notes': return contentState.hasNotes;
        default: return false;
      }
    });
  }, [dismissPrefs.dismissed, contentState]);

  // Clear stale state (for reset)
  const clearShownOnce = useCallback(() => {
    setShownOnce(new Set());
    localStorage.removeItem(CARD_SHOWN_ONCE_KEY);
  }, []);

  return {
    visibleCards,
    hiddenCards,
    dismissCard,
    restoreCard,
    shouldConfirmDismiss,
    isCardVisible,
    clearShownOnce,
  };
}
