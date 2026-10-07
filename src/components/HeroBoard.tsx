import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { applyMove, boardToFen, INITIAL_CASTLING, initialBoard, parseSq, sqName } from '@/game/board';
import { cardLinesText } from '@/game/cards';
import type { Board, Card } from '@/game/types';
import { COLOR_HEX } from '@/game/ui/cardArt';
import { GameCard } from '@/game/ui/GameCard';
import { usePieceSet } from '@/game/ui/usePieceSet';

interface Step {
  card: Card;
  move?: [string, string];
  /** Reverse: undo the previous move. */
  reverse?: boolean;
}

const c = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });

/** A short scripted UNO Chess game that loops on the home page. */
const SCRIPT: Step[] = [
  { card: c('h1', 'number', 'red', 5), move: ['e2', 'e4'] }, // E: e-file
  { card: c('h2', 'number', 'red', 7), move: ['e7', 'e5'] }, // matches red; G: rank 7
  { card: c('h3', 'number', 'blue', 7), move: ['g1', 'f3'] }, // matches 7; g-file
  { card: c('h4', 'number', 'blue', 8), move: ['b8', 'c6'] }, // H: rank 8
  { card: c('h5', 'number', 'blue', 6), move: ['f1', 'c4'] }, // F: f-file
  { card: c('h6', 'number', 'blue', 7), move: ['g8', 'f6'] }, // G: g-file
  { card: c('h7', 'number', 'blue', 3), move: ['f3', 'e5'] }, // C: rank 3 — knight grabs a pawn
  { card: c('h8', 'reverse', 'blue'), reverse: true }, // …and Black reverses it
  { card: c('h9', 'wild', null), move: ['d2', 'd3'] }, // Wild (calls yellow): any piece
  { card: c('h10', 'number', 'yellow', 6), move: ['f8', 'c5'] }, // F: f-file
];

interface Frame {
  board: Board;
  card: Card;
  from: string | null;
  to: string | null;
  caption: string;
}

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const history: { board: Board; castling: typeof INITIAL_CASTLING }[] = [];
  let board = initialBoard();
  let castling = INITIAL_CASTLING;
  for (const step of SCRIPT) {
    if (step.reverse) {
      const prev = history.pop()!;
      const undone = frames[frames.length - 1]!;
      board = prev.board;
      castling = prev.castling;
      frames.push({ board, card: step.card, from: undone.to, to: undone.from, caption: 'Reverse — capture undone!' });
      continue;
    }
    const [f, t] = step.move!;
    history.push({ board, castling });
    const applied = applyMove(board, castling, null, { from: parseSq(f), to: parseSq(t) });
    board = applied.board;
    castling = applied.castling;
    const caption = step.card.kind === 'wild' ? 'Wild — any piece' : cardLinesText(step.card);
    frames.push({ board, card: step.card, from: f, to: t, caption });
  }
  return frames;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function HeroBoard({ size }: { size: string }) {
  const frames = useMemo(buildFrames, []);
  const pieces = usePieceSet();
  const [i, setI] = useState(-1);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setI(frames.length - 1);
      return;
    }
    const id = setInterval(() => setI((n) => (n + 1 >= frames.length + 2 ? -1 : n + 1)), 1700);
    return () => clearInterval(id);
  }, [frames.length]);

  const frame = i >= 0 ? frames[Math.min(i, frames.length - 1)]! : null;
  const fen = boardToFen(frame?.board ?? initialBoard());

  const squareStyles = useMemo(() => {
    const st: Record<string, CSSProperties> = {};
    if (!frame) return st;
    const line = frame.card.kind === 'number' ? frame.card.value! - 1 : null;
    if (line !== null && frame.card.color) {
      const tint = hexA(COLOR_HEX[frame.card.color]!, 0.22);
      for (let k = 0; k < 8; k++) {
        st[sqName(k * 8 + line)] = { backgroundImage: `linear-gradient(${tint}, ${tint})` };
        st[sqName(line * 8 + k)] = { backgroundImage: `linear-gradient(${tint}, ${tint})` };
      }
    }
    for (const sq of [frame.from, frame.to]) if (sq) st[sq] = { ...st[sq], boxShadow: 'inset 0 0 0 100vmax rgba(255, 255, 51, 0.45)' };
    return st;
  }, [frame]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="h-full w-full overflow-hidden rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
        <Chessboard
          options={{
            id: 'hero-board',
          pieces,
            position: fen,
            allowDragging: false,
            showNotation: false,
            animationDurationInMs: 650,
            squareStyles,
            darkSquareStyle: { backgroundColor: '#769656' },
            lightSquareStyle: { backgroundColor: '#eeeed2' },
          }}
        />
      </div>
      <div className="pointer-events-none absolute -bottom-6 -left-6 sm:-left-14 sm:bottom-10">
        <AnimatePresence mode="popLayout">
          {frame && (
            <motion.div
              key={frame.card.id}
              initial={{ opacity: 0, x: -40, y: 30, rotate: -25 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: -8 }}
              exit={{ opacity: 0, y: -20, rotate: 6 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-2"
            >
              <GameCard card={frame.card} width="clamp(64px, 9vw, 104px)" />
              <span className="rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-white">{frame.caption}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
