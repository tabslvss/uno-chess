import { motion } from 'framer-motion';
import type { GameState } from '../game/types';

interface DrawPileProps {
  state: GameState;
}

export function DrawPile({ state }: DrawPileProps) {
  const drawing = state.lastEvent?.type === 'draw';

  return (
    <motion.div
      className="draw-pile-widget"
      animate={drawing ? { scale: [1, 1.07, 1] } : {}}
      transition={{ duration: 0.4 }}
    >
      <p className="draw-hint">Draw Pile</p>
      <div className="draw-stack">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="draw-card-layer"
            style={{ top: i * 3, left: i * 2 }}
          />
        ))}
        <div className="draw-count">∞</div>
      </div>
    </motion.div>
  );
}
