/** Small deterministic PRNG (mulberry32). State is a single uint32 so it serializes into GameState. */
export function nextRandom(state: number): [value: number, next: number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Fisher–Yates shuffle driven by the deterministic RNG. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: number): [T[], number] {
  const a = [...items];
  let s = rng;
  for (let i = a.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s);
    s = n;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return [a, s];
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}
