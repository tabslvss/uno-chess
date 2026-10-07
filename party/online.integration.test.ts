/**
 * End-to-end test against a running PartyKit dev server:
 *   PARTYKIT_URL=http://127.0.0.1:1999 npx vitest run party/online.integration.test.ts
 * Skipped when PARTYKIT_URL is not set.
 */
import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/game/ai/bot.ts';
import type { GameServerMessage, LobbyServerMessage, RoomSnapshot } from '../src/net/protocol.ts';

const BASE = process.env.PARTYKIT_URL;
const WS = BASE?.replace(/^http/, 'ws');

class Client<In extends { t: string }> {
  ws: WebSocket;
  inbox: In[] = [];
  room: RoomSnapshot | null = null;
  private waiters: { pred: (m: In) => boolean; resolve: (m: In) => void }[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as In;
      if (m.t === 'sync') this.room = (m as unknown as { room: RoomSnapshot }).room;
      this.inbox.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    };
  }
  open() {
    return new Promise<void>((r) => (this.ws.readyState === 1 ? r() : (this.ws.onopen = () => r())));
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  wait<T extends In>(pred: (m: In) => boolean, ms = 8000): Promise<T> {
    const found = [...this.inbox].reverse().find(pred);
    if (found) {
      this.inbox = [];
      return Promise.resolve(found as T);
    }
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for message')), ms);
      this.waiters.push({ pred, resolve: (m) => (clearTimeout(t), (this.inbox = []), resolve(m as T)) });
    });
  }
  close() {
    this.ws.close();
  }
}

