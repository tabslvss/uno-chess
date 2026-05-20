import { useMemo, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { boardToFen, squareFromAlgebraic, squareToAlgebraic } from '../game/chessBridge';
import { UnoChess } from '../game/api';
import { squareKey } from '../game/constants';
import { findKing, isInCheck } from '../game/chess';
import type { GameState, Player, Square } from '../game/types';
import './Board.css';

interface BoardProps {
  state: GameState;
  orientation?: Player;
  canInteract: boolean;
  locked?: boolean;
  premove?: { from: Square; to: Square } | null;
  premoveDraft?: Square | null;
  onMove: (from: Square, to: Square) => void;
  onSquareClick: (sq: Square) => void;
}

export function Board({
  state,
  orientation = 'white',
  canInteract,
  locked = false,
  premove = null,
  premoveDraft = null,
  onMove,
  onSquareClick,
}: BoardProps) {
  const fen = useMemo(() => boardToFen(state), [state]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    const last = state.lastChessMove?.record;
    if (last) {
      const fromAlg = squareToAlgebraic(last.from);
      const toAlg = squareToAlgebraic(last.to);
      styles[fromAlg] = {
        background: 'rgba(155, 199, 0, 0.55)',
        boxShadow: 'inset 0 0 0 3px rgba(101, 134, 0, 0.9)',
      };
      styles[toAlg] = {
        background: 'rgba(155, 199, 0, 0.55)',
        boxShadow: 'inset 0 0 0 3px rgba(101, 134, 0, 0.9)',
      };
    }

    for (const player of ['white', 'black'] as const) {
      if (isInCheck(state.board, player)) {
        const king = findKing(state.board, player);
        if (king) {
          const alg = squareToAlgebraic(king);
          styles[alg] = {
            ...styles[alg],
            background: 'rgba(220, 50, 50, 0.45)',
            boxShadow: 'inset 0 0 0 3px rgba(180, 30, 30, 0.95)',
          };
        }
      }
    }

    if (premoveDraft) {
      const alg = squareToAlgebraic(premoveDraft);
      styles[alg] = {
        ...styles[alg],
        background: 'rgba(100, 149, 237, 0.45)',
        boxShadow: 'inset 0 0 0 3px #6495ed',
      };
    }

    if (state.pendingPromotion) {
      const toAlg = squareToAlgebraic(state.pendingPromotion.to);
      styles[toAlg] = {
        ...styles[toAlg],
        background: 'rgba(186, 104, 255, 0.45)',
        boxShadow: 'inset 0 0 0 3px #ba68ff',
      };
    }

    if (premove) {
      for (const sq of [premove.from, premove.to]) {
        const alg = squareToAlgebraic(sq);
        styles[alg] = {
          ...styles[alg],
          background: 'rgba(100, 149, 237, 0.38)',
          boxShadow: 'inset 0 0 0 3px #5a8fd4',
        };
      }
    }

    if (state.phase !== 'chess' || !state.activeCard) return styles;

    const movable = UnoChess.movableSquares(state);
    const targets = state.selectedSquare ? UnoChess.targetSquares(state) : [];

    for (const sq of movable) {
      const alg = squareToAlgebraic(sq);
      styles[alg] = {
        ...styles[alg],
        background: styles[alg]?.background ?? 'rgba(201, 162, 39, 0.42)',
      };
    }
    for (const sq of targets) {
      const alg = squareToAlgebraic(sq);
      styles[alg] = {
        background: 'rgba(198, 40, 40, 0.5)',
        boxShadow: 'inset 0 0 0 2px #c9a227',
      };
    }
    if (state.selectedSquare) {
      const alg = squareToAlgebraic(state.selectedSquare);
      styles[alg] = {
        ...styles[alg],
        boxShadow: 'inset 0 0 0 3px #c9a227',
      };
    }
    return styles;
  }, [state, premove, premoveDraft]);

  const canDrag = useCallback(
    ({ square }: { square: string | null }) => {
      if (!canInteract || !square || state.phase !== 'chess' || !state.activeCard) return false;
      const sq = squareFromAlgebraic(square);
      const movable = UnoChess.movableSquares(state);
      return movable.some((m) => squareKey(m) === squareKey(sq));
    },
    [canInteract, state],
  );

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare || !canInteract) return false;
      const from = squareFromAlgebraic(sourceSquare);
      const to = squareFromAlgebraic(targetSquare);
      const targets = state.selectedSquare
        ? UnoChess.targetSquares(state)
        : [];
      const sel = state.selectedSquare ?? from;
      if (!state.selectedSquare) {
        onSquareClick(from);
        const afterSel = { ...state, selectedSquare: from };
        const t = UnoChess.targetSquares(afterSel);
        if (t.some((x) => squareKey(x) === squareKey(to))) {
          onMove(from, to);
          return true;
        }
        return false;
      }
      if (targets.some((x) => squareKey(x) === squareKey(to))) {
        onMove(sel, to);
        return true;
      }
      return false;
    },
    [canInteract, state, onMove, onSquareClick],
  );

  return (
    <div className={`board-wrap chessboard-api${locked ? ' board-locked' : ''}`}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: canInteract && state.phase === 'chess',
          canDragPiece: ({ square }) => canDrag({ square }),
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            onPieceDrop({ sourceSquare, targetSquare: targetSquare ?? null }),
          onSquareClick: ({ square }) => {
            onSquareClick(squareFromAlgebraic(square));
          },
          squareStyles,
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          },
          animationDurationInMs: 280,
          showAnimations: true,
        }}
      />
    </div>
  );
}
