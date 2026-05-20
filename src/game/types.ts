export type Color = 'red' | 'yellow' | 'green' | 'blue';
export type Player = 'white' | 'black';
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type CardLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type UnoCardType = 'letter' | 'skip' | 'reverse' | 'wild';
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface Piece {
  type: PieceType;
  player: Player;
}

export interface Square {
  file: number;
  rank: number;
}

export interface UnoCard {
  id: string;
  color: Color;
  type: UnoCardType;
  letter?: CardLetter;
}

export interface ChessMoveRecord {
  from: Square;
  to: Square;
  piece: Piece;
  captured: Piece | null;
  promotion?: PieceType;
  enPassant?: boolean;
  castling?: 'kingside' | 'queenside';
  boardBefore: (Piece | null)[][];
  enPassantTarget: Square | null;
  castlingRights: CastlingRights;
  halfMoveClock: number;
}

export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

export type Phase = 'playCard' | 'chess' | 'pickWildColor' | 'kingCaptureVeto' | 'gameOver';

export type GameResult = 'white' | 'black' | 'draw' | null;

export type GameEvent =
  | { type: 'play'; player: Player; cardId: string }
  | { type: 'draw'; player: Player; cardId: string }
  | null;

export interface GameState {
  board: (Piece | null)[][];
  currentPlayer: Player;
  phase: Phase;
  hands: Record<Player, UnoCard[]>;
  /** Central facedown "Uno Chess" draw pile */
  drawPile: UnoCard[];
  /** Card played this turn — visible to both players */
  playedCard: UnoCard | null;
  activeCard: UnoCard | null;
  wildPendingColor: Color | null;
  pendingCardId: string | null;
  selectedSquare: Square | null;
  lastChessMove: { by: Player; record: ChessMoveRecord } | null;
  idleTurns: number;
  pendingCapture: { by: Player; move: ChessMoveRecord } | null;
  result: GameResult;
  resultReason: string;
  message: string;
  enPassantTarget: Square | null;
  castlingRights: CastlingRights;
  /** Drives play/draw animations in the UI */
  lastEvent: GameEvent;
}

export interface GameActionResult {
  state: GameState;
  ok: boolean;
  error?: string;
}

export type GameAction =
  | { type: 'playCard'; cardId: string; wildColor?: Color }
  | { type: 'pickWild'; color: Color }
  | { type: 'selectSquare'; square: Square }
  | { type: 'move'; from: Square; to: Square; promotion?: PieceType }
  | { type: 'veto'; cardId: string }
  | { type: 'acceptCapture' }
  | { type: 'discardForRedraw'; cardId: string };
