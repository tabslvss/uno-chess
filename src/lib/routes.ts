/** Client-side routes (Vercel SPA rewrites all paths to index.html). */

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'join'; roomId: string }
  | { kind: 'game'; roomId: string }
  | { kind: 'queue' };

const PENDING_JOIN_KEY = 'unochess-pending-join';
const PENDING_REJOIN_KEY = 'unochess-pending-rejoin';

export function parsePath(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  const join = path.match(/^\/join\/([A-Za-z0-9]{4,8})$/i);
  if (join) return { kind: 'join', roomId: join[1]!.toUpperCase() };
  const game = path.match(/^\/game\/([A-Za-z0-9]{4,8})$/i);
  if (game) return { kind: 'game', roomId: game[1]!.toUpperCase() };
  if (path === '/queue' || path === '/matchmaking') return { kind: 'queue' };
  return { kind: 'home' };
}

export function pathFor(route: AppRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'join':
      return `/join/${route.roomId}`;
    case 'game':
      return `/game/${route.roomId}`;
    case 'queue':
      return '/queue';
  }
}

export function gameShareUrl(roomId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/game/${roomId.toUpperCase()}`;
}

export function joinShareUrl(roomId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${roomId.toUpperCase()}`;
}

export function navigateTo(route: AppRoute, replace = false): void {
  const next = pathFor(route);
  if (window.location.pathname === next) return;
  if (replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);
}

export function stashPendingJoinCode(code: string): void {
  sessionStorage.setItem(PENDING_JOIN_KEY, code.toUpperCase());
}

export function takePendingJoinCode(): string | null {
  const v = sessionStorage.getItem(PENDING_JOIN_KEY);
  if (v) sessionStorage.removeItem(PENDING_JOIN_KEY);
  return v;
}

export function stashPendingRejoinRoom(roomId: string): void {
  sessionStorage.setItem(PENDING_REJOIN_KEY, roomId.toUpperCase());
}

export function takePendingRejoinRoom(): string | null {
  const v = sessionStorage.getItem(PENDING_REJOIN_KEY);
  if (v) sessionStorage.removeItem(PENDING_REJOIN_KEY);
  return v;
}

export function onPopState(handler: () => void): () => void {
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
