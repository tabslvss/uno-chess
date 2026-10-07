/**
 * Core types for UNO Chess.
 *
 * Board squares are indices 0–63: `sq = rank * 8 + file`, where rank 0 is
 * chess rank 1 (White's back rank) and file 0 is the a-file.
 */

export type Side = 'w' | 'b';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
/** e.g. "wK", "bP" — matches react-chessboard piece codes. */
export type Piece = `${Side}${PieceType}`;
export type Board = (Piece | null)[];

export type Color = 'red' | 'yellow' | 'green' | 'blue';
export type CardKind = 'number' | 'reverse' | 'draw2' | 'wild';

export interface Card {
  id: string;
  kind: CardKind;
  /** null for Wild cards. */
  color: Color | null;
  /** 1–8 for number cards (A=1 … H=8), otherwise undefined. */
  value?: number;
}

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface Move {
  from: number;
  to: number;
  promotion?: Exclude<PieceType, 'P' | 'K'>;
}

/** Everything needed to undo a chess move (Reverse card / king-capture veto). */
export interface MoveRecord extends Move {
  by: Side;
  piece: Piece;
  captured: Piece | null;
  capturedSquare: number | null;
  castle: 'K' | 'Q' | null;
  enPassant: boolean;
  boardBefore: Board;
  castlingBefore: CastlingRights;
  epBefore: number | null;
  san: string;
}

/**
 * UNO-call status for a side reduced to a lone king.
 * - none: has other pieces
 * - needed: lone king, must call UNO before the end of their turn
 * - called: safely called
 * - forgot: ended a turn without calling — opponent may catch them
 */
export type UnoStatus = 'none' | 'needed' | 'called' | 'forgot';

export type Phase =
  /** Current player must play a card (or discard a dead card). */
  | 'card'
  /** A number/Wild card was played — current player must move a piece. */
  | 'move'
  /** A Draw Two was played — current player picks cards to discard. */
  | 'draw2'
  /** `turn` player's king was just captured; they may veto with a Reverse. */
  | 'kingCaptured'
  | 'over';

export type ResultReason =
  | 'kingCapture'
  | 'unoCaught'
  | 'resign'
  | 'timeout'
  | 'sixNoMove'
  | 'agreement'
  | 'abandon'
  | 'aborted';

export interface GameResult {
  /** null = draw / aborted */
  winner: Side | null;
  reason: ResultReason;
}

export type HistoryKind =
  | 'move'
  | 'reverse'
  | 'draw2'
  | 'dead'
  | 'veto'
  | 'uno'
  | 'catch'
  | 'end';

export interface HistoryEntry {
  side: Side;
  kind: HistoryKind;
  card: Card | null;
  /** Chosen color for wilds. */
  color?: Color | null;
  san?: string;
  from?: number;
  to?: number;
  /** Cards discarded via Draw Two (public). */
  discarded?: Card[];
  text?: string;
}

export interface GameState {
  v: 2;
  board: Board;
  turn: Side;
  phase: Phase;
  castling: CastlingRights;
  /** En passant target square for the side to move, or null. */
  ep: number | null;
  hands: Record<Side, Card[]>;
  /** Draw pile; the top of the pile is the END of the array. */
  deck: Card[];
  /** Discard pile; top is the END of the array. */
  discard: Card[];
  /** Colour to match. null = anything matches (wild starter). */
  activeColor: Color | null;
  /** Card played this turn (number/wild while in `move` phase). */
  played: Card | null;
  /** Last chess move on the board that can be undone by a Reverse. */
  lastMove: MoveRecord | null;
  /** Cards played in a row without any piece moving. */
  noMoveStreak: number;
  uno: Record<Side, UnoStatus>;
  /** King capture awaiting a possible Reverse veto. */
  pendingCapture: MoveRecord | null;
  result: GameResult | null;
  history: HistoryEntry[];
  /** Full turns completed (increments every time the turn passes). */
  turnCount: number;
  /** Deterministic RNG state (stripped from player views). */
  rng: number;
  /** Bumped on every successful action — handy for sync/animation keys. */
  seq: number;
}

export type GameAction =
  | { type: 'play'; cardId: string; color?: Color }
  | { type: 'move'; from: number; to: number; promotion?: Exclude<PieceType, 'P' | 'K'> }
  | { type: 'discardDead'; cardId: string }
  | { type: 'draw2Discard'; cardIds: string[] }
  | { type: 'veto'; cardId: string }
  | { type: 'acceptCapture' }
  | { type: 'callUno' }
  | { type: 'catchUno' }
  | { type: 'resign' };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: string };
