import { describe, expect, it } from 'vitest';
import { parseSq as sq, sqName } from '../board';
import { cardMatches, createDeck, DECK_SIZE } from '../cards';
import {
  applyAction,
  canPlayCard,
  createGame,
  forceResult,
  movableSquares,
  mustDiscardDead,
  playableCards,
  targetsFrom,
  topCard,
  viewFor,
} from '../engine';
import type { ActionResult, GameAction, GameState, Side } from '../types';
import { d2, num, position, rev, wild } from './helpers';

function act(state: GameState, side: Side, action: GameAction): GameState {
  const r: ActionResult = applyAction(state, side, action);
  if (!r.ok) throw new Error(`expected ok: ${r.error}`);
  return r.state;
}
function err(state: GameState, side: Side, action: GameAction): string {
  const r = applyAction(state, side, action);
  if (r.ok) throw new Error('expected failure');
  return r.error;
}
const totalCards = (s: GameState) => s.deck.length + s.discard.length + s.hands.w.length + s.hands.b.length;

describe('deck & setup', () => {
  it('builds the 76-card UNO Chess deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deck.filter((c) => c.kind === 'number')).toHaveLength(64);
    expect(deck.filter((c) => c.kind === 'reverse')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'draw2')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(new Set(deck.map((c) => c.id)).size).toBe(76);
  });

  it('deals 7 each, flips a starter, white to play', () => {
    const g = createGame({ seed: 1 });
    expect(g.hands.w).toHaveLength(7);
    expect(g.hands.b).toHaveLength(7);
    expect(g.discard).toHaveLength(1);
    expect(totalCards(g)).toBe(76);
    expect(g.turn).toBe('w');
    expect(g.phase).toBe('card');
    expect(g.activeColor).toBe(topCard(g)!.color);
  });

  it('is deterministic for a seed', () => {
    expect(createGame({ seed: 7 })).toEqual(createGame({ seed: 7 }));
    expect(createGame({ seed: 7 }).hands.w).not.toEqual(createGame({ seed: 8 }).hands.w);
  });
});

describe('card matching', () => {
  const top = num('red', 3);
  it('matches by colour, number, symbol, or wild', () => {
    expect(cardMatches(num('red', 8), top, 'red')).toBe(true);
    expect(cardMatches(num('blue', 3), top, 'red')).toBe(true);
    expect(cardMatches(num('blue', 4), top, 'red')).toBe(false);
    expect(cardMatches(wild(), top, 'red')).toBe(true);
    expect(cardMatches(rev('blue'), rev('red'), 'red')).toBe(true);
    expect(cardMatches(d2('blue'), d2('green'), 'green')).toBe(true);
    expect(cardMatches(d2('blue'), rev('green'), 'green')).toBe(false);
  });
  it('after a wild only the chosen colour (or another wild) matches', () => {
    expect(cardMatches(num('blue', 4), wild(), 'blue')).toBe(true);
    expect(cardMatches(num('red', 4), wild(), 'blue')).toBe(false);
    expect(cardMatches(wild(), wild(), 'blue')).toBe(true);
  });
  it('a wild starter (no colour) accepts anything', () => {
    expect(cardMatches(num('red', 4), wild(), null)).toBe(true);
  });
});

