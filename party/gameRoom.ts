/**
 * Authoritative game room logic, independent of PartyKit so it can be unit tested
 * with a fake clock. The PartyKit adapter (game.ts) wires it to sockets/storage.
 */
import { applyAction, createGame, forceResult, viewFor } from '../src/game/engine.ts';
import { other } from '../src/game/board.ts';
import { DEFAULT_RATING, timeControlById, type Rating, type TimeCategory } from '../src/game/rating.ts';
import type { GameAction, GameState, Side } from '../src/game/types.ts';
import type { ClockSnapshot, PublicPlayer, RatingChange, RoomSnapshot } from '../src/net/protocol.ts';

/** Time to make your first move before the game is aborted. */
export const FIRST_MOVE_MS = 30_000;
/** Disconnected this long (while the opponent is present) = loss by abandonment. */
export const ABANDON_MS = 60_000;
/** Minimum completed turns between two draw offers from the same player. */
export const DRAW_OFFER_COOLDOWN_TURNS = 4;
export const CHAT_COOLDOWN_MS = 1200;

export interface Identity {
  /** Internal identity key: `user:<uuid>` or `guest:<secret>`. Never sent to clients. */
  key: string;
  publicId: string;
  name: string;
  guest: boolean;
  userId: string | null;
  avatarUrl?: string | null;
  ratings: Partial<Record<TimeCategory, Rating>>;
}

interface Seat {
  id: Identity;
  connections: number;
  disconnectedAt: number | null;
  lastChatAt: number;
  lastOfferTurn: number;
}

export type RoomMode = 'private' | 'casual' | 'ranked';

export interface RoomInit {
  tc: string;
  rated: boolean;
  mode: RoomMode;
  /** Pre-assigned seats (matchmaking). */
  white?: Identity;
  black?: Identity;
  /** Creator of a private room and their colour preference. */
  creator?: Identity;
  creatorColor?: Side | 'random';
}

export type RoomEvent = { type: 'gameOver'; gameNo: number } | { type: 'started'; gameNo: number };

