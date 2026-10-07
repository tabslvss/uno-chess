import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATING,
  expectedScore,
  formatRating,
  isProvisional,
  previewDeltas,
  rateGame,
  timeControlById,
  TIME_CONTROLS,
  updateRating,
} from '../rating';

describe('Glicko-2', () => {
  it('matches the worked example from Glickman’s paper', () => {
    const r = updateRating({ rating: 1500, rd: 200, vol: 0.06 }, [
      { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('is zero-sum-ish and symmetric for equal players', () => {
    const { white, black } = rateGame(DEFAULT_RATING, DEFAULT_RATING, 1);
    expect(white.rating - 1200).toBeCloseTo(1200 - black.rating, 5);
    expect(white.rating).toBeGreaterThan(1200);
    expect(white.rd).toBeLessThan(350);
  });

  it('a draw between equals changes nothing but RD', () => {
    const { white } = rateGame(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    expect(white.rating).toBeCloseTo(1200, 5);
  });

  it('beating a stronger player is worth more', () => {
    const me = { rating: 1500, rd: 60, vol: 0.06 };
    const strong = { rating: 1800, rd: 60, vol: 0.06 };
    const weak = { rating: 1200, rd: 60, vol: 0.06 };
    const vsStrong = updateRating(me, [{ opponent: strong, score: 1 }]).rating - 1500;
    const vsWeak = updateRating(me, [{ opponent: weak, score: 1 }]).rating - 1500;
    expect(vsStrong).toBeGreaterThan(vsWeak);
    expect(expectedScore(me, strong)).toBeLessThan(0.5);
  });

  it('established ratings move less than provisional ones', () => {
    const opp = { rating: 1500, rd: 60, vol: 0.06 };
    const fresh = updateRating({ rating: 1500, rd: 350, vol: 0.06 }, [{ opponent: opp, score: 1 }]);
    const settled = updateRating({ rating: 1500, rd: 50, vol: 0.06 }, [{ opponent: opp, score: 1 }]);
    expect(fresh.rating - 1500).toBeGreaterThan(settled.rating - 1500);
  });

  it('previews win/draw/loss deltas in order', () => {
    const [w, d, l] = previewDeltas({ rating: 1500, rd: 80, vol: 0.06 }, { rating: 1500, rd: 80, vol: 0.06 });
    expect(w).toBeGreaterThan(0);
    expect(d).toBe(0);
    expect(l).toBeLessThan(0);
  });

  it('marks provisional ratings', () => {
    expect(isProvisional(DEFAULT_RATING)).toBe(true);
    expect(formatRating(DEFAULT_RATING)).toBe('1200?');
    expect(formatRating({ rating: 1534.6, rd: 60 })).toBe('1535');
  });

  it('inactivity grows RD but caps at 350', () => {
    expect(updateRating({ rating: 1500, rd: 340, vol: 0.06 }, []).rd).toBeLessThanOrEqual(350);
    expect(updateRating({ rating: 1500, rd: 50, vol: 0.06 }, []).rd).toBeGreaterThan(50);
  });
});

describe('time controls', () => {
  it('falls back to the default', () => {
    expect(timeControlById('nope').id).toBe('5+3');
    expect(new Set(TIME_CONTROLS.map((t) => t.id)).size).toBe(TIME_CONTROLS.length);
  });
});
