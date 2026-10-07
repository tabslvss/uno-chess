import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { cardName } from '@/game/cards';
import type { Card } from '@/game/types';
import { cn } from '@/lib/cn';
import { cardArt, cardBackArt, isHidden } from './cardArt';

export const CARD_RATIO = 2139 / 3308;

interface GameCardProps {
  card: Card | null;
  /** Width in px or any CSS length. */
  width?: number | string;
  faceDown?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  discardMode?: boolean;
  interactive?: boolean;
  layoutId?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
  badge?: ReactNode;
  label?: string;
  tabIndex?: number;
}

export function GameCard({
  card,
  width = 84,
  faceDown,
  playable,
  dimmed,
  selected,
  discardMode,
  interactive,
  layoutId,
  className,
  style,
  onClick,
  onHover,
  badge,
  label,
  tabIndex,
}: GameCardProps) {
  const hidden = faceDown || !card || isHidden(card);
  const src = hidden ? cardBackArt() : cardArt(card!);
  const Comp = interactive ? motion.button : motion.div;
  return (
    <Comp
      layoutId={layoutId}
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      tabIndex={tabIndex}
      aria-label={label ?? (hidden ? 'Face-down card' : cardName(card!))}
      aria-pressed={interactive && selected !== undefined ? selected : undefined}
      whileHover={interactive ? { y: -14, scale: 1.04, rotate: 0 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
      animate={{ y: selected ? -18 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={cn(
        'relative block shrink-0 select-none rounded-[9%] outline-offset-4',
        interactive && 'cursor-pointer',
        dimmed && 'opacity-55 saturate-[.55]',
        className,
      )}
      style={{ width, aspectRatio: `${CARD_RATIO}`, ...style }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          'h-full w-full rounded-[9%] object-cover',
          'shadow-[0_1px_1px_rgb(0_0_0/0.15),0_6px_14px_-6px_rgb(40_20_10/0.55)]',
        )}
      />
      {playable && !dimmed && (
        <span className="pointer-events-none absolute -inset-[3px] rounded-[11%] ring-[3px] ring-mustard/90 shadow-[0_0_18px_rgb(227_176_75/0.55)]" />
      )}
      {selected && (
        <span className="pointer-events-none absolute -inset-[3px] rounded-[11%] ring-[3px] ring-terracotta shadow-[0_0_18px_rgb(217_115_78/0.6)]" />
      )}
      {discardMode && !selected && (
        <span className="pointer-events-none absolute -inset-[3px] rounded-[11%] border-2 border-dashed border-ink-soft/70" />
      )}
      {badge}
    </Comp>
  );
}