export interface RoomData {
  id: string;
  gameNo: number;
  tc: string;
  rated: boolean;
  mode: RoomMode;
  status: 'empty' | 'waiting' | 'playing' | 'over';
  seats: { w: Seat | null; b: Seat | null };
  /** Identities allowed to take a seat (matchmaking) — key → side. */
  reserved: Record<string, Side>;
  creatorColor: Side | 'random';
  state: GameState | null;
  remaining: { w: number; b: number };
  turnStartedAt: number;
  firstMoveDeadline: number | null;
  drawOffer: Side | null;
  rematch: { w: boolean; b: boolean };
  ratingChange: RatingChange | null;
  spectators: number;
  createdAt: number;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export class GameRoom {
  data: RoomData;
  private random: () => number;

  constructor(id: string, now: number, random: () => number = Math.random, data?: RoomData) {
    this.random = random;
    this.data = data ?? {
      id,
      gameNo: 0,
      tc: '5+3',
      rated: false,
      mode: 'private',
      status: 'empty',
      seats: { w: null, b: null },
      reserved: {},
      creatorColor: 'random',
      state: null,
      remaining: { w: 0, b: 0 },
      turnStartedAt: now,
      firstMoveDeadline: null,
      drawOffer: null,
      rematch: { w: false, b: false },
      ratingChange: null,
      spectators: 0,
      createdAt: now,
    };
  }

  get tc() {
    return timeControlById(this.data.tc);
  }

  get initialized(): boolean {
    return this.data.status !== 'empty';
  }

  init(opts: RoomInit, now: number): RoomEvent[] {
    const d = this.data;
    if (this.initialized) return [];
    d.tc = timeControlById(opts.tc).id;
    d.rated = opts.rated;
    d.mode = opts.mode;
    d.status = 'waiting';
    d.creatorColor = opts.creatorColor ?? 'random';
    if (opts.white && opts.black) {
      d.reserved = { [opts.white.key]: 'w', [opts.black.key]: 'b' };
      d.seats.w = this.newSeat(opts.white, 0);
      d.seats.b = this.newSeat(opts.black, 0);
      return this.start(now);
    }
    if (opts.creator) {
      const side: Side = d.creatorColor === 'random' ? (this.random() < 0.5 ? 'w' : 'b') : d.creatorColor;
      d.seats[side] = this.newSeat(opts.creator, 0);
    }
    return [];
  }

  private newSeat(id: Identity, connections: number): Seat {
    return { id, connections, disconnectedAt: null, lastChatAt: 0, lastOfferTurn: -99 };
  }

  sideOf(key: string): Side | null {
    if (this.data.seats.w?.id.key === key) return 'w';
    if (this.data.seats.b?.id.key === key) return 'b';
    return null;
  }

  /** A connection for `id` arrived. Returns the seat they occupy (or null = spectator). */
  connect(id: Identity, now: number): Result<{ side: Side | null; events: RoomEvent[] }> {
    const d = this.data;
    if (!this.initialized) return { ok: false, error: 'This game doesn’t exist.' };
    let side = this.sideOf(id.key);
    let events: RoomEvent[] = [];
    if (!side && d.status === 'waiting' && Object.keys(d.reserved).length === 0) {
      const free: Side | null = !d.seats.w ? 'w' : !d.seats.b ? 'b' : null;
      if (free) {
        if (d.rated && id.guest) {
          d.spectators++;
          return { ok: true, side: null, events };
        }
        d.seats[free] = this.newSeat(id, 0);
        side = free;
        if (d.seats.w && d.seats.b) events = this.start(now);
      }
    }
    if (side) {
      const seat = d.seats[side]!;
      seat.connections++;
      seat.disconnectedAt = null;
      // Refresh display info (name/rating may have changed).
      seat.id = { ...seat.id, name: id.name, avatarUrl: id.avatarUrl, ratings: id.ratings };
    } else d.spectators++;
    return { ok: true, side, events };
  }

  disconnect(key: string | null, now: number): void {
    const side = key ? this.sideOf(key) : null;
    if (!side) {
      this.data.spectators = Math.max(0, this.data.spectators - 1);
      return;
    }
    const seat = this.data.seats[side]!;
    seat.connections = Math.max(0, seat.connections - 1);
    if (seat.connections === 0) seat.disconnectedAt = now;
  }

  private start(now: number): RoomEvent[] {
    const d = this.data;
    d.gameNo++;
    d.status = 'playing';
    d.state = createGame({ seed: Math.floor(this.random() * 2 ** 32) });
    d.remaining = { w: this.tc.initial * 1000, b: this.tc.initial * 1000 };
    d.turnStartedAt = now;
    d.firstMoveDeadline = now + FIRST_MOVE_MS;
    d.drawOffer = null;
    d.rematch = { w: false, b: false };
    d.ratingChange = null;
    for (const s of ['w', 'b'] as Side[]) if (d.seats[s]) d.seats[s]!.lastOfferTurn = -99;
    return [{ type: 'started', gameNo: d.gameNo }];
  }

  /** The clock only runs once both players have completed their first turn. */
  private clockRunning(): boolean {
    const s = this.data.state;
    return this.data.status === 'playing' && !!s && s.turnCount >= 2;
  }

  private activeSide(): Side | null {
    return this.data.status === 'playing' && this.data.state ? this.data.state.turn : null;
  }

  /** Remaining ms for each side at `now`. */
  remainingAt(now: number): { w: number; b: number } {
    const r = { ...this.data.remaining };
    const active = this.activeSide();
    if (active && this.clockRunning()) r[active] = r[active] - (now - this.data.turnStartedAt);
    return r;
  }

  private finish(next: GameState): RoomEvent[] {
    const d = this.data;
    d.state = next;
    d.status = 'over';
    d.firstMoveDeadline = null;
    d.drawOffer = null;
    return [{ type: 'gameOver', gameNo: d.gameNo }];
  }

  /** Apply time-based rules: flag fall, first-move abort, abandonment. */
  tick(now: number): RoomEvent[] {
    const d = this.data;
    if (d.status !== 'playing' || !d.state) return [];
    const active = d.state.turn;
    if (d.firstMoveDeadline !== null && now >= d.firstMoveDeadline) {
      return this.finish(forceResult(d.state, null, 'aborted'));
    }
    if (this.clockRunning()) {
      const r = this.remainingAt(now);
      if (r[active] <= 0) {
        d.remaining = { ...r, [active]: 0 };
        return this.finish(forceResult(d.state, other(active), 'timeout'));
      }
    }
    for (const side of ['w', 'b'] as Side[]) {
      const seat = d.seats[side];
      const opp = d.seats[other(side)];
      if (seat?.disconnectedAt != null && opp && opp.connections > 0 && now - seat.disconnectedAt >= ABANDON_MS) {
        this.chargeClock(now);
        return this.finish(forceResult(d.state, other(side), 'abandon'));
      }
    }
    return [];
  }

  /** Earliest time something time-based could happen (for the server alarm). */
  nextDeadline(now: number): number | null {
    const d = this.data;
    if (d.status !== 'playing' || !d.state) return null;
    const times: number[] = [];
    if (d.firstMoveDeadline !== null) times.push(d.firstMoveDeadline);
    if (this.clockRunning()) times.push(now + Math.max(0, this.remainingAt(now)[d.state.turn]));
    for (const side of ['w', 'b'] as Side[]) {
      const seat = d.seats[side];
      if (seat?.disconnectedAt != null) times.push(seat.disconnectedAt + ABANDON_MS);
    }
    return times.length ? Math.min(...times) : null;
  }

  private chargeClock(now: number): void {
    const active = this.activeSide();
    if (active && this.clockRunning()) {
      this.data.remaining[active] -= now - this.data.turnStartedAt;
    }
    this.data.turnStartedAt = now;
  }

  act(key: string, action: GameAction, now: number): Result<{ events: RoomEvent[] }> {
    const d = this.data;
    const side = this.sideOf(key);
    if (!side) return { ok: false, error: 'You are spectating this game.' };
    if (d.status !== 'playing' || !d.state) return { ok: false, error: 'The game isn’t in progress.' };

    // Flag check before anything else.
    const flagged = this.tick(now);
    if (flagged.length) return { ok: true, events: flagged };

    const before = d.state;
    const res = applyAction(before, side, action);
    if (!res.ok) return { ok: false, error: res.error };
    const next = res.state;

    const turnChanged = next.turn !== before.turn || next.turnCount !== before.turnCount;
    if (turnChanged || next.result) {
      const wasRunning = this.clockRunning();
      this.chargeClock(now);
      if (wasRunning && !next.result && next.turnCount !== before.turnCount) {
        d.remaining[before.turn] += this.tc.increment * 1000;
      }
      d.drawOffer = null;
    }
    d.state = next;
    if (next.result) return { ok: true, events: this.finish(next) };
    if (turnChanged) {
      d.turnStartedAt = now;
      d.firstMoveDeadline = next.turnCount < 2 ? now + FIRST_MOVE_MS : null;
    }
    return { ok: true, events: [] };
  }

  offerDraw(key: string): Result {
    const d = this.data;
    const side = this.sideOf(key);
    if (!side || d.status !== 'playing' || !d.state) return { ok: false, error: 'You can’t offer a draw now.' };
    if (d.drawOffer === other(side)) return { ok: false, error: 'Your opponent already offered a draw.' };
    if (d.drawOffer === side) return { ok: false, error: 'Draw already offered.' };
    const seat = d.seats[side]!;
    if (d.state.turnCount - seat.lastOfferTurn < DRAW_OFFER_COOLDOWN_TURNS) {
      return { ok: false, error: 'Wait a few turns before offering again.' };
    }
    seat.lastOfferTurn = d.state.turnCount;
    d.drawOffer = side;
    return { ok: true };
  }

  answerDraw(key: string, accept: boolean, now: number): Result<{ events: RoomEvent[] }> {
    const d = this.data;
    const side = this.sideOf(key);
    if (!side || !d.state || d.status !== 'playing' || d.drawOffer !== other(side)) {
      return { ok: false, error: 'There’s no draw offer to answer.' };
    }
    d.drawOffer = null;
    if (!accept) return { ok: true, events: [] };
    this.chargeClock(now);
    return { ok: true, events: this.finish(forceResult(d.state, null, 'agreement')) };
  }

  abort(key: string, now: number): Result<{ events: RoomEvent[] }> {
    const d = this.data;
    const side = this.sideOf(key);
    if (!side) return { ok: false, error: 'Only players can abort.' };
    if (d.status === 'waiting') {
      // Creator cancels their own open challenge.
      d.seats[side] = null;
      d.status = 'over';
      return { ok: true, events: [] };
    }
    if (d.status !== 'playing' || !d.state) return { ok: false, error: 'The game isn’t in progress.' };
    if (d.state.turnCount >= 2) return { ok: false, error: 'Too late to abort — resign instead.' };
    this.chargeClock(now);
    return { ok: true, events: this.finish(forceResult(d.state, null, 'aborted')) };
  }

  rematch(key: string, want: boolean, now: number): Result<{ events: RoomEvent[] }> {
    const d = this.data;
    const side = this.sideOf(key);
    if (!side || d.status !== 'over' || !d.state) return { ok: false, error: 'No finished game to rematch.' };
    if (!d.seats.w || !d.seats.b) return { ok: false, error: 'Your opponent left.' };
    d.rematch[side] = want;
    if (!(d.rematch.w && d.rematch.b)) return { ok: true, events: [] };
    // Swap colours.
    const w = d.seats.w;
    d.seats.w = d.seats.b;
    d.seats.b = w;
    if (Object.keys(d.reserved).length) d.reserved = { [d.seats.w.id.key]: 'w', [d.seats.b.id.key]: 'b' };
    return { ok: true, events: this.start(now) };
  }

  chat(key: string, now: number): Result<{ side: Side; name: string }> {
    const side = this.sideOf(key);
    if (!side) return { ok: false, error: 'Spectators can’t chat.' };
    const seat = this.data.seats[side]!;
    if (now - seat.lastChatAt < CHAT_COOLDOWN_MS) return { ok: false, error: 'Slow down a little 🙂' };
    seat.lastChatAt = now;
    return { ok: true, side, name: seat.id.name };
  }

  setRatingChange(change: RatingChange, newRatings: { w: Rating; b: Rating }): void {
    const d = this.data;
    d.ratingChange = change;
    const cat = this.tc.category;
    for (const side of ['w', 'b'] as Side[]) {
      const seat = d.seats[side];
      if (seat) seat.id = { ...seat.id, ratings: { ...seat.id.ratings, [cat]: newRatings[side] } };
    }
  }

  private publicPlayer(side: Side): PublicPlayer | null {
    const seat = this.data.seats[side];
    if (!seat) return null;
    const cat = this.tc.category;
    return {
      name: seat.id.name,
      publicId: seat.id.publicId,
      guest: seat.id.guest,
      rating: seat.id.guest ? null : (seat.id.ratings[cat] ?? DEFAULT_RATING),
      connected: seat.connections > 0,
      avatarUrl: seat.id.avatarUrl ?? null,
    };
  }

  snapshot(key: string | null, now: number): RoomSnapshot {
    const d = this.data;
    const you = key ? this.sideOf(key) : null;
    const remaining = this.remainingAt(now);
    const clock: ClockSnapshot = {
      w: Math.max(0, remaining.w),
      b: Math.max(0, remaining.b),
      running: this.clockRunning() ? d.state!.turn : null,
      firstMoveMs: d.firstMoveDeadline !== null ? Math.max(0, d.firstMoveDeadline - now) : null,
    };
    return {
      id: d.id,
      gameNo: d.gameNo,
      tc: d.tc,
      category: this.tc.category,
      rated: d.rated,
      mode: d.mode,
      status: d.status === 'empty' ? 'waiting' : d.status,
      players: { w: this.publicPlayer('w'), b: this.publicPlayer('b') },
      you,
      state: d.state ? viewFor(d.state, you) : null,
      clock,
      drawOffer: d.drawOffer,
      rematch: d.rematch,
      ratingChange: d.ratingChange,
      result: d.state?.result ?? null,
      spectators: d.spectators,
    };
  }
}
