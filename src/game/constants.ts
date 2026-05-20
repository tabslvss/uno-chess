import type { CardLetter, Color, Piece, Player } from './types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const HAND_SIZE = 7;
export const IDLE_DRAW_LIMIT = 6;
export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

export const LETTER_INDEX: Record<CardLetter, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
};

export function squareKey(s: { file: number; rank: number }): string {
  return `${s.file},${s.rank}`;
}

export function cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

export const INITIAL_CASTLING = {
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
};

export function createInitialBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null),
  );
  const back = (player: Player, rank: number) => {
    const order: Piece['type'][] = [
      'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook',
    ];
    order.forEach((type, file) => {
      board[rank][file] = { type, player };
    });
    const pawnRank = player === 'white' ? rank - 1 : rank + 1;
    for (let f = 0; f < 8; f++) board[pawnRank][f] = { type: 'pawn', player };
  };
  back('black', 0);
  back('white', 7);
  return board;
}

export function randomPlayer(): Player {
  return Math.random() < 0.5 ? 'white' : 'black';
}
