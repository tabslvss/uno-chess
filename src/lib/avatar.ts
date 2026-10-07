/**
 * Player avatars from the public DiceBear API (https://www.dicebear.com).
 *
 * An avatar is stored as a canonical URL: `https://api.dicebear.com/9.x/adventurer/svg?seed=<seed>`.
 * Only these URLs are accepted (client, game server and database all validate it),
 * so players can't point their avatar at arbitrary images.
 */

/** We use a single, consistent illustration style for every player. */
export const AVATAR_STYLES = [{ id: 'adventurer', label: 'Adventurer' }] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]['id'];

const STYLE_IDS = new Set<string>(AVATAR_STYLES.map((s) => s.id));
const BASE = 'https://api.dicebear.com/9.x';
export const AVATAR_URL_RE = /^https:\/\/api\.dicebear\.com\/9\.x\/(adventurer)\/svg\?seed=([A-Za-z0-9_-]{1,64})$/;

/** Soft backgrounds applied when rendering (not stored). */
const BACKGROUNDS = 'e3e1de,d6e7c8,d3e3f2,f2d9d1,f1e3c4';

export function avatarUrl(style: AvatarStyle, seed: string): string {
  return `${BASE}/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function parseAvatar(url: string | null | undefined): { style: AvatarStyle; seed: string } | null {
  const m = url ? AVATAR_URL_RE.exec(url) : null;
  if (!m || !STYLE_IDS.has(m[1]!)) return null;
  return { style: m[1] as AvatarStyle, seed: m[2]! };
}

export const isAvatarUrl = (url: string | null | undefined): url is string => parseAvatar(url) !== null;

export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return [...bytes].map((b) => (b % 36).toString(36)).join('');
}

/** A brand-new random avatar, optionally in a given style. */
export function randomAvatar(style?: AvatarStyle): string {
  const s = style ?? AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]!.id;
  return avatarUrl(s, randomSeed());
}

/** URL to put in an <img>: the stored avatar with display options, or a deterministic fallback for `seed`. */
export function avatarSrc(seed: string, url?: string | null): string {
  const parsed = parseAvatar(url);
  const base = parsed ? avatarUrl(parsed.style, parsed.seed) : avatarUrl('adventurer', seed.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'player');
  return `${base}&radius=20&backgroundColor=${BACKGROUNDS}`;
}

/** Non-DiceBear avatar images we ship ourselves (bots). */
export function isLocalAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith('/bots/');
}
