import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType } from '@/types';

interface SwipeContainerProps {
  children: ReactNode;
  currentCard: CardType;
  cardOrder: CardType[];
  swipeDirection: 1 | -1;
  dragOffset: number;
  isDragging: boolean;
  onTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
  onTouchMove: (e: React.TouchEvent | React.MouseEvent) => void;
  onTouchEnd: (e: React.TouchEvent | React.MouseEvent) => void;
}

export function SwipeContainer({
  children,
  currentCard,
  cardOrder,
  swipeDirection,
  dragOffset,
  isDragging,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: SwipeContainerProps) {
  const currentIndex = cardOrder.indexOf(currentCard);

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
      <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
        <motion.div
          key={currentCard}
          custom={swipeDirection}
          initial={{ opacity: 0, x: swipeDirection * 100 }}
          animate={{ 
            opacity: 1, 
            x: isDragging ? dragOffset : 0,
            scale: isDragging ? 1 - Math.abs(dragOffset) * 0.0002 : 1,
          }}
          exit={{ opacity: 0, x: swipeDirection * -100 }}
          transition={isDragging ? { duration: 0 } : { 
            duration: 0.25, 
            ease: [0.25, 0.1, 0.25, 1] 
          }}
          className="absolute inset-0"
          style={{ willChange: 'transform' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

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
