import { Chess } from 'chess.js';
import type { GameState, PieceType, Player, Square } from './types';
import { FILES } from './constants';

const PIECE_TO_CHAR: Record<Player, Record<PieceType, string>> = {
  white: { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' },
  black: { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' },
};

/**
 * Internal board: rank 0 = black home (top), rank 7 = white home (bottom).
 * Chess notation: rank 1 = bottom, rank 8 = top — opposite of internal index.
 */
export function squareFromAlgebraic(sq: string): Square {
  const file = FILES.indexOf(sq[0] as (typeof FILES)[number]);
  const displayRank = parseInt(sq[1], 10);
  return { file, rank: 8 - displayRank };
}

export function squareToAlgebraic(sq: Square): string {
  return `${FILES[sq.file]}${8 - sq.rank}`;
}

/** Build FEN from internal board (for chess.js helpers). */
export function boardToFen(state: GameState): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        row += PIECE_TO_CHAR[p.player][p.type];
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  const placement = rows.join('/');
  const turn = state.currentPlayer === 'white' ? 'w' : 'b';
  const rights = castlingFen(state);
  const ep = state.enPassantTarget
    ? squareToAlgebraic(state.enPassantTarget)
    : '-';
  return `${placement} ${turn} ${rights} ${ep} 0 1`;
}

function castlingFen(state: GameState): string {
  let s = '';
  if (state.castlingRights.whiteKingside) s += 'K';
  if (state.castlingRights.whiteQueenside) s += 'Q';
  if (state.castlingRights.blackKingside) s += 'k';
  if (state.castlingRights.blackQueenside) s += 'q';
  return s || '-';
}

export function loadChess(state: GameState): Chess {
  return new Chess(boardToFen(state));
}
