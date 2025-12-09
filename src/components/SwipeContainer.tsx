import { ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CardType } from '@/types';

interface SwipeContainerProps {
  currentCard: CardType;
  cardOrder: CardType[];
  swipeDirection: 1 | -1;
  dragOffset: number;
  isDragging: boolean;
  onTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
  onTouchMove: (e: React.TouchEvent | React.MouseEvent) => void;
  onTouchEnd: (e: React.TouchEvent | React.MouseEvent) => void;
  renderCard: (card: CardType) => ReactNode;
}

export function SwipeContainer({
  currentCard,
  cardOrder,
  swipeDirection,
  dragOffset,
  isDragging,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  renderCard,
}: SwipeContainerProps) {
  const currentIndex = cardOrder.indexOf(currentCard);
  const prevIndex = (currentIndex - 1 + cardOrder.length) % cardOrder.length;
  const nextIndex = (currentIndex + 1) % cardOrder.length;
  
  const prevCard = cardOrder[prevIndex];
  const nextCard = cardOrder[nextIndex];

  // Memoize rendered cards to prevent unnecessary re-renders
  const prevCardContent = useMemo(() => renderCard(prevCard), [renderCard, prevCard]);
  const currentCardContent = useMemo(() => renderCard(currentCard), [renderCard, currentCard]);
  const nextCardContent = useMemo(() => renderCard(nextCard), [renderCard, nextCard]);

  // Calculate the peek visibility based on drag offset
  const peekOpacity = Math.min(Math.abs(dragOffset) / 100, 0.95);

  return (
    <div
      className="relative w-full h-full overflow-hidden touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onTouchStart}
      onMouseMove={onTouchMove}
      onMouseUp={onTouchEnd}
      onMouseLeave={onTouchEnd}
    >
      {/* Previous card (left) - only visible when dragging right */}
      {isDragging && dragOffset > 0 && (
        <motion.div
          className="absolute inset-0"
          style={{ 
            x: `calc(-100% + ${dragOffset}px)`,
            opacity: peekOpacity,
          }}
        >
          {prevCardContent}
        </motion.div>
      )}

      {/* Current card (center) */}
      <motion.div
        key={currentCard}
        className="absolute inset-0"
        initial={{ x: swipeDirection * 100 + '%', opacity: 0 }}
        animate={{ 
          x: dragOffset,
          opacity: 1,
        }}
        transition={isDragging ? { duration: 0 } : { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ willChange: 'transform' }}
      >
        {currentCardContent}
      </motion.div>

      {/* Next card (right) - only visible when dragging left */}
      {isDragging && dragOffset < 0 && (
        <motion.div
          className="absolute inset-0"
          style={{ 
            x: `calc(100% + ${dragOffset}px)`,
            opacity: peekOpacity,
          }}
        >
          {nextCardContent}
        </motion.div>
      )}

      {/* Page indicators - positioned to not overlap with input */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-50 pointer-events-none">
        {cardOrder.map((card, index) => (
          <div
            key={card}
            className={`page-dot ${index === currentIndex ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
