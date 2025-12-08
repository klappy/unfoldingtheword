import { useState, useCallback, useRef } from 'react';
import { CardType } from '@/types';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;

// History is now the first card, to the left of chat
const CARD_ORDER: CardType[] = ['history', 'chat', 'scripture', 'resources', 'notes'];

export function useSwipeNavigation() {
  const [currentCard, setCurrentCard] = useState<CardType>('chat');
  const [showChat, setShowChat] = useState(true);
  
  const startPos = useRef({ x: 0, y: 0 });
  const startTime = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    startTime.current = Date.now();
    isDragging.current = true;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaTime = Date.now() - startTime.current;
    
    const velocityX = Math.abs(deltaX) / deltaTime;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
      // Horizontal swipe - navigate cards
      const currentIndex = CARD_ORDER.indexOf(currentCard);
      if (deltaX < 0) {
        // Swipe left - next card
        const nextIndex = (currentIndex + 1) % CARD_ORDER.length;
        setCurrentCard(CARD_ORDER[nextIndex]);
      } else {
        // Swipe right - previous card
        const prevIndex = (currentIndex - 1 + CARD_ORDER.length) % CARD_ORDER.length;
        setCurrentCard(CARD_ORDER[prevIndex]);
      }
    }
  }, [currentCard]);

  const navigateToCard = useCallback((card: CardType) => {
    setCurrentCard(card);
  }, []);

  const currentIndex = CARD_ORDER.indexOf(currentCard);

  return {
    currentCard,
    currentIndex,
    showChat,
    handleTouchStart,
    handleTouchEnd,
    navigateToCard,
    cardOrder: CARD_ORDER,
  };
}
