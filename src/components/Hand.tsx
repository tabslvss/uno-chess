import { motion, AnimatePresence } from 'framer-motion';
import { cardCanBePlayed, cardRejectReason } from '../game/engine';
import type { GameState, Player, UnoCard } from '../game/types';
import { useGameStore } from '../store/gameStore';
import { UnoCardView } from './UnoCardView';
import { CardBack } from './CardBack';

interface HandProps {
  state: GameState;
  player: Player;
  isActive: boolean;
  canControl: boolean;
  hidden: boolean;
  onPlay: (id: string) => void;
  /** Swap mode when every card is stuck — not the same as playing a card */
  onDiscard?: (id: string) => void;
  compact?: boolean;
  horizontal?: boolean;
}

export function Hand({
  state,
  player,
  isActive,
  canControl,
  hidden,
  onPlay,
  onDiscard,
  compact = false,
  horizontal = false,
}: HandProps) {
  const pushToast = useGameStore((s) => s.pushToast);
  const hand = state.hands[player];
  const swapMode = Boolean(onDiscard);
  const canPlay = isActive && canControl && state.phase === 'playCard';

  return (
    <motion.div
      className={[
        'panel',
        'hand-panel',
        compact ? 'hand-compact' : '',
        horizontal ? 'hand-panel-horizontal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      initial={{ opacity: 0, y: horizontal ? 16 : 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!horizontal && (
        <p className={`player-label ${isActive ? 'active' : ''}`}>
          {player === 'white' ? 'White' : 'Black'}
          {hidden ? ' (hidden)' : ''}
          {isActive ? ' — play a card' : ''}
          <span className="hand-count"> · {hand.length} cards</span>
        </p>
      )}
      <motion.div className={`hand${horizontal ? ' hand-horizontal' : ''}`}>
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
                const playable = cardCanBePlayed(state, card);
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
                      disabled={!canPlay}
                      dimmed={!swapMode && canPlay && !playable}
                      swapMode={swapMode && canPlay}
                      selected={justPlayed}
                      onClick={() => {
                        if (!canPlay) return;
                        if (swapMode) {
                          onDiscard?.(card.id);
                          return;
                        }
                        if (!playable) {
                          pushToast(cardRejectReason(state, card), 'warn');
                          return;
                        }
                        onPlay(card.id);
                      }}
                    />
                  </motion.div>
                );
              })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
