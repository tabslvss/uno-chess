import type { Board, CastlingRights, Move, MoveRecord, Piece, PieceType, Side } from './types';

export const FILES = 'abcdefgh';

export const sqFile = (sq: number) => sq % 8;
export const sqRank = (sq: number) => (sq / 8) | 0;
export const makeSq = (file: number, rank: number) => rank * 8 + file;
export const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

export function sqName(sq: number): string {
  return `${FILES[sqFile(sq)]}${sqRank(sq) + 1}`;
}

export function parseSq(name: string): number {
  const file = FILES.indexOf(name[0] ?? '');
  const rank = Number(name[1]) - 1;
  if (file < 0 || !(rank >= 0 && rank < 8) || name.length !== 2) return -1;
  return makeSq(file, rank);
}

export const sideOf = (p: Piece): Side => p[0] as Side;
export const typeOf = (p: Piece): PieceType => p[1] as PieceType;
export const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

export const INITIAL_CASTLING: CastlingRights = { wK: true, wQ: true, bK: true, bQ: true };

export function initialBoard(): Board {
  const b: Board = Array(64).fill(null);
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    b[makeSq(f, 0)] = `w${back[f]!}`;
    b[makeSq(f, 1)] = 'wP';
    b[makeSq(f, 6)] = 'bP';
    b[makeSq(f, 7)] = `b${back[f]!}`;
  }
  return b;
}

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
] as const;
const KING = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

function slide(board: Board, from: number, side: Side, dirs: readonly (readonly [number, number])[], out: number[]) {
  const f0 = sqFile(from);
  const r0 = sqRank(from);
  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    while (onBoard(f, r)) {
      const t = board[makeSq(f, r)];
      if (!t) out.push(makeSq(f, r));
      else {
        if (sideOf(t) !== side) out.push(makeSq(f, r));
        break;
      }
      f += df;
      r += dr;
    }
  }
}

function steps(board: Board, from: number, side: Side, deltas: readonly (readonly [number, number])[], out: number[]) {
  const f0 = sqFile(from);
  const r0 = sqRank(from);
  for (const [df, dr] of deltas) {
    const f = f0 + df;
    const r = r0 + dr;
    if (!onBoard(f, r)) continue;
    const t = board[makeSq(f, r)];
    if (!t || sideOf(t) !== side) out.push(makeSq(f, r));
  }
}

/** Rights to castle kingside/queenside for `side`, ignoring check (UNO Chess allows castling through check). */
function castleTargets(board: Board, from: number, side: Side, rights: CastlingRights, out: number[]) {
  const home = side === 'w' ? 0 : 7;
  if (from !== makeSq(4, home)) return;
  const rook: Piece = `${side}R`;
  const canK = side === 'w' ? rights.wK : rights.bK;
  const canQ = side === 'w' ? rights.wQ : rights.bQ;
  if (canK && board[makeSq(7, home)] === rook && !board[makeSq(5, home)] && !board[makeSq(6, home)]) {
    out.push(makeSq(6, home));
  }
  if (
    canQ &&
    board[makeSq(0, home)] === rook &&
    !board[makeSq(1, home)] &&
    !board[makeSq(2, home)] &&
    !board[makeSq(3, home)]
  ) {
    out.push(makeSq(2, home));
  }
}

/**
 * Pseudo-legal destinations for the piece on `from`.
 * UNO Chess has no check rule — kings may move into/through check and pieces are never pinned.
 */
