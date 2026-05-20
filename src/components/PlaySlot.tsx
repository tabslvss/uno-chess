import { motion } from 'framer-motion';
import { UnoCardView } from './UnoCardView';
import type { UnoCard } from '../game/types';
import './PlaySlot.css';

interface PlaySlotProps {
  cards: UnoCard[];
}

function stackOffset(index: number, total: number) {
  const depth = total - 1 - index;
  const rot = ((index % 5) - 2) * 2.5;
  return {
    x: depth * 5,
    y: -depth * 4,
    rotate: rot,
    zIndex: index,
  };
}

export function PlaySlot({ cards }: PlaySlotProps) {
  if (cards.length === 0) {
    return (
      <motion.div
        className="play-slot-stack play-slot-stack--empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div className="play-slot-empty" />
      </motion.div>
    );
  }

  const topId = cards[cards.length - 1]!.id;

  return (
    <motion.div className="play-slot-stack" layout>
      {cards.map((card, index) => {
        const isTop = card.id === topId;
        const offset = stackOffset(index, cards.length);

        return (
          <motion.div
            key={card.id}
            className="play-slot-card"
            style={{ zIndex: offset.zIndex }}
            initial={
              isTop
                ? { scale: 0.45, opacity: 0, y: 280, rotate: -8, x: 0 }
                : false
            }
            animate={{
              scale: 1,
              opacity: 1,
              y: offset.y,
              x: offset.x,
              rotate: offset.rotate,
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <UnoCardView card={card} large />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
