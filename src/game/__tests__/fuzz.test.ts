import { describe, expect, it } from 'vitest';
import { findKing, pieceCount } from '../board';
import { DECK_SIZE } from '../cards';
import { applyAction, createGame, movesForCard, mustDiscardDead, playableCards, viewFor } from '../engine';
import { chooseAction, type BotLevel } from '../ai/bot';
import { nextRandom } from '../rng';
import type { GameAction, GameState, Side } from '../types';

function rng(seed: number) {
  let s = seed;
  return () => {
    const [v, n] = nextRandom(s);
    s = n;
    return v;
  };
}

function invariants(s: GameState) {
  const total = s.deck.length + s.discard.length + s.hands.w.length + s.hands.b.length;
  expect(total).toBe(DECK_SIZE);
  const ids = [...s.deck, ...s.discard, ...s.hands.w, ...s.hands.b].map((c) => c.id);
  expect(new Set(ids).size).toBe(DECK_SIZE);
  if (s.phase !== 'over' && s.phase !== 'kingCaptured') {
    expect(findKing(s.board, 'w')).toBeGreaterThanOrEqual(0);
    expect(findKing(s.board, 'b')).toBeGreaterThanOrEqual(0);
  }
  expect(pieceCount(s.board, 'w')).toBeLessThanOrEqual(16);
  expect(s.board.filter(Boolean).length).toBeLessThanOrEqual(32);
  if (s.phase === 'card') {
    // A legal action always exists: a playable card or a dead discard.
    expect(playableCards(s).length > 0 || mustDiscardDead(s)).toBe(true);
  }
  if (s.phase === 'move') expect(movesForCard(s, s.played!).length).toBeGreaterThan(0);
}

/** Random legal action (uniform over a few action families). */
function randomAction(s: GameState, r: () => number): GameAction {
  const side = s.turn;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  switch (s.phase) {
    case 'card': {
      const p = playableCards(s);
      if (!p.length) return { type: 'discardDead', cardId: pick(s.hands[side]).id };
      const c = pick(p);
      return { type: 'play', cardId: c.id, color: c.kind === 'wild' ? pick(['red', 'blue', 'green', 'yellow'] as const) : undefined };
    }
    case 'move': {
      const m = pick(movesForCard(s, s.played!));
      return { type: 'move', from: m.from, to: m.to, promotion: pick(['Q', 'R', 'B', 'N'] as const) };
    }
    case 'draw2':
      return { type: 'draw2Discard', cardIds: s.hands[side].slice(0, 2).map((c) => c.id) };
    case 'kingCaptured':
      return r() < 0.5 ? { type: 'acceptCapture' } : { type: 'veto', cardId: s.hands[side].find((c) => c.kind === 'reverse')?.id ?? 'x' };
    default:
      throw new Error('no action');
  }
}

describe('fuzz: random games never break the rules engine', () => {
  it('plays 400 random games to completion with invariants intact', { timeout: 120_000 }, () => {
    let finished = 0;
    for (let g = 0; g < 400; g++) {
      const r = rng(g + 1);
      let s = createGame({ seed: g * 7919 + 1 });
      for (let i = 0; i < 1500 && !s.result; i++) {
        invariants(s);
        if (s.uno.w === 'forgot' && r() < 0.3) s = applyAction(s, 'b', { type: 'catchUno' }).state;
        if (s.uno.b === 'forgot' && r() < 0.3) s = applyAction(s, 'w', { type: 'catchUno' }).state;
        if (s.result) break;
        if ((s.uno[s.turn] === 'needed') && r() < 0.7) {
          s = applyAction(s, s.turn, { type: 'callUno' }).state;
        }
        const a = randomAction(s, r);
        const res = applyAction(s, s.turn, a);
        if (!res.ok) {
          // Only the speculative veto may be refused.
          expect(a.type).toBe('veto');
          s = applyAction(s, s.turn, { type: 'acceptCapture' }).state;
        } else s = res.state;
      }
      invariants(s);
      if (s.result) finished++;
    }
    expect(finished).toBeGreaterThan(300);
  });
});

describe('bots', () => {
  it.each([0, 1, 2, 3] as BotLevel[])('level %i only ever chooses legal actions and finishes games', { timeout: 120_000 }, (level) => {
    for (let g = 0; g < (level >= 2 ? 6 : 12); g++) {
      const r = rng(1000 + g);
      let s = createGame({ seed: 500 + g + level * 100 });
      let guard = 0;
      while (!s.result && guard++ < 2000) {
        const actor: Side = s.turn;
        // Bot sees only its own view.
        const a = chooseAction(viewFor(s, actor), actor, level, r) ?? chooseAction(viewFor(s, actor), actor, level, r);
        expect(a).not.toBeNull();
        const res = applyAction(s, actor, a!);
        if (!res.ok) throw new Error(`illegal bot action ${JSON.stringify(a)}: ${res.error}`);
        s = res.state;
        invariants(s);
      }
      expect(guard).toBeLessThan(2000);
    }
  });

  it('a strong bot beats a beginner most of the time', { timeout: 120_000 }, () => {
    let strongWins = 0;
    let decided = 0;
    for (let g = 0; g < 16; g++) {
      const r = rng(77 + g);
      let s = createGame({ seed: 9000 + g });
      const strong: Side = g % 2 ? 'w' : 'b';
      let guard = 0;
      while (!s.result && guard++ < 3000) {
        const lvl: BotLevel = s.turn === strong ? 3 : 0;
        const a = chooseAction(viewFor(s, s.turn), s.turn, lvl, r)!;
        s = applyAction(s, s.turn, a).state;
      }
      if (s.result?.winner) {
        decided++;
        if (s.result.winner === strong) strongWins++;
      }
    }
    expect(strongWins / Math.max(1, decided)).toBeGreaterThan(0.7);
  });

  it('takes a free king when it can', () => {
    const s0 = createGame({ seed: 1 });
    // Construct: white rook on h1 can take the h8 king with a wild in hand.
    const board = Array(64).fill(null);
    board[4] = 'wK';
    board[7] = 'wR';
    board[63] = 'bK';
    const w = { id: 'w1', kind: 'wild', color: null } as const;
    let s: GameState = { ...s0, board, hands: { w: [w], b: s0.hands.b } };
    const a = chooseAction(s, 'w', 3)!;
    s = applyAction(s, 'w', a).state;
    const m = chooseAction(s, 'w', 3)!;
    expect(m).toMatchObject({ type: 'move', from: 7, to: 63 });
  });
});
