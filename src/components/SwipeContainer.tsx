import { ReactNode, useRef, useEffect } from 'react';
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
  const prevIndexRef = useRef(currentIndex);
  const direction = useRef(1); // 1 = going right (next), -1 = going left (prev)

  useEffect(() => {
    // Determine direction based on index change
    if (currentIndex !== prevIndexRef.current) {
      direction.current = currentIndex > prevIndexRef.current ? 1 : -1;
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onTouchStart}
      onMouseUp={onTouchEnd}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, x: direction.current * 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction.current * -50 }}
          transition={{ 
            duration: 0.25, 
            ease: [0.32, 0.72, 0, 1] 
          }}
          className="absolute inset-0"
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
