import { useState, useCallback, useMemo, useEffect } from 'react';
import { CardType } from '@/types';

const CARD_DISMISS_PREFS_KEY = 'bible-study-card-dismiss-prefs';

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

// Cards that have content by default
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

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(CARD_DISMISS_PREFS_KEY, JSON.stringify(dismissPrefs));
  }, [dismissPrefs]);

  // Compute which cards are visible based on content and dismiss state
  const visibleCards = useMemo<CardType[]>(() => {
    const contentCards: CardType[] = [];

    // Check each card in order
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

      // Check if card has content
      let hasContent = false;
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

      if (hasContent) {
        contentCards.push(card);
      }
    }

    return contentCards;
  }, [contentState, dismissPrefs.dismissed]);

  // Dismiss a card
  const dismissCard = useCallback((card: CardType, neverAskAgain: boolean = false) => {
    setDismissPrefs(prev => ({
      dismissed: prev.dismissed.includes(card) ? prev.dismissed : [...prev.dismissed, card],
      neverAskAgain: neverAskAgain && !prev.neverAskAgain.includes(card) 
        ? [...prev.neverAskAgain, card] 
        : prev.neverAskAgain,
    }));
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
      // Only include cards that would have content
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

  return {
    visibleCards,
    hiddenCards,
    dismissCard,
    restoreCard,
    shouldConfirmDismiss,
    isCardVisible,
  };
}
