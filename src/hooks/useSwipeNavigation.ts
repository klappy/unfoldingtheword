import { useState, useCallback, useRef } from 'react';
import { CardType } from '@/types';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;

const CARD_ORDER: CardType[] = ['chat', 'scripture', 'resources', 'notes'];

export function useSwipeNavigation() {
  const [currentCard, setCurrentCard] = useState<CardType>('chat');
  const [showHistory, setShowHistory] = useState(false);
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
    const deltaY = point.clientY - startPos.current.y;
    const deltaTime = Date.now() - startTime.current;
    
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal && (Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD)) {
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
      setShowHistory(false);
    } else if (!isHorizontal && (Math.abs(deltaY) > SWIPE_THRESHOLD || velocityY > VELOCITY_THRESHOLD)) {
      // Vertical swipe
      if (deltaY < 0) {
        // Swipe up - show chat input focus
        setShowChat(true);
        setShowHistory(false);
      } else {
        // Swipe down - show history
        setShowHistory(true);
      }
    }
  }, [currentCard]);

  const navigateToCard = useCallback((card: CardType) => {
    setCurrentCard(card);
    setShowHistory(false);
  }, []);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  const currentIndex = CARD_ORDER.indexOf(currentCard);

  return {
    currentCard,
    currentIndex,
    showHistory,
    showChat,
    handleTouchStart,
    handleTouchEnd,
    navigateToCard,
    closeHistory,
    cardOrder: CARD_ORDER,
  };
}
