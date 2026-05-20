import type {
  CastlingRights,
  ChessMoveRecord,
  GameState,
  Piece,
  PieceType,
  Player,
  Square,
  UnoCard,
} from './types';
import { cloneBoard, squareKey } from './constants';
import { moveRespectsCardUnlock, squareUnlockedForPiece, unlockedLines } from './uno';

/** Pieces a pawn may promote to. */
export const PROMOTION_CHOICES: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

export function isPromotionPiece(type: PieceType): boolean {
  return PROMOTION_CHOICES.includes(type);
}

export function getPiece(state: GameState, sq: Square): Piece | null {
  return state.board[sq.rank]?.[sq.file] ?? null;
}

export function findKing(board: (Piece | null)[][], player: Player): Square | null {
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if (board[r][f]?.type === 'king' && board[r][f]?.player === player) return { file: f, rank: r };
  return null;
}

export function countPieces(board: (Piece | null)[][], player: Player): number {
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) if (board[r][f]?.player === player) n++;
  return n;
}

export function isLoneKing(board: (Piece | null)[][], player: Player): boolean {
  return countPieces(board, player) === 1 && findKing(board, player) !== null;
}

function inBounds(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

function rayMoves(
  board: (Piece | null)[][],
  from: Square,
  dirs: [number, number][],
  player: Player,
): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of dirs) {
    let f = from.file + df;
    let r = from.rank + dr;
    while (inBounds(f, r)) {
      const target = board[r][f];
      if (!target) out.push({ file: f, rank: r });
      else {
        if (target.player !== player) out.push({ file: f, rank: r });
        break;
      }
      f += df;
      r += dr;
    }
  }
  return out;
}

function knightMoves(board: (Piece | null)[][], from: Square, player: Player): Square[] {
  const jumps = [
    [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];
  const out: Square[] = [];
  for (const [df, dr] of jumps) {
    const f = from.file + df;
    const r = from.rank + dr;
    if (inBounds(f, r)) {
      const t = board[r][f];
      if (!t || t.player !== player) out.push({ file: f, rank: r });
    }
  }
  return out;
}

function pawnMoves(board: (Piece | null)[][], from: Square, player: Player, ep: Square | null): Square[] {
  const dir = player === 'white' ? -1 : 1;
  const startRank = player === 'white' ? 6 : 1;
  const out: Square[] = [];
  const f = from.file;
  const r = from.rank;
  const one = r + dir;
  if (inBounds(f, one) && !board[one][f]) {
    out.push({ file: f, rank: one });
    const two = r + 2 * dir;
    if (r === startRank && inBounds(f, two) && !board[two][f]) out.push({ file: f, rank: two });
  }
  for (const df of [-1, 1]) {
    const nf = f + df;
    const nr = r + dir;
    if (!inBounds(nf, nr)) continue;
    const t = board[nr][nf];
    if (t && t.player !== player) out.push({ file: nf, rank: nr });
    else if (ep && ep.file === nf && ep.rank === nr) out.push({ file: nf, rank: nr });
  }
  return out;
}

function canCastleThrough(
  board: (Piece | null)[][],
  rank: number,
  fromFile: number,
  toFile: number,
): boolean {
  const step = fromFile < toFile ? 1 : -1;
  for (let f = fromFile + step; f !== toFile; f += step) if (board[rank][f]) return false;
  return true;
}

function castlingMoves(
  board: (Piece | null)[][],
  kingSq: Square,
  player: Player,
  rights: CastlingRights,
  card: UnoCard,
): Square[] {
  const out: Square[] = [];
  const r = kingSq.rank;
  const ks = player === 'white' ? rights.whiteKingside : rights.blackKingside;
  const qs = player === 'white' ? rights.whiteQueenside : rights.blackQueenside;
  const kingDestK = { file: 6, rank: r };
  const kingDestQ = { file: 2, rank: r };
  const { ranks, files } = unlockedLines(card);
  const kingCanCastle = ranks.has(r) || files.has(kingSq.file);

  if (ks && kingCanCastle && !board[r][5] && !board[r][6] && canCastleThrough(board, r, kingSq.file, 6)) {
    out.push(kingDestK);
  }
  if (qs && kingCanCastle && !board[r][1] && !board[r][2] && !board[r][3] && canCastleThrough(board, r, kingSq.file, 2)) {
    out.push(kingDestQ);
  }
  return out;
}

/**
 * Returns true if `byPlayer` attacks `sq` on the given board.
 * Used to prevent kings from walking into check.
 */
export function isSquareAttackedBy(
  board: (Piece | null)[][],
  sq: Square,
  byPlayer: Player,
): boolean {
  // Pawns: direction of attack depends on which player is attacking
  // White pawns move in dir=-1 (rank decreasing), attack diagonally
  // To find a white pawn attacking sq, look at sq.rank+1 (the rank the pawn is ON)
  const pawnSrcRank = byPlayer === 'white' ? sq.rank + 1 : sq.rank - 1;
  for (const df of [-1, 1]) {
    const pf = sq.file + df;
    if (inBounds(pf, pawnSrcRank)) {
      const p = board[pawnSrcRank][pf];
      if (p?.type === 'pawn' && p.player === byPlayer) return true;
    }
  }
  // Knights
  const knightJumps: [number, number][] = [
    [1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2],
  ];
  for (const [df, dr] of knightJumps) {
    const f = sq.file + df, r = sq.rank + dr;
    if (inBounds(f, r)) {
      const p = board[r][f];
      if (p?.type === 'knight' && p.player === byPlayer) return true;
    }
  }
  // Diagonals — bishop / queen
  for (const [df, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
    let f = sq.file + df, r = sq.rank + dr;
    while (inBounds(f, r)) {
      const p = board[r][f];
      if (p) {
        if (p.player === byPlayer && (p.type === 'bishop' || p.type === 'queen')) return true;
        break;
      }
      f += df; r += dr;
    }
  }
  // Straight lines — rook / queen
  for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
    let f = sq.file + df, r = sq.rank + dr;
    while (inBounds(f, r)) {
      const p = board[r][f];
      if (p) {
        if (p.player === byPlayer && (p.type === 'rook' || p.type === 'queen')) return true;
        break;
      }
      f += df; r += dr;
    }
  }
  // King proximity (kings can't be adjacent)
  for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
    const f = sq.file + df, r = sq.rank + dr;
    if (inBounds(f, r)) {
      const p = board[r][f];
      if (p?.type === 'king' && p.player === byPlayer) return true;
    }
  }
  return false;
}

