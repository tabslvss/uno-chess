import { motion } from 'framer-motion';
import { FACEDOWN_SRC } from '../assets/cardAssets';
import type { GameState } from '../game/types';
import './DrawPile.css';

interface DrawPileProps {
  state: GameState;
}

export function DrawPile({ state }: DrawPileProps) {
  const drawing = state.lastEvent?.type === 'draw';

  return (
    <motion.div
      className="draw-pile-single"
      animate={drawing ? { scale: [1, 1.06, 1], rotate: [0, -2, 0] } : {}}
      transition={{ duration: 0.45 }}
    >
      <motion.img
        src={FACEDOWN_SRC}
        alt="Draw pile"
        className="card-surface card-surface--lg draw-card-img"
        draggable={false}
        whileHover={{ y: -6 }}
      />
    </motion.div>
  );
}
