import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import { boardToFen, findKing, isAttacked, needsPromotion, other, parseSq, sideOf, sqName } from '@/game/board';
import { cardLine } from '@/game/cards';
import { movableSquares, targetsFrom } from '@/game/engine';
import type { Card, GameState, Move, PieceType, Side } from '@/game/types';
import { useSettings } from '@/stores/settings';
import { COLOR_HEX } from './cardArt';
import { usePieceSet } from './usePieceSet';

type Promo = Exclude<PieceType, 'P' | 'K'>;

interface BoardViewProps {
  state: GameState;
  orientation: Side;
  /** The local player may move pieces now. */
  interactive: boolean;
  /** Card being hovered in hand — previews which lines it unlocks. */
  previewCard?: Card | null;
  onMove: (move: Move) => void;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function BoardView({ state, orientation, interactive, previewCard, onMove }: BoardViewProps) {
  const settings = useSettings();
  const pieces = usePieceSet();
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);

  // Reset selection whenever the game advances.
  useEffect(() => {
    setSelected(null);
    setPromo(null);
  }, [state.seq]);

  const movable = useMemo(() => (interactive ? new Set(movableSquares(state)) : new Set<number>()), [state, interactive]);
  const targets = useMemo(
    () => (interactive && selected !== null ? targetsFrom(state, selected) : []),
    [state, interactive, selected],
  );

  const lineCard = state.phase === 'move' && state.played ? state.played : previewCard ?? null;

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const add = (sq: number, s: CSSProperties) => {
      const k = sqName(sq);
      styles[k] = { ...styles[k], ...s };
    };

    // Lines unlocked by the active / previewed card.
    if (settings.highlightLines && lineCard) {
      const line = cardLine(lineCard);
      const tint = hexA(COLOR_HEX[lineCard.color ?? (state.activeColor ?? 'yellow')] ?? '#e3b04b', 0.26);
      if (line !== null) {
        for (let i = 0; i < 8; i++) {
          add(i * 8 + line, { backgroundImage: `linear-gradient(${tint}, ${tint})` });
          add(line * 8 + i, { backgroundImage: `linear-gradient(${tint}, ${tint})` });
        }
      }
    }

    // Last move.
    const last = [...state.history].reverse().find((h) => h.kind === 'move' || h.kind === 'reverse' || h.kind === 'veto');
    if (last?.from !== undefined && last.to !== undefined) {
      for (const sq of [last.from, last.to]) add(sq, { boxShadow: 'inset 0 0 0 100vmax rgba(227, 176, 75, 0.42)' });
    }

    // Kings under attack (informational — there is no check rule).
    for (const side of ['w', 'b'] as Side[]) {
      const k = findKing(state.board, side);
      if (k >= 0 && isAttacked(state.board, k, other(side))) {
        add(k, { background: 'radial-gradient(circle, rgba(214,69,52,0.85) 0%, rgba(214,69,52,0.45) 45%, transparent 72%)' });
      }
    }
    if (state.pendingCapture) {
      add(state.pendingCapture.to, { background: 'radial-gradient(circle, rgba(214,69,52,0.95), rgba(214,69,52,0.5) 70%)' });
    }

    if (interactive) {
      for (const sq of movable) {
        if (sq !== selected) add(sq, { boxShadow: `inset 0 0 0 3px ${hexA('#e3b04b', 0.85)}` });
      }
      if (selected !== null) add(selected, { boxShadow: 'inset 0 0 0 100vmax rgba(217, 115, 78, 0.55)' });
      if (settings.showLegalMoves) {
        for (const sq of targets) {
          const occupied = state.board[sq] || state.ep === sq;
          add(sq, {
            backgroundImage: occupied
              ? 'radial-gradient(circle, transparent 56%, rgba(47, 38, 32, 0.38) 58%)'
              : 'radial-gradient(circle, rgba(47, 38, 32, 0.32) 20%, transparent 22%)',
            cursor: 'pointer',
          });
        }
      }
    }
    return styles;
  }, [state, interactive, movable, selected, targets, lineCard, settings.highlightLines, settings.showLegalMoves]);

  const tryMove = (from: number, to: number): boolean => {
    if (!targetsFrom(state, from).includes(to)) return false;
    if (needsPromotion(state.board, from, to)) {
      if (settings.autoQueen) onMove({ from, to, promotion: 'Q' });
      else setPromo({ from, to });
      setSelected(null);
      return !settings.autoQueen ? false : true;
    }
    onMove({ from, to });
    setSelected(null);
    return true;
  };

  const clickSquare = (name: string) => {
    if (!interactive) return;
    const sq = parseSq(name);
    if (sq < 0) return;
    if (selected !== null && targets.includes(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (movable.has(sq)) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  };

  const fen = useMemo(() => boardToFen(state.board), [state.board]);
  const promoSide = promo ? sideOf(state.board[promo.from]!) : 'w';

  return (
    <div className="relative h-full w-full" data-testid="board">
      <Chessboard
        options={{
          id: 'unochess-board',
          pieces,
          position: fen,
          boardOrientation: orientation === 'w' ? 'white' : 'black',
          squareStyles,
          showNotation: settings.coordinates,
          animationDurationInMs: settings.animations ? 220 : 0,
          showAnimations: settings.animations,
          allowDragging: interactive,
          canDragPiece: ({ square }) => interactive && square !== null && movable.has(parseSq(square)),
          onPieceDrag: ({ square }) => {
            if (square) setSelected(parseSq(square));
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || !interactive) return false;
            return tryMove(parseSq(sourceSquare), parseSq(targetSquare));
          },
          onSquareClick: ({ square }) => clickSquare(square),
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          boardStyle: {
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 2px 0 rgba(60,40,20,0.25), 0 18px 40px -16px rgba(60,40,20,0.55)',
          },
          darkSquareNotationStyle: { color: 'var(--board-light)', fontWeight: 800, fontFamily: 'var(--font-sans)' },
          lightSquareNotationStyle: { color: 'var(--board-dark)', fontWeight: 800, fontFamily: 'var(--font-sans)' },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 4px rgba(217,115,78,0.8)' },
          squareRenderer: ({ square, children }) => {
            const sq = parseSq(square);
            return (
              <div
                data-sq={square}
                data-movable={movable.has(sq) || undefined}
                data-target={targets.includes(sq) || undefined}
                data-selected={selected === sq || undefined}
                style={{ width: '100%', height: '100%', ...squareStyles[square] }}
              >
                {children}
              </div>
            );
          },
        }}
      />

      <AnimatePresence>
        {promo && (
          <motion.div
            className="absolute inset-0 z-10 grid place-items-center rounded-[10px] bg-[#2b1d14]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPromo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="card-surface p-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 font-display text-lg font-bold">Promote to…</p>
              <div className="flex gap-2">
                {(['Q', 'R', 'B', 'N'] as Promo[]).map((p) => {
                  const Piece = defaultPieces[`${promoSide}${p}`]!;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-label={{ Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }[p]}
                      className="grid h-16 w-16 place-items-center rounded-xl bg-surface-2 transition hover:-translate-y-1 hover:bg-mustard/30"
                      onClick={() => {
                        onMove({ from: promo.from, to: promo.to, promotion: p });
                        setPromo(null);
                      }}
                    >
                      <span className="h-12 w-12">
                        <Piece />
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
