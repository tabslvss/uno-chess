import { motion, AnimatePresence } from 'framer-motion';
import { UnoCardView } from './UnoCardView';
import type { UnoCard } from '../game/types';

interface PlaySlotProps {
  card: UnoCard | null;
}

export function PlaySlot({ card }: PlaySlotProps) {
  return (
    <div className="play-slot-widget">
      <p className="draw-hint">Last Played</p>
      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key={card.id}
            initial={{ scale: 0.35, opacity: 0, y: -30, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          >
            <UnoCardView card={card} />
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            className="play-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
          >
            —
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
