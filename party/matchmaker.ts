import { DEFAULT_RATING, timeControlById } from '../src/game/rating.ts';
import type { Identity } from './gameRoom.ts';

export type QueueMode = 'casual' | 'ranked';

export interface QueueEntry {
  connId: string;
  identity: Identity;
  mode: QueueMode;
  tc: string;
  rating: number;
  since: number;
}

export interface Pairing {
  a: QueueEntry;
  b: QueueEntry;
}

/** Rating window for ranked matching: starts tight and widens the longer you wait. */
export function ratingWindow(waitedMs: number): number {
  const s = waitedMs / 1000;
  if (s >= 45) return Infinity;
  return 100 + s * 15;
}

export class Matchmaker {
  queue: QueueEntry[] = [];

  enqueue(connId: string, identity: Identity, mode: QueueMode, tcId: string, now: number): string | null {
    if (mode === 'ranked' && identity.guest) return 'Log in to play ranked games.';
    const tc = timeControlById(tcId);
    // One queue entry per identity (a second tab replaces the first).
    this.queue = this.queue.filter((e) => e.identity.key !== identity.key && e.connId !== connId);
    this.queue.push({
      connId,
      identity,
      mode,
      tc: tc.id,
      rating: (identity.ratings[tc.category] ?? DEFAULT_RATING).rating,
      since: now,
    });
    return null;
  }

  remove(connId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.connId !== connId);
    return this.queue.length !== before;
  }

  entryFor(connId: string): QueueEntry | undefined {
    return this.queue.find((e) => e.connId === connId);
  }

  /** Pair everyone who can be paired right now (oldest first). */
  pair(now: number): Pairing[] {
    const pairs: Pairing[] = [];
    const pool = [...this.queue].sort((x, y) => x.since - y.since);
    const taken = new Set<string>();
    for (const a of pool) {
      if (taken.has(a.connId)) continue;
      let best: QueueEntry | null = null;
      let bestDiff = Infinity;
      for (const b of pool) {
        if (b === a || taken.has(b.connId)) continue;
        if (b.mode !== a.mode || b.tc !== a.tc) continue;
        if (b.identity.key === a.identity.key) continue;
        const diff = Math.abs(a.rating - b.rating);
        if (a.mode === 'ranked') {
          const window = ratingWindow(now - Math.min(a.since, b.since));
          if (diff > window) continue;
        }
        if (diff < bestDiff) {
          best = b;
          bestDiff = diff;
        }
      }
      if (best) {
        taken.add(a.connId);
        taken.add(best.connId);
        pairs.push({ a, b: best });
      }
    }
    this.queue = this.queue.filter((e) => !taken.has(e.connId));
    return pairs;
  }

  sizeFor(mode: QueueMode, tc: string): number {
    return this.queue.filter((e) => e.mode === mode && e.tc === tc).length;
  }
}
