import type { BotDifficulty, GameAction, GameState, Player, Square } from './types';
import {
  abandonReverseBonus,
  applyAction,
  cardCanBePlayed,
  endTurnWithoutMove,
  getLegalMoves,
  isReverseBonusPending,
} from './engine';
import { getMovablePieceSquares } from './chess';
import { pieceOnUnlockedLines } from './uno';

function pickRandomCard(state: GameState): GameAction | null {
  const hand = state.hands[state.currentPlayer].filter((c) => cardCanBePlayed(state, c));
  if (hand.length === 0) return null;
  const card = hand[Math.floor(Math.random() * hand.length)]!;
  if (card.type === 'wild') {
    const colors: import('./types').Color[] = ['red', 'yellow', 'green', 'blue'];
    return {
      type: 'playCard',
      cardId: card.id,
      wildColor: colors[Math.floor(Math.random() * colors.length)],
    };
  }
  return { type: 'playCard', cardId: card.id };
}

function pickCard(state: GameState, difficulty: BotDifficulty): GameAction | null {
  const hand = state.hands[state.currentPlayer].filter((c) => cardCanBePlayed(state, c));
  if (hand.length === 0) return null;

  const scored = hand.map((card) => {
    let score = Math.random();
    if (card.type === 'letter' && pieceOnUnlockedLines(state.board, state.currentPlayer, card)) {
      score += difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 4;
    }
    if (card.type === 'wild') score += difficulty === 'extreme' ? 3 : 2;
    if (card.type === 'reverse' && state.lastChessMove?.by === (state.currentPlayer === 'white' ? 'black' : 'white')) {
      score += 3;
    }
    if (card.type === 'skip') score += difficulty === 'extreme' ? 2.5 : 1.5;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const card = scored[0].card;
  if (card.type === 'wild') {
    return { type: 'playCard', cardId: card.id, wildColor: card.color };
  }
  return { type: 'playCard', cardId: card.id };
}

function scoreMove(state: GameState, _from: Square, to: Square, difficulty: BotDifficulty): number {
  const target = state.board[to.rank][to.file];
  let s = Math.random() * (difficulty === 'easy' ? 2 : 0.5);
  if (target) {
    const v: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
    s += (v[target.type] ?? 1) * (difficulty === 'extreme' ? 2 : difficulty === 'hard' ? 1.5 : 1);
  }
  return s;
}

function pickMove(state: GameState, difficulty: BotDifficulty): GameAction | null {
  const card = state.activeCard;
  if (!card) return null;
  const pieces = getMovablePieceSquares(state, card);
  let best: { from: Square; to: Square; score: number } | null = null;

  for (const from of pieces) {
    const sel = { ...state, selectedSquare: from };
    for (const to of getLegalMoves(sel)) {
      const sc = scoreMove(state, from, to, difficulty);
      if (!best || sc > best.score) best = { from, to, score: sc };
    }
  }

  if (!best) return null;
  const piece = state.board[best.from.rank][best.from.file];
  if (piece?.type === 'pawn' && (best.to.rank === 0 || best.to.rank === 7)) {
    return { type: 'move', from: best.from, to: best.to, promotion: 'queen' };
  }
  return { type: 'move', from: best.from, to: best.to };
}

export function runAiStep(state: GameState, aiPlayer: Player, difficulty: BotDifficulty): GameState {
  if (state.currentPlayer !== aiPlayer || state.phase === 'gameOver') return state;

  if (state.phase === 'kingCaptureVeto') {
    const reverses = state.hands[aiPlayer].filter((c) => c.type === 'reverse');
    const tryVeto = difficulty !== 'easy' && reverses.length > 0 && Math.random() > 0.4;
    if (tryVeto) return applyAction(state, { type: 'veto', cardId: reverses[0].id });
    return applyAction(state, { type: 'acceptCapture' });
  }

  if (state.phase === 'pickWildColor') {
    const colors: import('./types').Color[] = ['red', 'yellow', 'green', 'blue'];
    return applyAction(state, {
      type: 'pickWild',
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  if (state.phase === 'playCard') {
    if (isReverseBonusPending(state)) {
      const action = pickCard(state, difficulty) ?? pickRandomCard(state);
      if (!action) return abandonReverseBonus(state);
      return applyAction(state, action);
    }
    const action = pickRandomCard(state) ?? pickCard(state, difficulty);
    if (!action) return state;
    return applyAction(state, action);
  }

  if (state.phase === 'chess') {
    const action = pickMove(state, difficulty);
    if (action) return applyAction(state, action);
    return endTurnWithoutMove(state);
  }

  return state;
}

export function runAiTurn(
  state: GameState,
  aiPlayer: Player,
  difficulty: BotDifficulty,
  maxSteps = 10,
): GameState {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    const next = runAiStep(s, aiPlayer, difficulty);
    if (next === s) break;
    s = next;
    if (s.phase === 'gameOver' || s.currentPlayer !== aiPlayer) break;
  }
  return s;
}
