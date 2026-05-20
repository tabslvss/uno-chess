import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player, UnoCard } from '../game/types';
import { UnoCardView } from './UnoCardView';
import { CardBack } from './CardBack';

interface HandProps {
  state: GameState;
  player: Player;
  isActive: boolean;
  canControl: boolean;
  hidden: boolean;
  onPlay: (id: string) => void;
  compact?: boolean;
  /** After Reverse: only this drawn card may be played */
  mustPlayCardId?: string | null;
}

export function Hand({
  state,
  player,
  isActive,
  canControl,
  hidden,
  onPlay,
  compact = false,
  mustPlayCardId = null,
}: HandProps) {
  const hand = state.hands[player];
  const reverseBonus = Boolean(mustPlayCardId);
  const canPlay =
    isActive &&
    canControl &&
    state.phase === 'playCard' &&
    (!mustPlayCardId || hand.some((c) => c.id === mustPlayCardId));

  return (
    <motion.div
      className={`panel hand-panel${compact ? ' hand-compact' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className={`player-label ${isActive ? 'active' : ''}`}>
        {player === 'white' ? 'White' : 'Black'}
        {hidden ? ' (hidden)' : ''}
        {isActive
          ? reverseBonus
            ? ' — play the card you drew'
            : ' — play a card'
          : ''}
        <span className="hand-count"> · {hand.length} cards</span>
      </p>
      <motion.div className="hand">
        <AnimatePresence mode="popLayout">
          {hidden
            ? hand.map((_, i) => (
                <motion.div key={`back-${player}-${i}`} layout exit={{ opacity: 0, scale: 0.5 }}>
                  <CardBack index={i} />
                </motion.div>
              ))
            : hand.map((card: UnoCard) => {
                const justDrawn = state.lastEvent?.type === 'draw' && state.lastEvent.cardId === card.id;
                const justPlayed = state.lastEvent?.type === 'play' && state.lastEvent.cardId === card.id;
                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={
                      justDrawn
                        ? { opacity: 0, scale: 0.2, x: 80, y: -60 }
                        : { opacity: 0, scale: 0.85 }
                    }
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.4, x: 0, y: -30 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  >
                    <UnoCardView
                      card={card}
                      disabled={!canPlay || (mustPlayCardId != null && card.id !== mustPlayCardId)}
                      selected={justPlayed || card.id === mustPlayCardId}
                      onClick={() =>
                        canPlay &&
                        (mustPlayCardId == null || card.id === mustPlayCardId) &&
                        onPlay(card.id)
                      }
                    />
                  </motion.div>
                );
              })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
