/** Where the PartyKit server lives. Empty env → same origin (Vite proxies /parties in dev). */
export function partyHost(): string | null {
  const configured = import.meta.env.VITE_PARTYKIT_HOST?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV) return window.location.host;
  return null;
}

export const onlineEnabled = () => partyHost() !== null;

export function partyHttpUrl(path: string): string | null {
  const host = partyHost();
  if (!host) return null;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || host.startsWith('192.168.');
  return `${local ? 'http' : 'https'}://${host}${path}`;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