export function pieceTargets(board: Board, from: number, castling: CastlingRights, ep: number | null): number[] {
  const p = board[from];
  if (!p) return [];
  const side = sideOf(p);
  const out: number[] = [];
  switch (typeOf(p)) {
    case 'N':
      steps(board, from, side, KNIGHT, out);
      break;
    case 'B':
      slide(board, from, side, BISHOP_DIRS, out);
      break;
    case 'R':
      slide(board, from, side, ROOK_DIRS, out);
      break;
    case 'Q':
      slide(board, from, side, ROOK_DIRS, out);
      slide(board, from, side, BISHOP_DIRS, out);
      break;
    case 'K':
      steps(board, from, side, KING, out);
      castleTargets(board, from, side, castling, out);
      break;
    case 'P': {
      const dir = side === 'w' ? 1 : -1;
      const f = sqFile(from);
      const r = sqRank(from);
      const start = side === 'w' ? 1 : 6;
      if (onBoard(f, r + dir) && !board[makeSq(f, r + dir)]) {
        out.push(makeSq(f, r + dir));
        if (r === start && !board[makeSq(f, r + 2 * dir)]) out.push(makeSq(f, r + 2 * dir));
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        const nr = r + dir;
        if (!onBoard(nf, nr)) continue;
        const sq = makeSq(nf, nr);
        const t = board[sq];
        if (t && sideOf(t) !== side) out.push(sq);
        else if (!t && ep === sq) out.push(sq);
      }
      break;
    }
  }
  return out;
}

/** Is `sq` attacked by any piece of `by`? (Used for the "+" annotation and the bot.) */
export function isAttacked(board: Board, sq: number, by: Side): boolean {
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || sideOf(p) !== by) continue;
    if (typeOf(p) === 'P') {
      const dir = by === 'w' ? 1 : -1;
      if (sqRank(sq) - sqRank(from) === dir && Math.abs(sqFile(sq) - sqFile(from)) === 1) return true;
      continue;
    }
    if (typeOf(p) === 'K') {
      if (Math.max(Math.abs(sqFile(sq) - sqFile(from)), Math.abs(sqRank(sq) - sqRank(from))) === 1) return true;
      continue;
    }
    if (pieceTargets(board, from, INITIAL_CASTLING_NONE, null).includes(sq)) return true;
  }
  return false;
}

const INITIAL_CASTLING_NONE: CastlingRights = { wK: false, wQ: false, bK: false, bQ: false };

export function findKing(board: Board, side: Side): number {
  return board.indexOf(`${side}K`);
}

export function pieceCount(board: Board, side: Side): number {
  let n = 0;
  for (const p of board) if (p && sideOf(p) === side) n++;
  return n;
}

export function isLoneKing(board: Board, side: Side): boolean {
  return pieceCount(board, side) === 1 && findKing(board, side) >= 0;
}

export function needsPromotion(board: Board, from: number, to: number): boolean {
  const p = board[from];
  if (!p || typeOf(p) !== 'P') return false;
  return sqRank(to) === (sideOf(p) === 'w' ? 7 : 0);
}

export interface AppliedMove {
  board: Board;
  castling: CastlingRights;
  /** EP target created by this move (double pawn push), else null. */
  ep: number | null;
  record: Omit<MoveRecord, 'san'>;
}

