import { motion } from 'framer-motion';
import type { Player } from '../game/types';

interface PlayerBarProps {
  player: Player;
  isYou: boolean;
  isActive: boolean;
  cardCount: number;
}

export function PlayerBar({ player, isYou, isActive, cardCount }: PlayerBarProps) {
  const label = player === 'white' ? 'White' : 'Black';
  const icon  = player === 'white' ? '♔' : '♚';

  return (
    <motion.div
      className={`player-bar${isActive ? ' player-bar-active' : ''}`}
      layout
    >
      <div className="player-bar-avatar" aria-hidden>
        {icon}
      </div>

      <div className="player-bar-info">
        <div className="player-bar-name">
          {label}
          {isYou && <span className="player-bar-tag">You</span>}
        </div>
        <div className="player-bar-meta">
          {cardCount} card{cardCount !== 1 ? 's' : ''}
        </div>
      </div>

      {isActive && (
        <motion.span
          className="player-bar-turn-badge"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          ● To move
        </motion.span>
      )}
    </motion.div>
  );
}
