import type { Color, GameAction, GameActionResult, GameState, PieceType, Square } from './types';
import * as engine from './engine';
import { getMovablePieceSquares } from './chess';

export const UnoChess = {
  newGame(): GameState {
    return engine.createGame();
  },

  apply(state: GameState, action: GameAction): GameActionResult {
    const next = engine.applyAction(state, action);
    return { state: next, ok: next !== state };
  },

  viewForPlayer(state: GameState, viewer: import('./types').Player): GameState {
    return engine.viewForPlayer(state, viewer);
  },

  playCard(state: GameState, cardId: string, wildColor?: Color): GameActionResult {
    const next = engine.playCard(state, cardId, wildColor);
    return { state: next, ok: next !== state };
  },

  pickWildColor(state: GameState, color: Color): GameActionResult {
    const next = engine.pickWildColor(state, color);
    return { state: next, ok: next.phase !== 'pickWildColor' };
  },

  selectSquare(state: GameState, square: Square): GameActionResult {
    const next = engine.selectSquare(state, square);
    return { state: next, ok: next !== state };
  },

  move(state: GameState, from: Square, to: Square, promotion: PieceType = 'queen'): GameActionResult {
    const next = engine.executeMove(state, from, to, promotion);
    return { state: next, ok: next.board !== state.board };
  },

  vetoCapture(state: GameState, reverseCardId: string): GameActionResult {
    const next = engine.vetoWithReverse(state, reverseCardId);
    return { state: next, ok: next.phase !== 'kingCaptureVeto' };
  },

  acceptWin(state: GameState): GameActionResult {
    return { state: engine.acceptCapture(state), ok: true };
  },

  movableSquares(state: GameState) {
    if (!state.activeCard) return [];
    return getMovablePieceSquares(state, state.activeCard);
  },

  targetSquares(state: GameState) {
    return engine.getLegalMoves(state);
  },

  vetoCards(state: GameState) {
    return engine.getVetoReverses(state);
  },
};

export type {
  GameState,
  Square,
  Color,
  PieceType,
  Player,
  UnoCard,
  GameAction,
  BotDifficulty,
} from './types';
export { squareLabel, cardLabel } from './uno';
export { FILES, HAND_SIZE, randomPlayer } from './constants';
export { boardToFen, squareFromAlgebraic, squareToAlgebraic } from './chessBridge';
