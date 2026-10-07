import { applyMove, other, pieceTargets, sideOf, sqFile, sqRank, typeOf } from '../board';
import { cardMatches, cardUnlocksSquare, COLORS, createDeck } from '../cards';
import {
  canCallUno,
  canCatchUno,
  movesForCard,
  mustDiscardDead,
  playableCards,
  vetoCards,
} from '../engine';
import type { Board, Card, Color, GameAction, GameState, Move, Side } from '../types';
import { evaluate, PIECE_VALUE } from './evaluate';

/** 0 = beginner … 3 = expert. */
export type BotLevel = 0 | 1 | 2 | 3;

interface LevelParams {
  noise: number;
  threatAware: boolean;
  handWeight: number;
  /** Chance to remember to call UNO / catch an opponent. */
  unoMemory: number;
  vetoChance: number;
  randomMoveChance: number;
}

const PARAMS: Record<BotLevel, LevelParams> = {
  0: { noise: 400, threatAware: false, handWeight: 0, unoMemory: 0.45, vetoChance: 0.6, randomMoveChance: 0.5 },
  1: { noise: 70, threatAware: false, handWeight: 0.15, unoMemory: 0.8, vetoChance: 0.9, randomMoveChance: 0.1 },
  2: { noise: 25, threatAware: true, handWeight: 0.3, unoMemory: 0.95, vetoChance: 1, randomMoveChance: 0 },
  3: { noise: 4, threatAware: true, handWeight: 0.45, unoMemory: 1, vetoChance: 1, randomMoveChance: 0 },
};

const WIN = 100_000;

type Rand = () => number;

/** Cards whose location the bot can't see: everything not in its hand or on the discard pile. */
function unseenCards(state: GameState, side: Side): Card[] {
  const known = new Map<string, number>();
  const key = (c: Card) => `${c.kind}|${c.color}|${c.value ?? ''}`;
  for (const c of [...state.hands[side], ...state.discard]) known.set(key(c), (known.get(key(c)) ?? 0) + 1);
  const out: Card[] = [];
  for (const c of createDeck()) {
    const k = key(c);
    const n = known.get(k) ?? 0;
    if (n > 0) known.set(k, n - 1);
    else out.push(c);
  }
  return out;
}

/** P(a random hand of h cards drawn from a pool of U contains at least one of k "hits"). */
function pAtLeastOne(U: number, k: number, h: number): number {
  if (k <= 0 || h <= 0 || U <= 0) return 0;
  if (k >= U) return 1;
  let miss = 1;
  for (let i = 0; i < h; i++) miss *= Math.max(0, U - k - i) / (U - i);
  return 1 - miss;
}

interface ThreatCtx {
  unseen: Card[];
  oppHand: number;
}

/**
 * Expected material the opponent takes next turn, weighting each capture by the
 * probability they hold a card that both matches the pile and unlocks the attacker.
 */
function expectedThreat(
  board: Board,
  castling: GameState['castling'],
  me: Side,
  top: Card,
  color: Color | null,
  ctx: ThreatCtx,
  myGain: number,
): number {
  const opp = other(me);
  const matching = ctx.unseen.filter((c) => cardMatches(c, top, color));
  const U = ctx.unseen.length;
  const options: { gain: number; p: number }[] = [];

  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || sideOf(p) !== opp) continue;
    let best = 0;
    for (const to of pieceTargets(board, from, castling, null)) {
      const victim = board[to];
      if (!victim) continue;
      let gain = PIECE_VALUE[typeOf(victim)];
      if (typeOf(victim) === 'K') gain = WIN;
      else {
        // Rough recapture check: is the target defended by me?
        const after = applyMove(board, castling, null, { from, to }).board;
        if (defends(after, to, me)) gain -= PIECE_VALUE[typeOf(p)] * 0.9;
      }
      if (gain > best) best = gain;
    }
    if (best <= 40) continue;
    const k = matching.filter((c) => cardUnlocksSquare(c, from)).length;
    options.push({ gain: best, p: pAtLeastOne(U, k, ctx.oppHand) });
  }
  // Opponent Reverse undoes whatever we just gained.
  if (myGain > 0) {
    const k = matching.filter((c) => c.kind === 'reverse').length;
    options.push({ gain: myGain, p: pAtLeastOne(U, k, ctx.oppHand) });
  }

  options.sort((a, b) => b.gain - a.gain);
  let expected = 0;
  let noneBetter = 1;
  for (const o of options) {
    expected += o.gain * o.p * noneBetter;
    noneBetter *= 1 - o.p;
  }
  return expected;
}

