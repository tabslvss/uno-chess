import { AnimatePresence, motion } from 'motion/react';
import { cardName } from '@/game/cards';
import type { Card, Color, Side } from '@/game/types';
import { cn } from '@/lib/cn';
import { COLOR_HEX } from './cardArt';
import { GameCard } from './GameCard';

interface PilesProps {
  discard: Card[];
  deckCount: number;
  activeColor: Color | null;
  /** Who played the top card (for the fly-in direction). */
  lastBy?: Side | null;
  bottomSide: Side;
  cardWidth: string;
  vertical?: boolean;
  className?: string;
}

function tilt(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h % 13) - 6) * 1.2;
}

/** Draw pile and discard pile with the colour to match. */
export function Piles({ discard, deckCount, activeColor, lastBy, bottomSide, cardWidth, vertical, className }: PilesProps) {
  const top = discard[discard.length - 1] ?? null;
  const under = discard.slice(-4, -1);
  const fromBelow = lastBy ? lastBy === bottomSide : true;
  const deckLayers = Math.min(4, Math.ceil(deckCount / 12));
  return (
    <div
      className={cn('flex items-center justify-center gap-4', vertical ? 'flex-col' : 'flex-row', className)}
      style={{ ['--pw' as string]: cardWidth }}
    >
      {/* Draw pile */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative" style={{ width: 'var(--pw)', aspectRatio: '2139/3308' }}>
          {Array.from({ length: Math.max(1, deckLayers) }).map((_, i) => (
            <div key={i} className="absolute inset-0" style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}>
              <GameCard card={null} faceDown width="var(--pw)" />
            </div>
          ))}
        </div>
        <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-ink-faint">Deck · {deckCount}</span>
      </div>

      {/* Discard pile */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative" style={{ width: 'var(--pw)', aspectRatio: '2139/3308' }} data-testid="discard-top" aria-label={top ? `Top card: ${cardName(top)}` : 'Empty pile'}>
          {under.map((c) => (
            <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${tilt(c.id)}deg)` }}>
              <GameCard card={c} width="var(--pw)" />
            </div>
          ))}
          <AnimatePresence initial={false}>
            {top && (
              <motion.div
                key={top.id}
                className="absolute inset-0"
                initial={{ opacity: 0, y: fromBelow ? 120 : -120, rotate: fromBelow ? -20 : 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, rotate: tilt(top.id), scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <GameCard card={top} width="var(--pw)" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ActiveColor color={activeColor} />
      </div>
    </div>
  );
}

export function ActiveColor({ color }: { color: Color | null }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-wider text-ink-faint" data-testid="active-color">
      <motion.span
        key={color ?? 'any'}
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        className="inline-block h-3 w-3 rounded-full ring-2 ring-surface"
        style={{ background: color ? COLOR_HEX[color] : 'conic-gradient(#d64534 0 25%, #e9b824 0 50%, #2fa660 0 75%, #2f6fd6 0)' }}
      />
      {color ?? 'any colour'}
    </span>
  );
}
