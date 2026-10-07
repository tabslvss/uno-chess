import type * as Party from 'partykit/server';
import { rateGame, timeControlById } from '../src/game/rating.ts';
import { gameClientSchema, QUICK_CHAT, type GameServerMessage } from '../src/net/protocol.ts';
import { loadRatings, recordGame } from './db.ts';
import { partySecret, readEnv, supabaseConfigured, type ServerEnv } from './env.ts';
import { GameRoom, type Identity, type RoomData, type RoomEvent, type RoomInit } from './gameRoom.ts';
import { cors, json } from './http.ts';
import { resolveIdentity } from './identity.ts';

interface ConnState {
  key: string | null;
}

/** One PartyKit room per game (room id = game id). */
export default class GameServer implements Party.Server {
  game!: GameRoom;
  env: ServerEnv;
  finalized = new Set<number>();

  constructor(readonly party: Party.Room) {
    this.env = readEnv(party.env as Record<string, unknown>);
  }

  async onStart(): Promise<void> {
    const saved = await this.party.storage.get<RoomData>('room');
    this.game = new GameRoom(this.party.id, Date.now(), Math.random, saved ?? undefined);
    const fin = await this.party.storage.get<number[]>('finalized');
    if (fin) this.finalized = new Set(fin);
  }

  // ───────────────────────── HTTP (matchmaker init + previews) ─────────────────────────

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === 'OPTIONS') return cors(req, this.env, new Response(null, { status: 204 }));
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as
        | { secret?: string; init?: RoomInit & { white: Identity; black: Identity } }
        | null;
      if (!body || body.secret !== partySecret(this.env) || !body.init) return json(req, this.env, { error: 'forbidden' }, 403);
      if (this.game.initialized) return json(req, this.env, { error: 'exists' }, 409);
      const events = this.game.init(body.init, Date.now());
      await this.afterChange(events);
      return json(req, this.env, { ok: true });
    }
    const snap = this.game.snapshot(null, Date.now());
    return json(req, this.env, {
      exists: this.game.initialized,
      status: snap.status,
      tc: snap.tc,
      rated: snap.rated,
      players: snap.players,
    });
  }

  // ───────────────────────── sockets ─────────────────────────

  onConnect(conn: Party.Connection<ConnState>): void {
    conn.setState({ key: null });
  }

  async onMessage(raw: string | ArrayBuffer | ArrayBufferView, conn: Party.Connection<ConnState>): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer));
    } catch {
      return;
    }
    const res = gameClientSchema.safeParse(parsed);
    if (!res.success) return this.send(conn, { t: 'error', message: 'Bad request.' });
    const msg = res.data;
    const now = Date.now();
    const key = conn.state?.key ?? null;

    if (msg.t === 'ping') return this.send(conn, { t: 'pong' });

    if (msg.t === 'hello') {
      if (key) return;
      const { identity, error } = await resolveIdentity(this.env, msg.auth);
      if (error) this.send(conn, { t: 'error', message: error });
      if (!this.game.initialized) {
        if (!msg.create) {
          this.send(conn, { t: 'error', message: 'This game doesn’t exist (it may have expired).' });
          return void conn.close(4004, 'not found');
        }
        if (msg.create.rated && identity.guest) {
          this.send(conn, { t: 'error', message: 'Log in to create rated games.' });
          return void conn.close(4003, 'login required');
        }
        this.game.init(
          { tc: msg.create.tc, rated: msg.create.rated, mode: 'private', creator: identity, creatorColor: msg.create.color },
          now,
        );
      }
      const r = this.game.connect(identity, now);
      if (!r.ok) {
        this.send(conn, { t: 'error', message: r.error });
        return void conn.close(4004, 'not found');
      }
      conn.setState({ key: identity.key });
      if (!r.side && this.game.data.rated && identity.guest && this.game.data.status === 'waiting') {
        this.send(conn, { t: 'error', message: 'This is a rated game — log in to take the open seat.' });
      }
      return this.afterChange(r.events);
    }

    if (!key) return this.send(conn, { t: 'error', message: 'Say hello first.' });

    switch (msg.t) {
      case 'action': {
        const r = this.game.act(key, msg.action, now);
        if (!r.ok) {
          this.send(conn, { t: 'error', message: r.error });
          // Resync the sender so an optimistic UI can roll back.
          return this.send(conn, { t: 'sync', room: this.game.snapshot(key, now) });
        }
        return this.afterChange(r.events);
      }
      case 'offerDraw': {
        const r = this.game.offerDraw(key);
        if (!r.ok) return this.send(conn, { t: 'error', message: r.error });
        return this.afterChange([]);
      }
      case 'answerDraw': {
        const r = this.game.answerDraw(key, msg.accept, now);
        if (!r.ok) return this.send(conn, { t: 'error', message: r.error });
        return this.afterChange(r.events);
      }
      case 'abort': {
        const r = this.game.abort(key, now);
        if (!r.ok) return this.send(conn, { t: 'error', message: r.error });
        return this.afterChange(r.events);
      }
      case 'rematch': {
        const r = this.game.rematch(key, msg.want, now);
        if (!r.ok) return this.send(conn, { t: 'error', message: r.error });
        return this.afterChange(r.events);
      }
      case 'chat': {
        const r = this.game.chat(key, now);
        if (!r.ok) return this.send(conn, { t: 'error', message: r.error });
        const out: GameServerMessage = { t: 'chat', side: r.side, name: r.name, text: QUICK_CHAT[msg.index]!, at: now };
        this.party.broadcast(JSON.stringify(out));
        return;
      }
    }
  }

  async onClose(conn: Party.Connection<ConnState>): Promise<void> {
    this.game.disconnect(conn.state?.key ?? null, Date.now());
    await this.afterChange([]);
  }

  async onAlarm(): Promise<void> {
    await this.afterChange(this.game.tick(Date.now()));
  }

  // ───────────────────────── plumbing ─────────────────────────

  private send(conn: Party.Connection, msg: GameServerMessage): void {
    conn.send(JSON.stringify(msg));
  }

  private broadcastState(): void {
    const now = Date.now();
    for (const conn of this.party.getConnections<ConnState>()) {
      this.send(conn, { t: 'sync', room: this.game.snapshot(conn.state?.key ?? null, now) });
    }
  }

  private async afterChange(events: RoomEvent[]): Promise<void> {
    this.broadcastState();
    await this.party.storage.put('room', this.game.data);
    const next = this.game.nextDeadline(Date.now());
    if (next !== null) await this.party.storage.setAlarm(next + 25);
    for (const ev of events) if (ev.type === 'gameOver') await this.finalize(ev.gameNo);
  }

  /** Persist the finished game and apply rating changes (once per game). */
  private async finalize(gameNo: number): Promise<void> {
    if (this.finalized.has(gameNo)) return;
    this.finalized.add(gameNo);
    await this.party.storage.put('finalized', [...this.finalized]);
    const d = this.game.data;
    const state = d.state;
    const w = d.seats.w?.id;
    const b = d.seats.b?.id;
    if (!state?.result || !w || !b || state.result.reason === 'aborted') return;

    const tc = timeControlById(d.tc);
    const rated = d.rated && !w.guest && !b.guest;
    const record = {
      id: `${d.id}-${gameNo}`,
      white_id: w.userId,
      black_id: b.userId,
      white_name: w.name,
      black_name: b.name,
      rated,
      mode: d.mode,
      time_control: tc.id,
      category: tc.category,
      winner: state.result.winner,
      reason: state.result.reason,
      turns: state.turnCount,
      history: state.history,
    };

    if (rated) {
      const ids = [w.userId!, b.userId!];
      const fromDb = supabaseConfigured(this.env) ? await loadRatings(this.env, ids, tc.category) : null;
      const before = {
        w: fromDb?.[w.userId!] ?? w.ratings[tc.category] ?? { rating: 1200, rd: 350, vol: 0.06 },
        b: fromDb?.[b.userId!] ?? b.ratings[tc.category] ?? { rating: 1200, rd: 350, vol: 0.06 },
      };
      const score = state.result.winner === 'w' ? 1 : state.result.winner === 'b' ? 0 : 0.5;
      const after = rateGame(before.w, before.b, score);
      const change = {
        w: { before: Math.round(before.w.rating), after: Math.round(after.white.rating) },
        b: { before: Math.round(before.b.rating), after: Math.round(after.black.rating) },
      };
      this.game.setRatingChange(change, { w: after.white, b: after.black });
      await this.party.storage.put('room', this.game.data);
      this.broadcastState();
      await recordGame(this.env, {
        ...record,
        white: { ...after.white, before: before.w.rating },
        black: { ...after.black, before: before.b.rating },
      });
    } else if (w.userId || b.userId) {
      await recordGame(this.env, record);
    }
  }
}
