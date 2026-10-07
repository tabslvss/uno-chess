import { describe, expect, it } from 'vitest';
import type { Identity } from './gameRoom.ts';
import { Matchmaker, ratingWindow } from './matchmaker.ts';

const user = (name: string, rating = 1200, guest = false): Identity => ({
  key: `${guest ? 'guest' : 'user'}:${name}`,
  publicId: name,
  name,
  guest,
  userId: guest ? null : name,
  ratings: { blitz: { rating, rd: 80, vol: 0.06 } },
});

describe('Matchmaker', () => {
  it('pairs two casual players with the same time control', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a'), 'casual', '5+3', 0);
    mm.enqueue('c2', user('b', 1200, true), 'casual', '5+3', 0);
    const pairs = mm.pair(0);
    expect(pairs).toHaveLength(1);
    expect(mm.queue).toHaveLength(0);
  });

  it('does not mix modes or time controls', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a'), 'casual', '5+3', 0);
    mm.enqueue('c2', user('b'), 'ranked', '5+3', 0);
    mm.enqueue('c3', user('c'), 'casual', '1+0', 0);
    expect(mm.pair(0)).toHaveLength(0);
  });

  it('never pairs an identity with itself (two tabs)', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a'), 'casual', '5+3', 0);
    mm.enqueue('c2', user('a'), 'casual', '5+3', 0);
    expect(mm.queue).toHaveLength(1);
    expect(mm.pair(0)).toHaveLength(0);
  });

  it('ranked requires an account', () => {
    const mm = new Matchmaker();
    expect(mm.enqueue('c1', user('g', 1200, true), 'ranked', '5+3', 0)).toMatch(/Log in/);
  });

  it('ranked respects a widening rating window', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a', 1200), 'ranked', '5+3', 0);
    mm.enqueue('c2', user('b', 1700), 'ranked', '5+3', 0);
    expect(mm.pair(1000)).toHaveLength(0);
    expect(mm.pair(50_000)).toHaveLength(1);
  });

  it('prefers the closest rating', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a', 1200), 'ranked', '5+3', 0);
    mm.enqueue('c2', user('b', 1290), 'ranked', '5+3', 1);
    mm.enqueue('c3', user('c', 1210), 'ranked', '5+3', 2);
    const [p] = mm.pair(10);
    expect(p!.b.identity.name).toBe('c');
    expect(mm.queue.map((e) => e.identity.name)).toEqual(['b']);
  });

  it('removing a connection leaves the queue', () => {
    const mm = new Matchmaker();
    mm.enqueue('c1', user('a'), 'casual', '5+3', 0);
    expect(mm.remove('c1')).toBe(true);
    expect(mm.remove('c1')).toBe(false);
  });

  it('window grows with time', () => {
    expect(ratingWindow(0)).toBe(100);
    expect(ratingWindow(10_000)).toBe(250);
    expect(ratingWindow(60_000)).toBe(Infinity);
  });
});