describe('number cards unlock a file and a rank', () => {
  it('lists movable pieces on the b-file and 2nd rank', () => {
    const card = num('red', 2);
    let s = position({ w: [card] });
    s = act(s, 'w', { type: 'play', cardId: card.id });
    expect(s.phase).toBe('move');
    const names = movableSquares(s).map(sqName).sort();
    expect(names).toEqual(['a2', 'b1', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2']);
  });

  it('A (1) at the start frees the knights and the a-pawn', () => {
    const card = num('red', 1);
    const s = act(position({ w: [card] }), 'w', { type: 'play', cardId: card.id });
    expect(movableSquares(s).map(sqName).sort()).toEqual(['a2', 'b1', 'g1']);
  });

  it('a card with no movable pieces is unplayable → must discard', () => {
    const s = position({ fen: '4k3/8/8/8/8/8/8/4K3', w: [num('red', 8)], top: num('red', 5) });
    expect(canPlayCard(s, s.hands.w[0]!)).toBe(false);
    expect(mustDiscardDead(s)).toBe(true);
  });

  it('rejects moving a piece the card does not unlock', () => {
    const card = num('red', 2);
    const s = act(position({ w: [card] }), 'w', { type: 'play', cardId: card.id });
    expect(err(s, 'w', { type: 'move', from: sq('g1'), to: sq('f3') })).toMatch(/unlock/);
  });

  it('a played number card sets the colour to match', () => {
    const card = num('blue', 5);
    let s = position({ w: [card], top: num('red', 5) });
    s = act(s, 'w', { type: 'play', cardId: card.id });
    expect(s.activeColor).toBe('blue');
  });

  it('cannot play a non-matching card', () => {
    const card = num('blue', 2);
    const s = position({ w: [card], top: num('red', 5) });
    expect(err(s, 'w', { type: 'play', cardId: card.id })).toMatch(/match/);
  });

  it('cannot play when every unlocked piece is blocked', () => {
    // H (8): nothing White owns stands on the h-file or rank 8.
    const s = position({ fen: '4k3/8/8/8/8/8/8/R3K3', w: [num('red', 8)], top: num('red', 1) });
    expect(canPlayCard(s, s.hands.w[0]!)).toBe(false);
  });
});

describe('full turn flow', () => {
  it('play → move → draw replacement → opponent to play', () => {
    const card = num('red', 5);
    let s = position({ w: [card, num('green', 3)] });
    s = act(s, 'w', { type: 'play', cardId: card.id });
    s = act(s, 'w', { type: 'move', from: sq('e2'), to: sq('e4') });
    expect(s.board[sq('e4')]).toBe('wP');
    expect(s.turn).toBe('b');
    expect(s.phase).toBe('card');
    expect(s.hands.w).toHaveLength(2);
    expect(s.ep).toBe(sq('e3'));
    expect(s.history.at(-1)).toMatchObject({ kind: 'move', san: 'e4' });
  });

  it('wild needs a colour and frees every piece', () => {
    const w = wild();
    let s = position({ w: [w] });
    expect(err(s, 'w', { type: 'play', cardId: w.id })).toMatch(/colour/);
    s = act(s, 'w', { type: 'play', cardId: w.id, color: 'green' });
    expect(s.activeColor).toBe('green');
    expect(movableSquares(s)).toHaveLength(10); // 8 pawns + 2 knights
  });

  it('must play a playable card instead of discarding', () => {
    const card = num('red', 2);
    const s = position({ w: [card] });
    expect(err(s, 'w', { type: 'discardDead', cardId: card.id })).toMatch(/must play/);
  });

  it('dead discard puts the card on the pile and draws a replacement', () => {
    const card = num('blue', 8);
    let s = position({ w: [card], top: num('red', 1) });
    s = act(s, 'w', { type: 'discardDead', cardId: card.id });
    expect(topCard(s)!.id).toBe(card.id);
    expect(s.activeColor).toBe('blue');
    expect(s.hands.w).toHaveLength(1);
    expect(s.turn).toBe('b');
    expect(s.noMoveStreak).toBe(1);
  });

  it('rejects actions out of turn', () => {
    const s = position({ w: [num('red', 2)], b: [num('red', 7)] });
    expect(err(s, 'b', { type: 'play', cardId: s.hands.b[0]!.id })).toMatch(/turn/);
  });
});

describe('chess rules', () => {
  it('kings may move into check', () => {
    const k = num('red', 5);
    let s = position({ fen: '4k3/8/8/8/8/8/3r4/4K3', w: [k] });
    s = act(s, 'w', { type: 'play', cardId: k.id });
    expect(targetsFrom(s, sq('e1')).map(sqName)).toContain('d1');
  });

  it('pinned pieces can still move (no check rule)', () => {
    const c = num('red', 5);
    let s = position({ fen: '4r1k1/8/8/8/8/8/4N3/4K3', w: [c] });
    s = act(s, 'w', { type: 'play', cardId: c.id });
    expect(targetsFrom(s, sq('e2')).length).toBeGreaterThan(0);
  });

  it('castling needs a card that references the king, even through check', () => {
    const fen = 'r3k2r/8/8/8/8/8/5r2/R3K2R';
    const e = num('red', 5);
    let s = position({ fen, w: [e, num('red', 8)] });
    s = act(s, 'w', { type: 'play', cardId: e.id });
    expect(targetsFrom(s, sq('e1')).map(sqName)).toEqual(expect.arrayContaining(['g1', 'c1']));
    s = act(s, 'w', { type: 'move', from: sq('e1'), to: sq('g1') });
    expect(s.board[sq('g1')]).toBe('wK');
    expect(s.board[sq('f1')]).toBe('wR');
    expect(s.castling.wK).toBe(false);
    expect(s.history.at(-1)!.san).toBe('O-O');
  });

  it('a card referencing only the rook does not allow castling', () => {
    const h = num('red', 8);
    let s = position({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R', w: [h] });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    expect(targetsFrom(s, sq('e1'))).toEqual([]);
  });

  it('no castling after the rook has moved, or with a piece in the way', () => {
    const e = num('red', 1);
    let s = position({ fen: '4k3/8/8/8/8/8/8/RN2K2R', w: [e], castling: { wK: false, wQ: true, bK: false, bQ: false } });
    s = act(s, 'w', { type: 'play', cardId: e.id });
    const t = targetsFrom(s, sq('e1')).map(sqName);
    expect(t).not.toContain('g1');
    expect(t).not.toContain('c1');
  });

  it('en passant when the capturing pawn is referenced', () => {
    const d = num('red', 4);
    const e = num('red', 5);
    // Black pawn d7-d5 next to white e5
    let s = position({ fen: '4k3/3p4/8/4P3/8/8/8/4K3', turn: 'b', b: [d], w: [e] });
    s = act(s, 'b', { type: 'play', cardId: d.id });
    s = act(s, 'b', { type: 'move', from: sq('d7'), to: sq('d5') });
    expect(s.ep).toBe(sq('d6'));
    s = act(s, 'w', { type: 'play', cardId: e.id });
    s = act(s, 'w', { type: 'move', from: sq('e5'), to: sq('d6') });
    expect(s.board[sq('d5')]).toBeNull();
    expect(s.board[sq('d6')]).toBe('wP');
    expect(s.history.at(-1)!.san).toBe('exd6');
  });

  it('en passant expires if not taken immediately', () => {
    const d = num('red', 4);
    let s = position({ fen: '4k3/3p4/8/4P3/8/8/8/4K3', turn: 'b', b: [d, num('red', 2)], w: [num('blue', 8)] });
    s = act(s, 'b', { type: 'play', cardId: d.id });
    s = act(s, 'b', { type: 'move', from: sq('d7'), to: sq('d5') });
    s = act(s, 'w', { type: 'discardDead', cardId: s.hands.w[0]!.id });
    expect(s.ep).toBeNull();
  });

  it('promotion defaults to queen and honours under-promotion', () => {
    const a = num('red', 7);
    let s = position({ fen: '4k3/P7/8/8/8/8/8/4K3', w: [a] });
    s = act(s, 'w', { type: 'play', cardId: a.id });
    const s2 = act(s, 'w', { type: 'move', from: sq('a7'), to: sq('a8'), promotion: 'N' });
    expect(s2.board[sq('a8')]).toBe('wN');
    expect(s2.history.at(-1)!.san).toBe('a8=N');
    const s3 = act(s, 'w', { type: 'move', from: sq('a7'), to: sq('a8') });
    expect(s3.board[sq('a8')]).toBe('wQ');
  });

  it('rejects a bogus promotion piece', () => {
    const a = num('red', 7);
    let s = position({ fen: '4k3/P7/8/8/8/8/8/4K3', w: [a] });
    s = act(s, 'w', { type: 'play', cardId: a.id });
    expect(err(s, 'w', { type: 'move', from: sq('a7'), to: sq('a8'), promotion: 'K' as never })).toMatch(/promotion/);
  });
});

describe('Reverse', () => {
  it('undoes the opponent’s last move, restoring captures', () => {
    const c = num('red', 4);
    let s = position({ fen: '4k3/8/8/3p4/4P3/8/8/4K3', w: [c, num('red', 2)], b: [rev('red'), num('red', 3)] });
    s = act(s, 'w', { type: 'play', cardId: c.id });
    s = act(s, 'w', { type: 'move', from: sq('e4'), to: sq('d5') });
    expect(s.board[sq('d5')]).toBe('wP');
    const r = s.hands.b.find((x) => x.kind === 'reverse')!;
    s = act(s, 'b', { type: 'play', cardId: r.id });
    expect(s.board[sq('d5')]).toBe('bP');
    expect(s.board[sq('e4')]).toBe('wP');
    expect(s.turn).toBe('w');
    expect(s.lastMove).toBeNull();
    expect(s.noMoveStreak).toBe(1);
  });

  it('is unplayable with no opponent move to undo', () => {
    const r = rev('red');
    const s = position({ w: [r] });
    expect(canPlayCard(s, r)).toBe(false);
  });

  it('cannot undo your own move', () => {
    const r = rev('red');
    let s = position({ w: [num('red', 2), r] });
    s = act(s, 'w', { type: 'play', cardId: s.hands.w[0]!.id });
    s = act(s, 'w', { type: 'move', from: sq('e2'), to: sq('e3') });
    s = { ...s, turn: 'w', phase: 'card' };
    expect(canPlayCard(s, r)).toBe(false);
  });

  it('restores castling rights', () => {
    const e = num('red', 5);
    let s = position({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R', w: [e], b: [rev('red')] });
    s = act(s, 'w', { type: 'play', cardId: e.id });
    s = act(s, 'w', { type: 'move', from: sq('e1'), to: sq('g1') });
    s = act(s, 'b', { type: 'play', cardId: s.hands.b.find((c) => c.kind === 'reverse')!.id });
    expect(s.board[sq('e1')]).toBe('wK');
    expect(s.board[sq('h1')]).toBe('wR');
    expect(s.castling.wK).toBe(true);
  });
});

describe('Draw Two', () => {
  it('discard two, draw replacements, then end of turn draw — hand stays at 7', () => {
    const g = createGame({ seed: 3 });
    const two = d2(g.activeColor ?? 'red');
    let s: GameState = { ...g, hands: { ...g.hands, w: [two, ...g.hands.w.slice(0, 6)] } };
    s = act(s, 'w', { type: 'play', cardId: two.id });
    expect(s.phase).toBe('draw2');
    const pick = s.hands.w.slice(0, 2).map((c) => c.id);
    expect(err(s, 'w', { type: 'draw2Discard', cardIds: [pick[0]!] })).toMatch(/Choose 2/);
    expect(err(s, 'w', { type: 'draw2Discard', cardIds: [pick[0]!, pick[0]!] })).toMatch(/Choose 2/);
    s = act(s, 'w', { type: 'draw2Discard', cardIds: pick });
    expect(s.hands.w).toHaveLength(7);
    expect(topCard(s)!.id).toBe(two.id);
    expect(s.turn).toBe('b');
    expect(totalCards(s)).toBe(76);
    expect(s.board).toEqual(g.board);
  });
});

describe('king capture and veto', () => {
  it('capturing the king wins when the victim has no matching Reverse', () => {
    const h = num('red', 8);
    let s = position({ fen: '7k/8/8/8/8/8/8/4K2R', w: [h], b: [num('blue', 2)] });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    s = act(s, 'w', { type: 'move', from: sq('h1'), to: sq('h8') });
    expect(s.phase).toBe('over');
    expect(s.result).toEqual({ winner: 'w', reason: 'kingCapture' });
  });

  it('a matching Reverse lets the victim veto and the game continues', () => {
    const h = num('red', 8);
    const r = rev('red');
    let s = position({ fen: '7k/8/8/8/8/8/8/4K2R', w: [h], b: [r, num('blue', 2)] });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    s = act(s, 'w', { type: 'move', from: sq('h1'), to: sq('h8') });
    expect(s.phase).toBe('kingCaptured');
    expect(s.turn).toBe('b');
    s = act(s, 'b', { type: 'veto', cardId: r.id });
    expect(s.result).toBeNull();
    expect(s.board[sq('h8')]).toBe('bK');
    expect(s.board[sq('h1')]).toBe('wR');
    expect(s.turn).toBe('w');
    expect(s.hands.b).toHaveLength(2);
  });

  it('a non-matching Reverse cannot veto', () => {
    const h = num('red', 8);
    let s = position({ fen: '7k/8/8/8/8/8/8/4K2R', w: [h], b: [rev('blue')] });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    s = act(s, 'w', { type: 'move', from: sq('h1'), to: sq('h8') });
    expect(s.result?.winner).toBe('w');
  });

  it('the victim may accept defeat instead of vetoing', () => {
    const h = num('red', 8);
    let s = position({ fen: '7k/8/8/8/8/8/8/4K2R', w: [h], b: [rev('red')] });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    s = act(s, 'w', { type: 'move', from: sq('h1'), to: sq('h8') });
    s = act(s, 'b', { type: 'acceptCapture' });
    expect(s.result).toEqual({ winner: 'w', reason: 'kingCapture' });
  });
});

describe('UNO call with a lone king', () => {
  // White rook takes Black's last non-king piece.
  function strip(bHand = [num('blue', 1), num('red', 3)]) {
    const h = num('red', 8);
    let s = position({ fen: '4k2n/8/8/8/8/8/8/4K2R', w: [h, num('green', 6)], b: bHand });
    s = act(s, 'w', { type: 'play', cardId: h.id });
    s = act(s, 'w', { type: 'move', from: sq('h1'), to: sq('h8') });
    return s;
  }

  it('flags the lone king as needing a call', () => {
    expect(strip().uno.b).toBe('needed');
  });

  it('calling UNO keeps you safe', () => {
    let s = strip();
    s = act(s, 'b', { type: 'callUno' });
    expect(s.uno.b).toBe('called');
    s = act(s, 'b', { type: 'discardDead', cardId: s.hands.b[0]!.id });
    expect(err(s, 'w', { type: 'catchUno' })).toMatch(/Nothing/);
  });

  it('forgetting to call lets the opponent catch you and win', () => {
    let s = strip();
    s = act(s, 'b', { type: 'discardDead', cardId: s.hands.b[0]!.id });
    expect(s.uno.b).toBe('forgot');
    s = act(s, 'w', { type: 'catchUno' });
    expect(s.result).toEqual({ winner: 'w', reason: 'unoCaught' });
  });

  it('cannot call UNO with pieces left', () => {
    const s = position({ w: [num('red', 2)] });
    expect(err(s, 'w', { type: 'callUno' })).toBeTruthy();
  });

  it('getting a piece back via Reverse clears the obligation', () => {
    let s = strip([rev('red'), num('red', 3)]);
    s = act(s, 'b', { type: 'play', cardId: s.hands.b.find((c) => c.kind === 'reverse')!.id });
    expect(s.board[sq('h8')]).toBe('bN');
    expect(s.uno.b).toBe('none');
  });
});

describe('draws and endings', () => {
  it('six cards in a row with no piece moving is a draw', () => {
    let s = position({
      fen: '4k3/8/8/8/8/8/8/4K3',
      top: num('red', 1),
      w: Array.from({ length: 4 }, () => num('blue', 3)),
      b: Array.from({ length: 4 }, () => num('blue', 2)),
      deck: Array.from({ length: 20 }, () => num('yellow', 3)),
    });
    for (let i = 0; i < 6; i++) {
      expect(s.result).toBeNull();
      const side = s.turn;
      expect(mustDiscardDead(s)).toBe(true);
      s = act(s, side, { type: 'discardDead', cardId: s.hands[side][0]!.id });
    }
    expect(s.result).toEqual({ winner: null, reason: 'sixNoMove' });
  });

  it('a move resets the no-move streak', () => {
    const c = num('red', 2);
    let s = { ...position({ w: [c] }), noMoveStreak: 5 };
    s = act(s, 'w', { type: 'play', cardId: c.id });
    s = act(s, 'w', { type: 'move', from: sq('e2'), to: sq('e3') });
    expect(s.noMoveStreak).toBe(0);
    expect(s.result).toBeNull();
  });

  it('either side can resign at any time', () => {
    const s = act(position({ w: [num('red', 2)] }), 'b', { type: 'resign' });
    expect(s.result).toEqual({ winner: 'w', reason: 'resign' });
    expect(err(s, 'w', { type: 'resign' })).toMatch(/over/);
  });

  it('forceResult ends the game once', () => {
    const s = forceResult(position({}), 'b', 'timeout');
    expect(s.result).toEqual({ winner: 'b', reason: 'timeout' });
    expect(forceResult(s, 'w', 'timeout')).toBe(s);
  });
});

describe('deck exhaustion', () => {
  it('reshuffles the discard pile (minus the top card) when the deck runs out', () => {
    const c = num('red', 2);
    const pile = [num('green', 1), num('green', 2), num('green', 3), num('red', 5)];
    let s = position({ w: [c], deck: [] });
    s = { ...s, discard: pile };
    s = act(s, 'w', { type: 'play', cardId: c.id });
    s = act(s, 'w', { type: 'move', from: sq('e2'), to: sq('e3') });
    expect(s.discard).toHaveLength(1);
    expect(s.discard[0]!.id).toBe(c.id);
    expect(s.hands.w).toHaveLength(1);
    expect(s.deck).toHaveLength(3);
  });
});

describe('views', () => {
  it('hides the opponent hand, deck order and rng', () => {
    const g = createGame({ seed: 5 });
    const v = viewFor(g, 'w');
    expect(v.hands.w).toEqual(g.hands.w);
    expect(v.hands.b).toHaveLength(7);
    expect(v.hands.b.every((c) => c.color === null && !c.value)).toBe(true);
    expect(v.deck).toHaveLength(g.deck.length);
    expect(v.deck.some((c, i) => c.id === g.deck[i]!.id)).toBe(false);
    expect(v.rng).toBe(0);
    expect(JSON.stringify(viewFor(g, null))).not.toContain(g.hands.w[0]!.id);
  });

  it('playable cards are only computed for the side to move', () => {
    const g = createGame({ seed: 9 });
    expect(Array.isArray(playableCards(g))).toBe(true);
  });
});
