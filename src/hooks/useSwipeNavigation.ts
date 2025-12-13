import { useState, useCallback, useRef, useEffect } from 'react';
import { CardType } from '@/types';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;
const SWIPE_UP_THRESHOLD = 80;

interface UseSwipeNavigationOptions {
  visibleCards: CardType[];
  onSwipeUp?: (card: CardType) => void;
}

export function useSwipeNavigation(options?: UseSwipeNavigationOptions) {
  // Default to full card order if no options provided (backward compatibility)
  const visibleCards = options?.visibleCards || ['history', 'chat', 'scripture', 'resources', 'notes'];
  
  const [currentCard, setCurrentCard] = useState<CardType>(() => {
    // Start on chat if available, otherwise first visible card
    return visibleCards.includes('chat') ? 'chat' : visibleCards[0];
  });
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const startPos = useRef({ x: 0, y: 0 });
  const startTime = useRef(0);
  const draggingRef = useRef(false);
  const isVerticalSwipe = useRef(false);

  // If current card is no longer visible, navigate to chat or nearest visible card
  useEffect(() => {
    if (!visibleCards.includes(currentCard)) {
      const fallback = visibleCards.includes('chat') ? 'chat' : visibleCards[0];
      if (fallback) {
        setCurrentCard(fallback);
      }
    }
  }, [visibleCards, currentCard]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    startTime.current = Date.now();
    draggingRef.current = true;
    isVerticalSwipe.current = false;
    setIsDragging(true);
    setDragOffset(0);
    setDragOffsetY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!draggingRef.current) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaY = point.clientY - startPos.current.y;
    
    // Determine swipe direction on first significant movement
    if (!isVerticalSwipe.current && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      isVerticalSwipe.current = true;
    }
    
    if (isVerticalSwipe.current) {
      // Only track upward swipes for dismissal
      if (deltaY < 0) {
        setDragOffsetY(deltaY);
      }
    } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);

    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaY = point.clientY - startPos.current.y;
    const deltaTime = Date.now() - startTime.current;

    // Check for swipe up to dismiss
    if (isVerticalSwipe.current && deltaY < -SWIPE_UP_THRESHOLD) {
      options?.onSwipeUp?.(currentCard);
      setDragOffsetY(0);
      return;
    }
    
    const velocityX = Math.abs(deltaX) / deltaTime;
    const shouldNavigate = Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD;

    if (shouldNavigate && !isVerticalSwipe.current && Math.abs(deltaX) > Math.abs(deltaY)) {
      const currentIndex = visibleCards.indexOf(currentCard);
      
      if (deltaX < 0) {
        // Swipe left - next card
        setSwipeDirection(1);
        const nextIndex = (currentIndex + 1) % visibleCards.length;
        setCurrentCard(visibleCards[nextIndex]);
      } else {
        // Swipe right - previous card
        setSwipeDirection(-1);
        const prevIndex = (currentIndex - 1 + visibleCards.length) % visibleCards.length;
        setCurrentCard(visibleCards[prevIndex]);
      }
    }
    
    setDragOffset(0);
    setDragOffsetY(0);
    isVerticalSwipe.current = false;
  }, [currentCard, visibleCards, options]);

  const navigateToCard = useCallback((card: CardType) => {
    if (!visibleCards.includes(card)) {
      // Navigate to chat if target card isn't visible
      if (visibleCards.includes('chat')) {
        card = 'chat';
      } else {
        return;
      }
    }
    
    const currentIndex = visibleCards.indexOf(currentCard);
    const targetIndex = visibleCards.indexOf(card);
    setSwipeDirection(targetIndex > currentIndex ? 1 : -1);
    setCurrentCard(card);
  }, [currentCard, visibleCards]);

  const currentIndex = visibleCards.indexOf(currentCard);

  return {
    currentCard,
    currentIndex,
    swipeDirection,
    dragOffset,
    dragOffsetY,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    navigateToCard,
    cardOrder: visibleCards,
  };
}