/** Check if `player`'s king is currently in check. */
export function isInCheck(board: (Piece | null)[][], player: Player): boolean {
  const opp: Player = player === 'white' ? 'black' : 'white';
  const king = findKing(board, player);
  if (!king) return false;
  return isSquareAttackedBy(board, king, opp);
}

/**
 * Fast board-only move simulation (no castling rook move, no en-passant capture removal
 * except the simple case).  Used only for legal-move filtering.
 */
function applyMoveToBoard(
  board: (Piece | null)[][],
  from: Square,
  to: Square,
  ep: Square | null,
  promotion?: PieceType,
): (Piece | null)[][] {
  const b = cloneBoard(board);
  const piece = b[from.rank][from.file];
  if (!piece) return b;

  // En-passant capture
  if (
    piece.type === 'pawn' &&
    ep &&
    to.file === ep.file &&
    to.rank === ep.rank
  ) {
    const capRank = piece.player === 'white' ? to.rank + 1 : to.rank - 1;
    b[capRank][to.file] = null;
  }

  // Castling — also move the rook
  if (piece.type === 'king' && Math.abs(to.file - from.file) === 2) {
    const rank = from.rank;
    if (to.file === 6) {
      b[rank][5] = b[rank][7];
      b[rank][7] = null;
    } else {
      b[rank][3] = b[rank][0];
      b[rank][0] = null;
    }
  }

  b[to.rank][to.file] = piece;
  b[from.rank][from.file] = null;

  if (piece.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
    const promo = promotion && isPromotionPiece(promotion) ? promotion : 'queen';
    b[to.rank][to.file] = { type: promo, player: piece.player };
  }

  return b;
}

/** Lose castling rights when a corner rook is captured on its home square. */
function stripCastlingIfHomeRookCaptured(
  rights: CastlingRights,
  sq: Square,
  captured: Piece | null,
): void {
  if (!captured || captured.type !== 'rook') return;
  if (captured.player === 'white' && sq.rank === 7) {
    if (sq.file === 0) rights.whiteQueenside = false;
    if (sq.file === 7) rights.whiteKingside = false;
  }
  if (captured.player === 'black' && sq.rank === 0) {
    if (sq.file === 0) rights.blackQueenside = false;
    if (sq.file === 7) rights.blackKingside = false;
  }
}

/**
 * Returns true if making the move from→to would leave the moving player's own king in check.
 * Used to enforce pins and the rule that check must be resolved.
 */
