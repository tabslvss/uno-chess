import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Tip } from '@/components/ui';
import type { Card } from '@/game/types';
import { cn } from '@/lib/cn';
import { GameCard } from './GameCard';

export type HandMode = 'idle' | 'play' | 'discard' | 'select';

interface HandProps {
  cards: Card[];
  mode: HandMode;
  /** Reason a card can't be played ('' = playable). Only used in `play` mode. */
  blockReason?: (card: Card) => string;
  selected?: string[];
  onCardClick?: (card: Card) => void;
  onHover?: (card: Card | null) => void;
  cardWidth?: string;
  className?: string;
}

/** The player's hand: fans out and overlaps automatically to always fit on screen. */
export function Hand({ cards, mode, blockReason, selected = [], onCardClick, onHover, cardWidth, className }: HandProps) {
  const n = cards.length;
  const style = { '--n': n, '--card-w': cardWidth } as CSSProperties;
  return (
    <div className={cn('hand-row px-2', className)} style={style} data-testid="hand">
      <AnimatePresence initial={false} mode="popLayout">
        {cards.map((card, i) => {
          const reason = mode === 'play' ? (blockReason?.(card) ?? '') : '';
          const playable = mode === 'play' && !reason;
          const interactive = mode !== 'idle';
          // Gentle arc for a "held in hand" feel.
          const mid = (n - 1) / 2;
          const rot = n > 1 ? (i - mid) * Math.min(3, 16 / n) : 0;
          const lift = Math.abs(i - mid) * Math.min(4, 22 / n);
          return (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 60, scale: 0.8 }}
              animate={{ opacity: 1, y: lift, scale: 1, rotate: rot }}
              exit={{ opacity: 0, y: -80, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="relative shrink-0"
              style={{ zIndex: i }}
            >
              <Tip content={mode === 'play' && reason ? reason : null}>
                <span className="block">
                  <GameCard
                    card={card}
                    width="var(--w)"
                    interactive={interactive}
                    playable={playable}
                    dimmed={mode === 'play' && !playable}
                    selected={selected.includes(card.id)}
                    discardMode={mode === 'discard' || mode === 'select'}
                    onClick={() => onCardClick?.(card)}
                    onHover={(h) => onHover?.(h ? card : null)}
                  />
                </span>
              </Tip>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Small fanned stack of face-down cards for the opponent. */
export function OpponentHand({ count, className }: { count: number; className?: string }) {
  const shown = Math.min(count, 10);
  return (
    <div className={cn('flex items-center', className)} aria-label={`${count} cards`}>
      <div className="relative flex">
        {Array.from({ length: shown }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, rotate: (i - (shown - 1) / 2) * 4 }}
            className={cn(i > 0 && '-ml-[18px]')}
          >
            <GameCard card={null} faceDown width={28} />
          </motion.div>
        ))}
      </div>
      <span className="ml-2 chip bg-surface-2 text-ink-soft">{count}</span>
    </div>
  );
}
