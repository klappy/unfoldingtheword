import { ReactNode } from 'react';
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

  // Calculate positions based on drag
  const getCardStyle = (position: 'prev' | 'current' | 'next') => {
    const baseOffset = position === 'prev' ? -100 : position === 'next' ? 100 : 0;
    const dragPercent = (dragOffset / window.innerWidth) * 100;
    
    return {
      x: `calc(${baseOffset}% + ${dragOffset}px)`,
      opacity: position === 'current' ? 1 : isDragging ? 0.9 : 0,
      scale: position === 'current' ? (isDragging ? 1 - Math.abs(dragOffset) * 0.0001 : 1) : 0.95,
    };
  };

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
      {/* Previous card (left) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={getCardStyle('prev')}
        transition={isDragging ? { duration: 0 } : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ willChange: 'transform' }}
      >
        {renderCard(prevCard)}
      </motion.div>

      {/* Current card (center) */}
      <motion.div
        key={currentCard}
        className="absolute inset-0"
        initial={{ x: swipeDirection * 100 + '%', opacity: 0 }}
        animate={getCardStyle('current')}
        transition={isDragging ? { duration: 0 } : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ willChange: 'transform' }}
      >
        {renderCard(currentCard)}
      </motion.div>

      {/* Next card (right) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={getCardStyle('next')}
        transition={isDragging ? { duration: 0 } : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ willChange: 'transform' }}
      >
        {renderCard(nextCard)}
      </motion.div>

      {/* Page indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50 pb-safe">
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
