import { motion } from 'framer-motion';
import type { Player } from '../game/types';

interface PlayerBarProps {
  player: Player;
  displayName: string;
  isYou: boolean;
  isActive: boolean;
  cardCount: number;
}

export function PlayerBar({ player, displayName, isYou, isActive, cardCount }: PlayerBarProps) {
  const colorLabel = player === 'white' ? 'White' : 'Black';
  const icon = player === 'white' ? '\u2654' : '\u265A';

  return (
    <motion.div
      className={`player-bar${isActive ? ' player-bar-active' : ''}${isYou ? ' player-bar-you' : ''}`}
      layout
    >
      <div className={`player-bar-avatar player-bar-avatar-${player}`} aria-hidden>
        {icon}
      </div>

      <div className="player-bar-info">
        <div className="player-bar-name">
          <span className="player-bar-display-name">{displayName}</span>
          {isYou && <span className="player-bar-tag">You</span>}
        </div>
        <div className="player-bar-meta">
          <span>{colorLabel}</span>
          <span className="player-bar-dot" aria-hidden>&middot;</span>
          <span>{cardCount} card{cardCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {isActive && (
        <motion.span
          className="player-bar-turn-badge"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          To move
        </motion.span>
      )}
    </motion.div>
  );
}
