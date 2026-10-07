import { describe, expect, it } from 'vitest';
import { parseSq } from '../board';
import { applyAction, createGame } from '../engine';
import type { Card, GameState } from '../types';

// The home-page demo must be a legal UNO Chess sequence.
const c = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });
const STEPS: [Card, string?, string?][] = [
  [c('h1', 'number', 'red', 5), 'e2', 'e4'],
  [c('h2', 'number', 'red', 7), 'e7', 'e5'],
  [c('h3', 'number', 'blue', 7), 'g1', 'f3'],
  [c('h4', 'number', 'blue', 8), 'b8', 'c6'],
  [c('h5', 'number', 'blue', 6), 'f1', 'c4'],
  [c('h6', 'number', 'blue', 7), 'g8', 'f6'],
  [c('h7', 'number', 'blue', 3), 'f3', 'e5'],
  [c('h8', 'reverse', 'blue')],
  [c('h9', 'wild', null), 'd2', 'd3'],
  [c('h10', 'number', 'yellow', 6), 'f8', 'c5'],
];

describe('home page demo game', () => {
  it('is legal under the rules engine', () => {
    let s: GameState = { ...createGame({ seed: 1 }), discard: [c('top', 'number', 'red', 2)], activeColor: 'red' };
    for (const [card, from, to] of STEPS) {
      const side = s.turn;
      s = { ...s, hands: { ...s.hands, [side]: [card, ...s.hands[side]] } };
      const r = applyAction(s, side, { type: 'play', cardId: card.id, color: card.kind === 'wild' ? 'yellow' : undefined });
      expect(r.ok, `${card.id}: ${!r.ok ? r.error : ''}`).toBe(true);
      s = r.state;
      if (from) {
        const m = applyAction(s, side, { type: 'move', from: parseSq(from), to: parseSq(to!) });
        expect(m.ok, `${card.id} ${from}-${to}: ${!m.ok ? m.error : ''}`).toBe(true);
        s = m.state;
      }
    }
    expect(s.result).toBeNull();
  });
});