export function moveResultsInSelfCheck(
  state: { board: (Piece | null)[][]; enPassantTarget: Square | null },
  from: Square,
  to: Square,
  player: Player,
  promotion?: PieceType,
): boolean {
  const piece = state.board[from.rank]?.[from.file];
  if (piece?.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
    if (promotion) {
      if (!isPromotionPiece(promotion)) return true;
      const after = applyMoveToBoard(state.board, from, to, state.enPassantTarget, promotion);
      return isInCheck(after, player);
    }
    const anyEscapes = PROMOTION_CHOICES.some((p) => {
      const after = applyMoveToBoard(state.board, from, to, state.enPassantTarget, p);
      return !isInCheck(after, player);
    });
    return !anyEscapes;
  }
  const after = applyMoveToBoard(state.board, from, to, state.enPassantTarget, promotion);
  return isInCheck(after, player);
}

/** Legal promotion pieces for a pawn reaching the back rank (pin/check aware). */
export function legalPromotionChoices(
  state: { board: (Piece | null)[][]; enPassantTarget: Square | null },
  from: Square,
  to: Square,
  player: Player,
): PieceType[] {
  return PROMOTION_CHOICES.filter(
    (p) => !moveResultsInSelfCheck(state, from, to, player, p),
  );
}

/** UNO Chess: king ignores check; no check filtering on any move. */
export function getRawMoves(
  board: (Piece | null)[][],
  from: Square,
  player: Player,
  ep: Square | null,
  rights: CastlingRights,
  card: UnoCard | null,
  forCastlingOnly = false,
): Square[] {
  const piece = board[from.rank][from.file];
  if (!piece || piece.player !== player) return [];
  let moves: Square[] = [];
  switch (piece.type) {
    case 'pawn':
      moves = pawnMoves(board, from, player, ep);
      break;
    case 'knight':
      moves = knightMoves(board, from, player);
      break;
    case 'bishop':
      moves = rayMoves(board, from, [[1, 1], [1, -1], [-1, 1], [-1, -1]], player);
      break;
    case 'rook':
      moves = rayMoves(board, from, [[1, 0], [-1, 0], [0, 1], [0, -1]], player);
      break;
    case 'queen':
      moves = rayMoves(
        board,
        from,
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
        player,
      );
      break;
    case 'king': {
      const steps = [
        [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
      ];
      for (const [df, dr] of steps) {
        const f = from.file + df;
        const r = from.rank + dr;
        if (inBounds(f, r)) {
          const t = board[r][f];
          if (!t || t.player !== player) moves.push({ file: f, rank: r });
        }
      }
      if (card) moves.push(...castlingMoves(board, from, player, rights, card));
      break;
    }
  }
  if (forCastlingOnly) return moves;
  return moves;
}

export function getLegalMovesForPiece(
  state: GameState,
  from: Square,
  card: UnoCard,
): Square[] {
  const player = state.currentPlayer;
  const opp: Player = player === 'white' ? 'black' : 'white';
  const piece = getPiece(state, from);
  if (!piece || piece.player !== player) return [];
  if (!squareUnlockedForPiece(from, card, piece.type) && card.type !== 'wild') return [];
  const raw = getRawMoves(
    state.board,
    from,
    player,
    state.enPassantTarget,
    state.castlingRights,
    card,
  );
  return raw.filter((to) => {
    if (
      piece.type === 'pawn' &&
      (to.rank === 0 || to.rank === 7) &&
      legalPromotionChoices(state, from, to, player).length === 0
    ) {
      return false;
    }

    // Castling: king must start on unlocked rank/file
    if (piece.type === 'king' && Math.abs(to.file - from.file) === 2) {
      const { ranks, files } = unlockedLines(card);
      if (!(ranks.has(from.rank) || files.has(from.file))) return false;
      // Can't castle through or into check
      const step = to.file > from.file ? 1 : -1;
      for (let f = from.file; f !== to.file + step; f += step) {
        if (isSquareAttackedBy(state.board, { file: f, rank: from.rank }, opp)) return false;
      }
      // King can't land in check (handled by self-check filter below too)
      if (isSquareAttackedBy(state.board, to, opp)) return false;
      // Final self-check simulation (rook has moved too)
      return !moveResultsInSelfCheck(state, from, to, player);
    }

    if (!moveRespectsCardUnlock(from, to, piece, card)) return false;

    // King can't walk into an attacked square
    if (piece.type === 'king' && isSquareAttackedBy(state.board, to, opp)) return false;

    // ── Core check/pin rule ──────────────────────────────────────────────
    // Any move that leaves our own king in check is illegal.
    // This enforces: pinned pieces can't move, check must be resolved.
    if (moveResultsInSelfCheck(state, from, to, player)) return false;

    return true;
  });
}

export function getMovablePieceSquares(state: GameState, card: UnoCard): Square[] {
  const player = state.currentPlayer;
  const out: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = { file: f, rank: r };
      const p = state.board[r][f];
      if (!p || p.player !== player) continue;
      if (getLegalMovesForPiece(state, sq, card).length > 0) out.push(sq);
    }
  }
  return out;
}