function defends(board: Board, sq: number, me: Side): boolean {
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || sideOf(p) !== me) continue;
    if (typeOf(p) === 'P') {
      const dir = me === 'w' ? 1 : -1;
      if (sqRank(sq) - sqRank(from) === dir && Math.abs(sqFile(sq) - sqFile(from)) === 1) return true;
      continue;
    }
    // Temporarily treat the square as enemy-occupied so sliders "see" it.
    const probe = board.slice();
    probe[sq] = `${other(me)}P`;
    if (pieceTargets(probe, from, { wK: false, wQ: false, bK: false, bQ: false }, null).includes(sq)) return true;
  }
  return false;
}

/** How useful a card is to keep in hand. */
function cardKeepValue(state: GameState, side: Side, card: Card): number {
  switch (card.kind) {
    case 'wild':
      return 70;
    case 'reverse':
      return 45;
    case 'draw2':
      return 12;
    case 'number': {
      let n = 0;
      for (let sq = 0; sq < 64; sq++) {
        const p = state.board[sq];
        if (p && sideOf(p) === side && cardUnlocksSquare(card, sq)) n += typeOf(p) === 'P' ? 1 : 2;
      }
      return Math.min(40, n * 5);
    }
  }
}

function handValue(state: GameState, side: Side, hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardKeepValue(state, side, c), 0);
}

