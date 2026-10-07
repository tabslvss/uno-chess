import { Bot, Megaphone, Siren, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { Tip } from '@/components/ui';
import type { Side, UnoStatus } from '@/game/types';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { playSound } from '@/lib/sounds';
import type { ClockView, SeatInfo } from './controller';
import { OpponentHand } from './Hand';

export function useClockMs(clock: ClockView | null, side: Side): number | null {
  const [, force] = useState(0);
  const running = clock?.running === side;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [running]);
  if (!clock) return null;
  const base = clock[side];
  return running ? Math.max(0, base - (performance.now() - clock.at)) : base;
}

export function Clock({ clock, side, mine }: { clock: ClockView | null; side: Side; mine: boolean }) {
  const ms = useClockMs(clock, side);
  const running = clock?.running === side;
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!mine || !running || ms === null || ms > 10_000) return;
    const s = Math.ceil(ms / 1000);
    if (s !== lastTick.current) {
      lastTick.current = s;
      playSound('tick');
    }
  }, [ms, mine, running]);
  if (ms === null) return null;
  const low = ms < 20_000;
  return (
    <div
      data-testid={`clock-${side}`}
      className={cn(
        'min-w-[5.5rem] rounded-xl px-3 py-1.5 text-right font-mono text-lg font-bold tabular-nums transition sm:text-xl',
        running ? 'bg-ink text-bg shadow-[0_4px_14px_-6px_rgb(0_0_0/0.6)]' : 'bg-surface-2 text-ink-soft',
        running && low && 'bg-uno-red text-white animate-pulse',
      )}
      aria-label={`${side === 'w' ? 'White' : 'Black'} clock ${formatClock(ms)}`}
    >
      {formatClock(ms)}
    </div>
  );
}

interface PlayerStripProps {
  side: Side;
  seat: SeatInfo;
  active: boolean;
  clock: ClockView | null;
  mine: boolean;
  handCount?: number;
  uno: UnoStatus;
  /** Slot for catch / UNO buttons. */
  action?: ReactNode;
  thinking?: boolean;
  className?: string;
}

export function PlayerStrip({ side, seat, active, clock, mine, handCount, uno, action, thinking, className }: PlayerStripProps) {
  return (
    <div className={cn('flex items-center gap-2.5 sm:gap-3', className)} data-testid={`strip-${side}`}>
      <div className="relative">
        <Avatar
          seed={seat.seed}
          url={seat.avatarUrl}
          name={seat.name}
          size={40}
          ring={active ? 'var(--color-brand)' : undefined}
          className="sm:!h-11 sm:!w-11"
        />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-surface',
            side === 'w' ? 'bg-[#f7f1e6]' : 'bg-[#2b2420]',
          )}
          title={side === 'w' ? 'White' : 'Black'}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-extrabold">{seat.name}</span>
          {seat.isBot && <Bot size={15} className="shrink-0 text-ink-faint" aria-label="Bot" />}
          {seat.connected === false && (
            <Tip content="Disconnected — they have 60 seconds to come back">
              <WifiOff size={15} className="shrink-0 text-uno-red" />
            </Tip>
          )}
          {uno === 'called' && (
            <span className="chip bg-mustard text-[#3b2a10]">
              <Megaphone size={12} /> UNO!
            </span>
          )}
          {(uno === 'needed' || uno === 'forgot') && (
            <Tip content="Down to a lone king — must call UNO!">
              <span className="chip bg-uno-red/15 text-uno-red">
                <Siren size={12} /> lone king
              </span>
            </Tip>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-ink-soft">
          {seat.subtitle && <span>{seat.subtitle}</span>}
          {thinking && active && (
            <span className="flex items-center gap-1 text-brand">
              thinking
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1 w-1 rounded-full bg-current"
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </span>
            </span>
          )}
          {!thinking && active && !mine && <span className="text-brand">to move</span>}
        </div>
      </div>
      {action}
      {handCount !== undefined && <OpponentHand count={handCount} className="hidden sm:flex" />}
      <Clock clock={clock} side={side} mine={mine} />
    </div>
  );
}
