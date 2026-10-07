import type * as Party from 'partykit/server';
import { lobbyClientSchema, type LobbyServerMessage } from '../src/net/protocol.ts';
import { partySecret, readEnv, type ServerEnv } from './env.ts';
import type { Identity } from './gameRoom.ts';
import { json, cors } from './http.ts';
import { resolveIdentity } from './identity.ts';
import { Matchmaker } from './matchmaker.ts';

interface ConnState {
  identity: Identity | null;
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newGameId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/**
 * Lobby / matchmaker. Every client connects to the single room `main/lobby`
 * to queue for casual or ranked games and to see live player counts.
 */
export default class LobbyServer implements Party.Server {
  mm = new Matchmaker();
  env: ServerEnv;
  activeGames = 0;

  constructor(readonly party: Party.Room) {
    this.env = readEnv(party.env as Record<string, unknown>);
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === 'OPTIONS') return cors(req, this.env, new Response(null, { status: 204 }));
    return json(req, this.env, { ok: true, ...this.stats() });
  }

  onConnect(conn: Party.Connection<ConnState>): void {
    conn.setState({ identity: null });
    this.broadcastStats();
  }

  async onMessage(raw: string | ArrayBuffer | ArrayBufferView, conn: Party.Connection<ConnState>): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer));
    } catch {
      return;
    }
    const res = lobbyClientSchema.safeParse(parsed);
    if (!res.success) return this.send(conn, { t: 'error', message: 'Bad request.' });
    const msg = res.data;

    switch (msg.t) {
      case 'hello': {
        const { identity, error } = await resolveIdentity(this.env, msg.auth);
        if (error) this.send(conn, { t: 'error', message: error });
        conn.setState({ identity });
        this.send(conn, { t: 'welcome', name: identity.name, guest: identity.guest, ratings: identity.ratings });
        return;
      }
      case 'queue': {
        const identity = conn.state?.identity;
        if (!identity) return this.send(conn, { t: 'error', message: 'Still connecting — try again.' });
        const err = this.mm.enqueue(conn.id, identity, msg.mode, msg.tc, Date.now());
        if (err) return this.send(conn, { t: 'error', message: err });
        const entry = this.mm.entryFor(conn.id)!;
        this.send(conn, { t: 'queued', mode: entry.mode, tc: entry.tc, size: this.mm.sizeFor(entry.mode, entry.tc), since: entry.since });
        await this.tryPair();
        return;
      }
      case 'cancel': {
        this.mm.remove(conn.id);
        this.send(conn, { t: 'cancelled' });
        this.broadcastStats();
        return;
      }
    }
  }

  onClose(conn: Party.Connection): void {
    this.mm.remove(conn.id);
    this.broadcastStats();
  }

  async onAlarm(): Promise<void> {
    await this.tryPair();
  }

  private async tryPair(): Promise<void> {
    const pairs = this.mm.pair(Date.now());
    for (const { a, b } of pairs) {
      const gameId = newGameId();
      const aWhite = Math.random() < 0.5;
      const white = aWhite ? a : b;
      const black = aWhite ? b : a;
      try {
        const res = await this.party.context.parties.game!.get(gameId).fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: partySecret(this.env),
            init: {
              tc: a.tc,
              rated: a.mode === 'ranked',
              mode: a.mode,
              white: white.identity,
              black: black.identity,
            },
          }),
        });
        if (!res.ok) throw new Error(`init ${res.status}`);
        this.activeGames++;
        for (const e of [a, b]) {
          const c = this.party.getConnection(e.connId);
          if (c) this.send(c, { t: 'matched', gameId });
        }
      } catch (e) {
        console.error('[lobby] failed to create game', e);
        for (const e2 of [a, b]) {
          const c = this.party.getConnection(e2.connId);
          if (c) this.send(c, { t: 'error', message: 'Couldn’t start the game — please queue again.' });
        }
      }
    }
    // Keep re-checking while people wait (rating windows widen over time).
    if (this.mm.queue.length) await this.party.storage.setAlarm(Date.now() + 2000);
    this.broadcastStats();
  }

  private stats() {
    let online = 0;
    for (const _ of this.party.getConnections()) online++;
    return { online, queued: this.mm.queue.length, games: this.activeGames };
  }

  private broadcastStats(): void {
    const msg: LobbyServerMessage = { t: 'stats', ...this.stats() };
    this.party.broadcast(JSON.stringify(msg));
  }

  private send(conn: Party.Connection, msg: LobbyServerMessage): void {
    conn.send(JSON.stringify(msg));
  }
}