function worstCards(state: GameState, side: Side, n: number, exclude?: string): Card[] {
  return state.hands[side]
    .filter((c) => c.id !== exclude)
    .map((c) => ({ c, v: cardKeepValue(state, side, c) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, n)
    .map((x) => x.c);
}

function bestWildColor(hand: Card[], exclude: string): Color {
  const counts = new Map<Color, number>(COLORS.map((c) => [c, 0]));
  for (const c of hand) if (c.id !== exclude && c.color) counts.set(c.color, counts.get(c.color)! + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

interface Candidate {
  action: GameAction;
  move?: Move;
  score: number;
}

function scoreMove(
  state: GameState,
  side: Side,
  move: Move,
  card: Card,
  color: Color | null,
  params: LevelParams,
  ctx: ThreatCtx,
  base: number,
): number {
  const victim = state.board[move.to];
  if (victim && typeOf(victim) === 'K') {
    const vetoK = ctx.unseen.filter((c) => c.kind === 'reverse' && cardMatches(c, card, color)).length;
    return WIN * (1 - pAtLeastOne(ctx.unseen.length, vetoK, ctx.oppHand));
  }
  const after = applyMove(state.board, state.castling, state.ep, move);
  let score = evaluate(after.board, side);
  if (params.threatAware) {
    score -= expectedThreat(after.board, after.castling, side, card, color, ctx, score - base);
  }
  return score;
}

function noisy(score: number, params: LevelParams, rand: Rand): number {
  return score + (rand() - 0.5) * 2 * params.noise;
}

/**
 * Pick the bot's next action. Uses only information the bot is allowed to see
 * (its own hand, the board and the public discard pile).
 */
export function chooseAction(state: GameState, side: Side, level: BotLevel, rand: Rand = Math.random): GameAction | null {
  if (state.result) return null;
  const params = PARAMS[level];

  // Side actions first: catch a forgetful opponent, call our own UNO.
  if (canCatchUno(state, side) && rand() < params.unoMemory) return { type: 'catchUno' };
  if (state.turn === side && canCallUno(state, side) && state.uno[side] === 'needed' && rand() < params.unoMemory) {
    return { type: 'callUno' };
  }
  if (state.turn !== side) return null;

  const ctx: ThreatCtx = { unseen: unseenCards(state, side), oppHand: state.hands[other(side)].length };
  const base = evaluate(state.board, side);

  switch (state.phase) {
    case 'kingCaptured': {
      const vetoes = vetoCards(state);
      if (vetoes.length && rand() < params.vetoChance) return { type: 'veto', cardId: vetoes[0]!.id };
      return { type: 'acceptCapture' };
    }
    case 'draw2': {
      const n = Math.min(2, state.hands[side].length);
      return { type: 'draw2Discard', cardIds: worstCards(state, side, n).map((c) => c.id) };
    }
    case 'move': {
      const card = state.played!;
      const moves = movesForCard(state, card, side);
      if (!moves.length) return null;
      if (rand() < params.randomMoveChance) {
        const captures = moves.filter((m) => state.board[m.to]);
        const pool = captures.length && rand() < 0.5 ? captures : moves;
        return withPromo(state, pool[Math.floor(rand() * pool.length)]!);
      }
      let best: { m: Move; s: number } | null = null;
      for (const m of moves) {
        const s = noisy(scoreMove(state, side, m, card, state.activeColor, params, ctx, base), params, rand);
        if (!best || s > best.s) best = { m, s };
      }
      return withPromo(state, best!.m);
    }
    case 'card': {
      if (mustDiscardDead(state)) {
        return { type: 'discardDead', cardId: worstCards(state, side, 1)[0]!.id };
      }
      const playable = playableCards(state, side);
      if (level === 0 && rand() < 0.6) {
        const c = playable[Math.floor(rand() * playable.length)]!;
        return { type: 'play', cardId: c.id, color: c.kind === 'wild' ? COLORS[Math.floor(rand() * 4)] : undefined };
      }
      const hand = state.hands[side];
      const cands: Candidate[] = [];
      for (const card of playable) {
        const rest = hand.filter((c) => c.id !== card.id);
        const keep = handValue(state, side, rest) * params.handWeight;
        const color = card.kind === 'wild' ? bestWildColor(hand, card.id) : card.color;
        if (card.kind === 'number' || card.kind === 'wild') {
          let best = -Infinity;
          for (const m of movesForCard(state, card, side)) {
            best = Math.max(best, scoreMove(state, side, m, card, color, params, ctx, base));
          }
          cands.push({ action: { type: 'play', cardId: card.id, color: color ?? undefined }, score: best + keep });
        } else if (card.kind === 'reverse') {
          const rec = state.lastMove!;
          let s = evaluate(rec.boardBefore, side);
          if (params.threatAware) s -= expectedThreat(rec.boardBefore, rec.castlingBefore, side, card, card.color, ctx, 0);
          cands.push({ action: { type: 'play', cardId: card.id }, score: s + keep });
        } else {
          let s = base;
          if (params.threatAware) s -= expectedThreat(state.board, state.castling, side, card, card.color, ctx, 0);
          const dumped = worstCards(state, side, 2, card.id);
          const refresh = dumped.reduce((sum, c) => sum + (25 - cardKeepValue(state, side, c)), 0);
          cands.push({ action: { type: 'play', cardId: card.id }, score: s + keep + refresh * params.handWeight });
        }
      }
      let best: Candidate | null = null;
      for (const c of cands) {
        const s = noisy(c.score, params, rand);
        if (!best || s > best.score) best = { ...c, score: s };
      }
      return best!.action;
    }
    default:
      return null;
  }
}

function withPromo(state: GameState, m: Move): GameAction {
  const p = state.board[m.from]!;
  const promo = typeOf(p) === 'P' && sqRank(m.to) === (sideOf(p) === 'w' ? 7 : 0);
  return { type: 'move', from: m.from, to: m.to, promotion: promo ? 'Q' : undefined };
}