async function until(cond: () => boolean, ms = 8000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const guest = (id: string, name: string) => ({ guestId: `guest-secret-${id}-${Math.random()}`, guestName: name });
const sync = (m: GameServerMessage) => m.t === 'sync';

describe.skipIf(!BASE)('online (PartyKit)', () => {
  it('matchmakes two guests and plays a full game to the end', { timeout: 120_000 }, async () => {
    const a = new Client<LobbyServerMessage>(`${WS}/parties/main/lobby`);
    const b = new Client<LobbyServerMessage>(`${WS}/parties/main/lobby`);
    await Promise.all([a.open(), b.open()]);
    const authA = guest('a', 'Alice');
    const authB = guest('b', 'Bob');
    a.send({ t: 'hello', auth: authA });
    b.send({ t: 'hello', auth: authB });
    await a.wait((m) => m.t === 'welcome');
    await b.wait((m) => m.t === 'welcome');
    a.send({ t: 'queue', mode: 'ranked', tc: '5+0' });
    expect((await a.wait((m) => m.t === 'error')).t).toBe('error'); // guests can't play ranked
    a.send({ t: 'queue', mode: 'casual', tc: '10+0' });
    b.send({ t: 'queue', mode: 'casual', tc: '10+0' });
    const ma = await a.wait<Extract<LobbyServerMessage, { t: 'matched' }>>((m) => m.t === 'matched');
    const mb = await b.wait<Extract<LobbyServerMessage, { t: 'matched' }>>((m) => m.t === 'matched');
    expect(ma.gameId).toBe(mb.gameId);
    a.close();
    b.close();

    // The browser keeps its guest id, so the reserved seats are reclaimed.
    const ga = new Client<GameServerMessage>(`${WS}/parties/game/${ma.gameId}`);
    const gb = new Client<GameServerMessage>(`${WS}/parties/game/${ma.gameId}`);
    const intruder = new Client<GameServerMessage>(`${WS}/parties/game/${ma.gameId}`);
    await Promise.all([ga.open(), gb.open(), intruder.open()]);
    ga.send({ t: 'hello', auth: authA });
    gb.send({ t: 'hello', auth: authB });
    intruder.send({ t: 'hello', auth: guest('x', 'Mallory') });
    const seated = (m: GameServerMessage) => sync(m) && (m as { room: RoomSnapshot }).room.you !== null;
    const ra = (await ga.wait<Extract<GameServerMessage, { t: 'sync' }>>(seated)).room;
    const rb = (await gb.wait<Extract<GameServerMessage, { t: 'sync' }>>(seated)).room;
    const ri = (await intruder.wait<Extract<GameServerMessage, { t: 'sync' }>>(sync)).room;
    expect(ra.status).toBe('playing');
    expect(ra.mode).toBe('casual');
    expect([ra.you, rb.you].sort()).toEqual(['b', 'w']);
    expect(ri.you).toBeNull();
    expect(ra.clock.firstMoveMs).toBeGreaterThan(0);
    intruder.close();
    ga.close();
    gb.close();
  });

  it('private room: create, join, play to completion, spectate, rematch', { timeout: 120_000 }, async () => {
    const id = `t${Date.now().toString(36)}`;
    const authA = guest('pa', 'Alice');
    const authB = guest('pb', 'Bob');
    const a = new Client<GameServerMessage>(`${WS}/parties/game/${id}`);
    await a.open();
    a.send({ t: 'hello', auth: authA, create: { tc: '10+0', rated: false, color: 'w' } });
    let sa = (await a.wait<Extract<GameServerMessage, { t: 'sync' }>>(sync)).room;
    expect(sa.status).toBe('waiting');
    expect(sa.you).toBe('w');

    const b = new Client<GameServerMessage>(`${WS}/parties/game/${id}`);
    await b.open();
    b.send({ t: 'hello', auth: authB });
    let sb = (await b.wait<Extract<GameServerMessage, { t: 'sync' }>>((m) => sync(m) && (m as { room: RoomSnapshot }).room.status === 'playing')).room;
    expect(sb.you).toBe('b');
    expect(sb.players.w?.name).toBe('Alice');

    sa = (await a.wait<Extract<GameServerMessage, { t: 'sync' }>>((m) => sync(m) && (m as { room: RoomSnapshot }).room.status === 'playing')).room;

    // A spectator sees no cards.
    const spec = new Client<GameServerMessage>(`${WS}/parties/game/${id}`);
    await spec.open();
    spec.send({ t: 'hello', auth: guest('s', 'Watcher') });
    const ss = (await spec.wait<Extract<GameServerMessage, { t: 'sync' }>>(sync)).room;
    expect(ss.you).toBeNull();
    expect(ss.state!.hands.w.every((c) => c.color === null)).toBe(true);

    // Cheating attempts are rejected.
    b.send({ t: 'action', action: { type: 'play', cardId: 'k0' }, seq: 0 });
    expect((await b.wait((m) => m.t === 'error')).t).toBe('error');

    // Play a whole game with bots driving each side from its own hidden view.
    const clients = { w: a, b } as const;
    let latest: RoomSnapshot = a.room!;
    for (let i = 0; i < 1500; i++) {
      latest = a.room!;
      const view = latest.state!;
      if (latest.status !== 'playing' || view.result) break;
      const side = view.turn;
      const c = clients[side];
      await until(() => c.room!.state!.seq === view.seq);
      const action = chooseAction(c.room!.state!, side, 1);
      if (!action) break;
      c.send({ t: 'action', action, seq: view.seq });
      await until(() => a.room!.state!.seq > view.seq && b.room!.state!.seq > view.seq);
      // Each player only ever sees their own hand.
      expect(a.room!.state!.hands.b.every((card) => card.color === null)).toBe(true);
      expect(b.room!.state!.hands.w.every((card) => card.color === null)).toBe(true);
    }
    latest = a.room!;
    expect(latest.status).toBe('over');
    expect(latest.result).not.toBeNull();

    // Rematch swaps colours.
    a.send({ t: 'rematch', want: true });
    b.send({ t: 'rematch', want: true });
    sa = (await a.wait<Extract<GameServerMessage, { t: 'sync' }>>((m) => sync(m) && (m as { room: RoomSnapshot }).room.gameNo === 2)).room;
    expect(sa.you).toBe('b');
    expect(sa.status).toBe('playing');

    // Quick chat & resign.
    a.send({ t: 'chat', index: 0 });
    expect((await b.wait((m) => m.t === 'chat')).t).toBe('chat');
    a.send({ t: 'action', action: { type: 'resign' }, seq: 0 });
    sb = (await b.wait<Extract<GameServerMessage, { t: 'sync' }>>((m) => sync(m) && (m as { room: RoomSnapshot }).room.status === 'over')).room;
    expect(sb.result).toEqual({ winner: 'w', reason: 'resign' });

    a.close();
    b.close();
    spec.close();
  });

  it('rejects messages that fail validation', async () => {
    const c = new Client<GameServerMessage>(`${WS}/parties/game/nonexistent-${Date.now()}`);
    await c.open();
    c.send({ t: 'action', action: { type: 'move', from: 99, to: -1 } });
    expect((await c.wait((m) => m.t === 'error')).t).toBe('error');
    c.send({ t: 'hello', auth: guest('x', 'X') });
    const e = await c.wait<Extract<GameServerMessage, { t: 'error' }>>((m) => m.t === 'error');
    expect(e.message).toMatch(/doesn’t exist/);
  });
});