/** True if this move is legal under the active card (used before applying). */
export function isChessMoveLegal(
  state: GameState,
  from: Square,
  to: Square,
  card: UnoCard,
  promotion?: PieceType,
): boolean {
  const dests = getLegalMovesForPiece(state, from, card);
  if (!dests.some((d) => squaresEqual(d, to))) return false;
  const piece = getPiece(state, from);
  if (piece?.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
    const promo = promotion ?? 'queen';
    if (!isPromotionPiece(promo)) return false;
    return legalPromotionChoices(state, from, to, state.currentPlayer).includes(promo);
  }
  return true;
}

export function applyChessMove(
  state: GameState,
  from: Square,
  to: Square,
  promotion: PieceType = 'queen',
): {
  board: (Piece | null)[][];
  record: ChessMoveRecord;
  kingCaptured: Player | null;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
} {
  const board = cloneBoard(state.board);
  const piece = board[from.rank][from.file]!;
  let captured = board[to.rank][to.file] ? { ...board[to.rank][to.file]! } : null;
  const boardBefore = cloneBoard(state.board);
  let enPassant = false;
  let castling: 'kingside' | 'queenside' | undefined;

  const rights = { ...state.castlingRights };
  let ep: Square | null = null;

  if (piece.type === 'king' && Math.abs(to.file - from.file) === 2) {
    const rank = from.rank;
    if (to.file === 6) {
      castling = 'kingside';
      board[rank][5] = board[rank][7];
      board[rank][7] = null;
    } else {
      castling = 'queenside';
      board[rank][3] = board[rank][0];
      board[rank][0] = null;
    }
  }

  if (piece.type === 'pawn' && state.enPassantTarget) {
    if (to.file === state.enPassantTarget.file && to.rank === state.enPassantTarget.rank) {
      const capRank = piece.player === 'white' ? to.rank + 1 : to.rank - 1;
      const epVictim = board[capRank][to.file];
      if (epVictim) captured = { ...epVictim };
      board[capRank][to.file] = null;
      enPassant = true;
    }
  }

  board[to.rank][to.file] = piece;
  board[from.rank][from.file] = null;

  if (piece.type === 'pawn' && Math.abs(to.rank - from.rank) === 2) {
    ep = { file: from.file, rank: (from.rank + to.rank) / 2 };
  }

  if (piece.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
    const promo = isPromotionPiece(promotion) ? promotion : 'queen';
    board[to.rank][to.file] = { type: promo, player: piece.player };
  }

  if (captured?.type === 'rook') {
    const capSq = enPassant
      ? { file: to.file, rank: piece.player === 'white' ? to.rank + 1 : to.rank - 1 }
      : to;
    stripCastlingIfHomeRookCaptured(rights, capSq, captured);
  }

  if (piece.type === 'king') {
    if (piece.player === 'white') {
      rights.whiteKingside = false;
      rights.whiteQueenside = false;
    } else {
      rights.blackKingside = false;
      rights.blackQueenside = false;
    }
  }
  if (piece.type === 'rook') {
    if (piece.player === 'white' && from.rank === 7 && from.file === 0) rights.whiteQueenside = false;
    if (piece.player === 'white' && from.rank === 7 && from.file === 7) rights.whiteKingside = false;
    if (piece.player === 'black' && from.rank === 0 && from.file === 0) rights.blackQueenside = false;
    if (piece.player === 'black' && from.rank === 0 && from.file === 7) rights.blackKingside = false;
  }

  let kingCaptured: Player | null = null;
  if (captured?.type === 'king') kingCaptured = captured.player;
  else if (board[to.rank][to.file]?.type !== 'king') {
    const opp = piece.player === 'white' ? 'black' : 'white';
    if (!findKing(board, opp)) kingCaptured = opp;
  }
  const record: ChessMoveRecord = {
    from,
    to,
    piece: { ...piece },
    captured,
    promotion: board[to.rank][to.file]?.type !== piece.type ? promotion : undefined,
    enPassant,
    castling,
    boardBefore,
    enPassantTarget: state.enPassantTarget,
    castlingRights: state.castlingRights,
    halfMoveClock: 0,
  };

  return { board, record, kingCaptured, castlingRights: rights, enPassantTarget: ep };
}

export function restoreFromRecord(record: ChessMoveRecord): {
  board: (Piece | null)[][];
  enPassantTarget: Square | null;
  castlingRights: CastlingRights;
} {
  return {
    board: cloneBoard(record.boardBefore),
    enPassantTarget: record.enPassantTarget,
    castlingRights: { ...record.castlingRights },
  };
}

export function squaresEqual(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

export function highlightSet(squares: Square[]): Set<string> {
  return new Set(squares.map(squareKey));
}
