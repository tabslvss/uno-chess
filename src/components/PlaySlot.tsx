import { motion, AnimatePresence } from 'framer-motion';
import { UnoCardView } from './UnoCardView';
import type { UnoCard } from '../game/types';
import './PlaySlot.css';

interface PlaySlotProps {
  card: UnoCard | null;
}

export function PlaySlot({ card }: PlaySlotProps) {
  return (
    <div className="play-slot-single">
      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key={card.id}
            className="play-slot-card"
            // Card flies from the bottom hand and grows to flank size
            initial={{ scale: 0.45, opacity: 0, y: 280, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 3 }}
            exit={{ scale: 0.5, opacity: 0, y: 30, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <UnoCardView card={card} large />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="play-slot-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
