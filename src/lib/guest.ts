const ID_KEY = 'unochess-guest-id';
const NAME_KEY = 'unochess-guest-name';
const AVATAR_KEY = 'unochess-guest-avatar';

import { isAvatarUrl, randomAvatar } from './avatar';

const ADJ = ['Cozy', 'Sleepy', 'Lucky', 'Brave', 'Witty', 'Mellow', 'Sunny', 'Quiet', 'Clever', 'Merry', 'Snug', 'Plucky'];
const NOUN = ['Rook', 'Knight', 'Bishop', 'Pawn', 'Queen', 'Joker', 'Wildcard', 'Teacup', 'Biscuit', 'Fox', 'Otter', 'Owl'];

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — keep in memory only */
  }
}

let memoId: string | null = null;

/** Private per-browser id that identifies a guest to the game server. Never shown to others. */
export function guestId(): string {
  const existing = memoId ?? safeGet(ID_KEY);
  if (existing && existing.length >= 8) return (memoId = existing);
  const id = crypto.randomUUID();
  memoId = id;
  safeSet(ID_KEY, id);
  return id;
}

export function randomGuestName(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)]!;
  const n = NOUN[Math.floor(Math.random() * NOUN.length)]!;
  return `${a}${n}${Math.floor(Math.random() * 90 + 10)}`;
}

export function guestName(): string {
  const existing = safeGet(NAME_KEY);
  if (existing) return existing;
  const name = randomGuestName();
  safeSet(NAME_KEY, name);
  return name;
}

export function setGuestName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  const finalName = cleaned.length >= 2 ? cleaned : guestName();
  safeSet(NAME_KEY, finalName);
  return finalName;
}

/** Guests get a random avatar on their first visit; it sticks until they change it. */
export function guestAvatar(): string {
  const existing = safeGet(AVATAR_KEY);
  if (isAvatarUrl(existing)) return existing;
  const url = randomAvatar();
  safeSet(AVATAR_KEY, url);
  return url;
}

export function setGuestAvatar(url: string): string {
  if (!isAvatarUrl(url)) return guestAvatar();
  safeSet(AVATAR_KEY, url);
  return url;
}