/** Apply a (pre-validated) move to the board. */
export function applyMove(
  board: Board,
  castling: CastlingRights,
  ep: number | null,
  move: Move,
): AppliedMove {
  const b = board.slice();
  const piece = b[move.from]!;
  const side = sideOf(piece);
  const type = typeOf(piece);
  let captured = b[move.to];
  let capturedSquare: number | null = captured ? move.to : null;
  let enPassant = false;
  let castle: 'K' | 'Q' | null = null;
  const rights = { ...castling };

  if (type === 'P' && move.to === ep && !captured) {
    const victimSq = makeSq(sqFile(move.to), sqRank(move.from));
    captured = b[victimSq];
    capturedSquare = victimSq;
    b[victimSq] = null;
    enPassant = true;
  }

  if (type === 'K' && Math.abs(sqFile(move.to) - sqFile(move.from)) === 2) {
    const home = sqRank(move.from);
    if (sqFile(move.to) === 6) {
      castle = 'K';
      b[makeSq(5, home)] = b[makeSq(7, home)]!;
      b[makeSq(7, home)] = null;
    } else {
      castle = 'Q';
      b[makeSq(3, home)] = b[makeSq(0, home)]!;
      b[makeSq(0, home)] = null;
    }
  }

  b[move.to] = piece;
  b[move.from] = null;

  let promotion = move.promotion;
  if (type === 'P' && sqRank(move.to) === (side === 'w' ? 7 : 0)) {
    promotion = promotion ?? 'Q';
    b[move.to] = `${side}${promotion}`;
  } else {
    promotion = undefined;
  }

  // Castling rights
  if (type === 'K') {
    rights[`${side}K`] = false;
    rights[`${side}Q`] = false;
  }
  const corner = (sq: number) => {
    if (sq === 0) rights.wQ = false;
    if (sq === 7) rights.wK = false;
    if (sq === 56) rights.bQ = false;
    if (sq === 63) rights.bK = false;
  };
  corner(move.from);
  if (capturedSquare !== null) corner(capturedSquare);

  let newEp: number | null = null;
  if (type === 'P' && Math.abs(sqRank(move.to) - sqRank(move.from)) === 2) {
    newEp = makeSq(sqFile(move.from), (sqRank(move.from) + sqRank(move.to)) / 2);
  }

  return {
    board: b,
    castling: rights,
    ep: newEp,
    record: {
      from: move.from,
      to: move.to,
      promotion,
      by: side,
      piece,
      captured: captured ?? null,
      capturedSquare,
      castle,
      enPassant,
      boardBefore: board,
      castlingBefore: castling,
      epBefore: ep,
    },
  };
}

/** Standard algebraic-ish notation (no check concept; "+" marks an attacked king). */
export function toSan(board: Board, castling: CastlingRights, ep: number | null, move: Move): string {
  const piece = board[move.from]!;
  const type = typeOf(piece);
  const side = sideOf(piece);
  const after = applyMove(board, castling, ep, move);
  const { record } = after;
  let san: string;
  if (record.castle) {
    san = record.castle === 'K' ? 'O-O' : 'O-O-O';
  } else {
    const capture = record.captured !== null;
    if (type === 'P') {
      san = `${capture ? `${FILES[sqFile(move.from)]}x` : ''}${sqName(move.to)}`;
      if (record.promotion) san += `=${record.promotion}`;
    } else {
      // Disambiguate among same-type pieces that could also reach the square.
      const rivals: number[] = [];
      for (let sq = 0; sq < 64; sq++) {
        if (sq === move.from || board[sq] !== piece) continue;
        if (pieceTargets(board, sq, castling, ep).includes(move.to)) rivals.push(sq);
      }
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((r) => sqFile(r) === sqFile(move.from));
        const sameRank = rivals.some((r) => sqRank(r) === sqRank(move.from));
        if (!sameFile) dis = FILES[sqFile(move.from)]!;
        else if (!sameRank) dis = String(sqRank(move.from) + 1);
        else dis = sqName(move.from);
      }
      san = `${type}${dis}${capture ? 'x' : ''}${sqName(move.to)}`;
    }
  }
  if (record.captured && typeOf(record.captured) === 'K') return `${san}#`;
  const oppKing = findKing(after.board, other(side));
  if (oppKing >= 0 && isAttacked(after.board, oppKing, side)) san += '+';
  return san;
}

/** FEN of the piece placement (for react-chessboard and debugging). */
export function boardToFen(board: Board): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[makeSq(f, r)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      const t = typeOf(p);
      row += sideOf(p) === 'w' ? t : t.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

/** Build a board from a FEN placement string (tests / puzzles). */
export function boardFromFen(fen: string): Board {
  const b: Board = Array(64).fill(null);
  const rows = fen.split(' ')[0]!.split('/');
  rows.forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const side: Side = ch === ch.toUpperCase() ? 'w' : 'b';
        b[makeSq(f, r)] = `${side}${ch.toUpperCase() as PieceType}`;
        f++;
      }
    }
  });
  return b;
}
