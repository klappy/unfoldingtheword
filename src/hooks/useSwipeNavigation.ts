import { useState, useCallback, useRef, useEffect } from 'react';
import { CardType } from '@/types';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;
const SWIPE_UP_THRESHOLD = 80;
const LONG_PRESS_DURATION = 300; // ms required to hold before swipe-up dismiss activates

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
  const longPressActivated = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    longPressActivated.current = false;
    setIsDragging(true);
    setDragOffset(0);
    setDragOffsetY(0);
    
    // Start long-press timer for dismiss activation
    longPressTimer.current = setTimeout(() => {
      longPressActivated.current = true;
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!draggingRef.current) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaY = point.clientY - startPos.current.y;
    
    // Cancel long-press timer if user moves significantly before it activates
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    
    // Determine swipe direction on first significant movement
    if (!isVerticalSwipe.current && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      isVerticalSwipe.current = true;
    }
    
    if (isVerticalSwipe.current && longPressActivated.current) {
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
    
    // Clear long-press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    const deltaX = point.clientX - startPos.current.x;
    const deltaY = point.clientY - startPos.current.y;
    const deltaTime = Date.now() - startTime.current;

    // Check for swipe up to dismiss - only if long-press was activated
    if (isVerticalSwipe.current && longPressActivated.current && deltaY < -SWIPE_UP_THRESHOLD) {
      options?.onSwipeUp?.(currentCard);
      setDragOffsetY(0);
      longPressActivated.current = false;
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
