import { describe, expect, it } from 'vitest';
import { movesForCard, playableCards } from '../src/game/engine.ts';
import type { GameAction, GameState } from '../src/game/types.ts';
import { ABANDON_MS, FIRST_MOVE_MS, GameRoom, type Identity } from './gameRoom.ts';

const ident = (name: string, guest = false): Identity => ({
  key: guest ? `guest:${name}` : `user:${name}`,
  publicId: name,
  name,
  guest,
  userId: guest ? null : name,
  ratings: {},
});
const alice = ident('alice');
const bob = ident('bob');

function seeded() {
  let x = 0.37;
  return () => (x = (x * 9301 + 0.49297) % 1);
}

function privateRoom(now = 0, tc = '1+0') {
  const room = new GameRoom('ROOM1', now, seeded());
  room.init({ tc, rated: false, mode: 'private', creator: alice, creatorColor: 'w' }, now);
  room.connect(alice, now);
  room.connect(bob, now);
  return room;
}

/** One legal full turn for the side to move (card + move, or dead discard / draw2). */
function turnActions(s: GameState): GameAction {
  if (s.phase === 'card') {
    const p = playableCards(s);
    if (!p.length) return { type: 'discardDead', cardId: s.hands[s.turn][0]!.id };
    const c = p[0]!;
    return { type: 'play', cardId: c.id, color: c.kind === 'wild' ? 'red' : undefined };
  }
  if (s.phase === 'move') {
    const m = movesForCard(s, s.played!)[0]!;
    return { type: 'move', from: m.from, to: m.to };
  }
  if (s.phase === 'draw2') return { type: 'draw2Discard', cardIds: s.hands[s.turn].slice(0, 2).map((c) => c.id) };
  return { type: 'acceptCapture' };
}

function playTurn(room: GameRoom, now: number) {
  const startCount = room.data.state!.turnCount;
  for (let i = 0; i < 5 && room.data.state!.turnCount === startCount && room.data.status === 'playing'; i++) {
    const s = room.data.state!;
    const key = s.turn === 'w' ? room.data.seats.w!.id.key : room.data.seats.b!.id.key;
    const r = room.act(key, turnActions(s), now);
    if (!r.ok) throw new Error(r.error);
  }
}

describe('GameRoom seating', () => {
  it('creator takes their chosen colour and the second visitor the other seat', () => {
    const room = privateRoom();
    expect(room.sideOf(alice.key)).toBe('w');
    expect(room.sideOf(bob.key)).toBe('b');
    expect(room.data.status).toBe('playing');
  });

  it('third visitors spectate and only see hidden hands', () => {
    const room = privateRoom();
    const r = room.connect(ident('carol'), 0);
    expect(r.ok && r.side).toBe(null);
    const snap = room.snapshot('user:carol', 0);
    expect(snap.you).toBeNull();
    expect(snap.state!.hands.w.every((c) => c.color === null)).toBe(true);
    expect(snap.spectators).toBe(1);
  });

  it('players only see their own hand', () => {
    const room = privateRoom();
    const snap = room.snapshot(alice.key, 0);
    expect(snap.you).toBe('w');
    expect(snap.state!.hands.w).toEqual(room.data.state!.hands.w);
    expect(snap.state!.hands.b.every((c) => c.color === null)).toBe(true);
    expect(snap.state!.rng).toBe(0);
  });

  it('reconnecting with the same identity reclaims the seat', () => {
    const room = privateRoom();
    room.disconnect(alice.key, 10);
    const r = room.connect(alice, 20);
    expect(r.ok && r.side).toBe('w');
    expect(room.data.seats.w!.disconnectedAt).toBeNull();
  });

  it('guests cannot sit in a rated room', () => {
    const room = new GameRoom('R', 0, seeded());
    room.init({ tc: '5+0', rated: true, mode: 'private', creator: alice, creatorColor: 'random' }, 0);
    const r = room.connect(ident('g', true), 0);
    expect(r.ok && r.side).toBeNull();
    expect(room.data.status).toBe('waiting');
  });

  it('matchmade rooms only seat the reserved players', () => {
    const room = new GameRoom('M', 0, seeded());
    room.init({ tc: '3+2', rated: true, mode: 'ranked', white: alice, black: bob }, 0);
    expect(room.data.status).toBe('playing');
    const r = room.connect(ident('mallory'), 0);
    expect(r.ok && r.side).toBeNull();
    expect(room.act('user:mallory', { type: 'resign' }, 0).ok).toBe(false);
  });

  it('unknown rooms reject connections', () => {
    const room = new GameRoom('X', 0);
    expect(room.connect(alice, 0).ok).toBe(false);
  });
});

describe('GameRoom actions', () => {
  it('rejects out-of-turn and illegal actions without changing state', () => {
    const room = privateRoom();
    const before = room.data.state;
    const r = room.act(bob.key, { type: 'callUno' }, 0);
    expect(r.ok).toBe(false);
    expect(room.data.state).toBe(before);
  });

  it('either player can resign at any time', () => {
    const room = privateRoom();
    const r = room.act(bob.key, { type: 'resign' }, 5);
    expect(r.ok && r.events).toEqual([{ type: 'gameOver', gameNo: 1 }]);
    expect(room.data.state!.result).toEqual({ winner: 'w', reason: 'resign' });
  });
});

