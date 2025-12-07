import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType } from '@/types';

interface SwipeContainerProps {
  children: ReactNode;
  currentCard: CardType;
  cardOrder: CardType[];
  onTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
  onTouchEnd: (e: React.TouchEvent | React.MouseEvent) => void;
}

export function SwipeContainer({
  children,
  currentCard,
  cardOrder,
  onTouchStart,
  onTouchEnd,
}: SwipeContainerProps) {
  const currentIndex = cardOrder.indexOf(currentCard);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onTouchStart}
      onMouseUp={onTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.32, 0.72, 0, 1] 
          }}
          className="absolute inset-0"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Page indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50">
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
