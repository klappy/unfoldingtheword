import { useState, useCallback, useRef } from 'react';
import { CardType } from '@/types';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;

const CARD_ORDER: CardType[] = ['history', 'chat', 'scripture', 'resources', 'notes'];

export function useSwipeNavigation() {
  const [currentCard, setCurrentCard] = useState<CardType>('chat');
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const startPos = useRef({ x: 0, y: 0 });
  const startTime = useRef(0);
  const draggingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    startTime.current = Date.now();
    draggingRef.current = true;
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!draggingRef.current) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaY = point.clientY - startPos.current.y;
    
    // Only track horizontal movement if it's more horizontal than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);

    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaTime = Date.now() - startTime.current;
    
    const velocityX = Math.abs(deltaX) / deltaTime;
    const shouldNavigate = Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD;

    if (shouldNavigate && Math.abs(deltaX) > Math.abs(point.clientY - startPos.current.y)) {
      const currentIndex = CARD_ORDER.indexOf(currentCard);
      
      if (deltaX < 0) {
        // Swipe left - next card
        setSwipeDirection(1);
        const nextIndex = (currentIndex + 1) % CARD_ORDER.length;
        setCurrentCard(CARD_ORDER[nextIndex]);
      } else {
        // Swipe right - previous card
        setSwipeDirection(-1);
        const prevIndex = (currentIndex - 1 + CARD_ORDER.length) % CARD_ORDER.length;
        setCurrentCard(CARD_ORDER[prevIndex]);
      }
    }
    
    setDragOffset(0);
  }, [currentCard]);

  const navigateToCard = useCallback((card: CardType) => {
    const currentIndex = CARD_ORDER.indexOf(currentCard);
    const targetIndex = CARD_ORDER.indexOf(card);
    setSwipeDirection(targetIndex > currentIndex ? 1 : -1);
    setCurrentCard(card);
  }, [currentCard]);

  const currentIndex = CARD_ORDER.indexOf(currentCard);

  return {
    currentCard,
    currentIndex,
    swipeDirection,
    dragOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    navigateToCard,
    cardOrder: CARD_ORDER,
  };
}
