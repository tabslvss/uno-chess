/**
 * Glicko-2 rating system (Glickman, 2012) — the same family of rating system
 * chess.com uses. Ratings are kept on the Glicko scale (1500-centred), with a
 * per-player rating deviation (RD) and volatility.
 */

export interface Rating {
  rating: number;
  rd: number;
  vol: number;
}

export const DEFAULT_RATING: Rating = { rating: 1200, rd: 350, vol: 0.06 };
export const MIN_RD = 45;
export const MAX_RD = 350;
/** Ratings with RD above this are shown as provisional ("1200?"). */
export const PROVISIONAL_RD = 110;

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

export interface GameOutcome {
  opponent: Rating;
  /** 1 win, 0.5 draw, 0 loss */
  score: number;
}

/** Update a rating after a rating period containing `games` (often a single game). */
export function updateRating(player: Rating, games: GameOutcome[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (games.length === 0) {
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol);
    return { ...player, rd: clampRd(phiStar * SCALE) };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const { opponent, score } of games) {
    const muj = (opponent.rating - 1500) / SCALE;
    const phij = opponent.rd / SCALE;
    const e = E(mu, muj, phij);
    vInv += g(phij) ** 2 * e * (1 - e);
    deltaSum += g(phij) * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Volatility via the Illinois algorithm.
  const a = Math.log(player.vol ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta ** 2 - phi ** 2 - v - ex)) / (2 * (phi ** 2 + v + ex) ** 2) - (x - a) / TAU ** 2;
  };
  let A = a;
  let B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPS; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi ** 2 + vol ** 2);
  const phiNew = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muNew = mu + phiNew ** 2 * deltaSum;
  return {
    rating: muNew * SCALE + 1500,
    rd: clampRd(phiNew * SCALE),
    vol,
  };
}

function clampRd(rd: number): number {
  return Math.min(MAX_RD, Math.max(MIN_RD, rd));
}

/** Rate a single game between two players; returns both new ratings. */
export function rateGame(white: Rating, black: Rating, whiteScore: number): { white: Rating; black: Rating } {
  return {
    white: updateRating(white, [{ opponent: black, score: whiteScore }]),
    black: updateRating(black, [{ opponent: white, score: 1 - whiteScore }]),
  };
}

/** Expected score of a vs b (for "win/draw/lose" previews like chess.com). */
export function expectedScore(a: Rating, b: Rating): number {
  const mu = (a.rating - 1500) / SCALE;
  const muj = (b.rating - 1500) / SCALE;
  const phij = Math.sqrt((a.rd / SCALE) ** 2 + (b.rd / SCALE) ** 2);
  return E(mu, muj, phij);
}

/** Rating change preview: [win, draw, loss] deltas for `me` against `opp`. */
export function previewDeltas(me: Rating, opp: Rating): [number, number, number] {
  return [1, 0.5, 0].map((s) => Math.round(updateRating(me, [{ opponent: opp, score: s }]).rating - me.rating)) as [
    number,
    number,
    number,
  ];
}

export function isProvisional(r: Pick<Rating, 'rd'>): boolean {
  return r.rd > PROVISIONAL_RD;
}

export function formatRating(r: Pick<Rating, 'rating' | 'rd'>): string {
  return `${Math.round(r.rating)}${isProvisional(r) ? '?' : ''}`;
}

// ─────────────────────────── time controls ───────────────────────────

export type TimeCategory = 'bullet' | 'blitz' | 'rapid';

export interface TimeControl {
  id: string;
  /** Initial time in seconds. */
  initial: number;
  /** Increment per turn in seconds. */
  increment: number;
  label: string;
  category: TimeCategory;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: '1+0', initial: 60, increment: 0, label: '1 min', category: 'bullet' },
  { id: '2+1', initial: 120, increment: 1, label: '2 | 1', category: 'bullet' },
  { id: '3+0', initial: 180, increment: 0, label: '3 min', category: 'blitz' },
  { id: '3+2', initial: 180, increment: 2, label: '3 | 2', category: 'blitz' },
  { id: '5+0', initial: 300, increment: 0, label: '5 min', category: 'blitz' },
  { id: '5+3', initial: 300, increment: 3, label: '5 | 3', category: 'blitz' },
  { id: '10+0', initial: 600, increment: 0, label: '10 min', category: 'rapid' },
  { id: '15+10', initial: 900, increment: 10, label: '15 | 10', category: 'rapid' },
  { id: '30+0', initial: 1800, increment: 0, label: '30 min', category: 'rapid' },
];

export const DEFAULT_TIME_CONTROL = '5+3';

export function timeControlById(id: string | null | undefined): TimeControl {
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS.find((t) => t.id === DEFAULT_TIME_CONTROL)!;
}

export const CATEGORIES: TimeCategory[] = ['bullet', 'blitz', 'rapid'];