describe('GameRoom clocks', () => {
  it('clock does not run during the first two turns', () => {
    const room = privateRoom(0);
    playTurn(room, 20_000);
    expect(room.remainingAt(20_000)).toEqual({ w: 60_000, b: 60_000 });
    playTurn(room, 25_000);
    expect(room.data.state!.turnCount).toBe(2);
    expect(room.remainingAt(35_000).w).toBe(50_000);
  });

  it('aborts if a player does not make their first move in time', () => {
    const room = privateRoom(0);
    expect(room.nextDeadline(0)).toBe(FIRST_MOVE_MS);
    const ev = room.tick(FIRST_MOVE_MS + 1);
    expect(ev).toHaveLength(1);
    expect(room.data.state!.result).toEqual({ winner: null, reason: 'aborted' });
  });

  it('flags a player whose time runs out', () => {
    const room = privateRoom(0);
    playTurn(room, 1000);
    playTurn(room, 2000);
    const active = room.data.state!.turn;
    const deadline = room.nextDeadline(2000)!;
    expect(deadline).toBe(2000 + 60_000);
    room.tick(deadline);
    expect(room.data.state!.result).toEqual({ winner: active === 'w' ? 'b' : 'w', reason: 'timeout' });
    expect(room.snapshot(null, deadline).clock[active]).toBe(0);
  });

  it('an action after the flag fell loses on time instead of being applied', () => {
    const room = privateRoom(0);
    playTurn(room, 1000);
    playTurn(room, 2000);
    const s = room.data.state!;
    const key = s.turn === 'w' ? alice.key : bob.key;
    const r = room.act(key, turnActions(s), 2000 + 61_000);
    expect(r.ok).toBe(true);
    expect(room.data.state!.result?.reason).toBe('timeout');
  });

  it('adds the increment after each completed turn', () => {
    const room = new GameRoom('I', 0, seeded());
    room.init({ tc: '3+2', rated: false, mode: 'private', creator: alice, creatorColor: 'w' }, 0);
    room.connect(alice, 0);
    room.connect(bob, 0);
    playTurn(room, 100);
    playTurn(room, 200);
    const side = room.data.state!.turn;
    playTurn(room, 10_200);
    expect(room.data.remaining[side]).toBe(180_000 - 10_000 + 2000);
  });

  it('can be aborted early but not once both have moved', () => {
    const room = privateRoom(0);
    playTurn(room, 100);
    playTurn(room, 200);
    expect(room.abort(alice.key, 300).ok).toBe(false);
    const fresh = privateRoom(0);
    const r = fresh.abort(bob.key, 10);
    expect(r.ok).toBe(true);
    expect(fresh.data.state!.result?.reason).toBe('aborted');
  });
});

describe('GameRoom abandonment', () => {
  it('a player gone for too long loses while the opponent waits', () => {
    const room = privateRoom(0, '10+0');
    playTurn(room, 100);
    playTurn(room, 200);
    room.disconnect(bob.key, 1000);
    expect(room.nextDeadline(1000)).toBeLessThanOrEqual(1000 + ABANDON_MS);
    room.tick(1000 + ABANDON_MS);
    expect(room.data.state!.result).toEqual({ winner: 'w', reason: 'abandon' });
  });

  it('reconnecting in time cancels abandonment', () => {
    const room = privateRoom(0, '10+0');
    playTurn(room, 100);
    playTurn(room, 200);
    room.disconnect(bob.key, 1000);
    room.connect(bob, 2000);
    expect(room.tick(1000 + ABANDON_MS)).toEqual([]);
  });
});

describe('GameRoom draw offers & rematch', () => {
  it('offer → accept ends in a draw', () => {
    const room = privateRoom(0);
    expect(room.offerDraw(alice.key).ok).toBe(true);
    expect(room.offerDraw(alice.key).ok).toBe(false);
    expect(room.answerDraw(alice.key, true, 1).ok).toBe(false);
    const r = room.answerDraw(bob.key, true, 1);
    expect(r.ok).toBe(true);
    expect(room.data.state!.result).toEqual({ winner: null, reason: 'agreement' });
  });

  it('declining clears the offer and there is a cooldown', () => {
    const room = privateRoom(0);
    room.offerDraw(alice.key);
    room.answerDraw(bob.key, false, 1);
    expect(room.data.drawOffer).toBeNull();
    expect(room.offerDraw(alice.key).ok).toBe(false);
  });

  it('rematch needs both players and swaps colours', () => {
    const room = privateRoom(0);
    room.act(alice.key, { type: 'resign' }, 1);
    expect(room.rematch(alice.key, true, 2).ok).toBe(true);
    expect(room.data.status).toBe('over');
    const r = room.rematch(bob.key, true, 3);
    expect(r.ok && r.events).toEqual([{ type: 'started', gameNo: 2 }]);
    expect(room.sideOf(alice.key)).toBe('b');
    expect(room.data.state!.result).toBeNull();
  });

  it('chat is rate limited and players only', () => {
    const room = privateRoom(0);
    expect(room.chat(alice.key, 5000).ok).toBe(true);
    expect(room.chat(alice.key, 5100).ok).toBe(false);
    expect(room.chat('user:nobody', 9000).ok).toBe(false);
  });
});
