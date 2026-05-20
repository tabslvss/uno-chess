import { io, type Socket } from 'socket.io-client';
import type { GameAction, GameState, Player, GameResult } from '../game/types';
import { supabase } from '../lib/supabase';

const URL = import.meta.env.VITE_SERVER_URL ?? '';
const ACK_TIMEOUT_MS = 12_000;
const CONNECT_TIMEOUT_MS = 25_000;
const CONNECT_RETRIES = 8;
const RETRY_DELAY_MS = 600;

let socket: Socket | null = null;
let warmPromise: Promise<boolean> | null = null;
let preconnectPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function healthUrl(): string {
  return URL ? `${URL.replace(/\/$/, '')}/health` : '/health';
}

async function pingHealthOnce(timeoutMs = 8_000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(healthUrl(), {
      signal: ctrl.signal,
      mode: 'cors',
      credentials: 'omit',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Wake Render / verify API — safe to call repeatedly. */
export function warmGameServer(force = false): Promise<boolean> {
  if (!URL && import.meta.env.PROD) return Promise.resolve(false);
  if (force) warmPromise = null;
  warmPromise ??= (async () => {
    for (let i = 0; i < 4; i++) {
      if (await pingHealthOnce(i === 0 ? 6_000 : 12_000)) return true;
      if (i < 3) await sleep(1_500);
    }
    return false;
  })();
  return warmPromise;
}

/** Keep API warm while the tab is open (Render free tier sleeps after ~15 min idle). */
export function startServerKeepAlive(): () => void {
  void warmGameServer();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void warmGameServer(true);
  };
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => void warmGameServer(true), 8 * 60 * 1000);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}

async function accessToken(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not logged in');
  return token;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2_000,
      timeout: CONNECT_TIMEOUT_MS,
    });
  }
  return socket;
}

function connectOnce(token: string): Promise<void> {
  const s = getSocket();
  s.auth = { token };

  if (s.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;

    const onConnect = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      s.disconnect();
      reject(err);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      s.disconnect();
      reject(new Error('Connection timed out'));
    }, CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      s.off('connect', onConnect);
      s.off('connect_error', onError);
    };

    s.on('connect', onConnect);
    s.on('connect_error', onError);
    s.connect();
  });
}

function connectionError(err: unknown): Error {
  if (!URL && import.meta.env.PROD) {
    return new Error(
      'Online play is not set up yet. Add VITE_SERVER_URL on Vercel (see HOSTING.md).',
    );
  }
  if (!URL) {
    return new Error('Game server is not running. Run: npm run dev');
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('not logged in')) {
    return new Error('Not logged in');
  }
  return new Error('Connecting… try again in a moment.');
}

/** Connect in background after login so Play is instant. */
export function preconnectSocket(): Promise<void> {
  if (!preconnectPromise) {
    preconnectPromise = (async () => {
      try {
        const token = await accessToken();
        void warmGameServer();
        await connectOnce(token);
      } catch {
        // Not logged in or server down — connectSocket will retry on Play
      }
    })().finally(() => {
      preconnectPromise = null;
    });
  }
  return preconnectPromise;
}

export async function connectSocket(): Promise<void> {
  const token = await accessToken();
  const s = getSocket();

  if (s.connected) {
    s.auth = { token };
    return;
  }

  void warmGameServer();

  let lastErr: unknown;
  for (let attempt = 0; attempt < CONNECT_RETRIES; attempt++) {
    try {
      await connectOnce(token);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < CONNECT_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        void warmGameServer(true);
      }
    }
  }
  throw connectionError(lastErr);
}

function emitWithAck<T>(event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s.connected) {
      reject(new Error('Not connected to the game server.'));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Server didn’t respond. Try again.'));
    }, ACK_TIMEOUT_MS);

    s.emit(event, ...args, (res: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export async function createRoom(): Promise<{
  roomId: string;
  color: Player;
  state: GameState;
}> {
  const res = await emitWithAck<
    { roomId: string; color: Player; state: GameState } | { error: string }
  >('createRoom');
  if ('error' in res) throw new Error(res.error);
  if (!res?.roomId) throw new Error('Failed to create room.');
  return res;
}

export async function joinRoom(
  roomId: string,
): Promise<{ roomId: string; color: Player; state: GameState }> {
  const code = roomId.trim().toUpperCase();
  if (!code) throw new Error('Enter a room code.');
  const res = await emitWithAck<
    { roomId: string; color: Player; state: GameState } | { error: string }
  >('joinRoom', code);
  if ('error' in res) throw new Error(res.error);
  if (!res?.roomId) throw new Error('Failed to join room.');
  return res;
}

export interface FindMatchResult {
  ok: boolean;
  roomId?: string;
  color?: Player;
  state?: GameState;
  queued?: boolean;
  error?: string;
}

export async function findMatch(): Promise<FindMatchResult> {
  return emitWithAck<FindMatchResult>('findMatch');
}

export function sendAction(roomId: string, action: GameAction): void {
  getSocket().emit('action', { roomId: roomId.toUpperCase(), action });
}

export function reportTimeout(roomId: string, loser: Player): void {
  getSocket().emit('reportTimeout', { roomId: roomId.toUpperCase(), loser });
}

export interface EloUpdatePayload {
  result: GameResult;
  whiteElo: number;
  blackElo: number;
  whiteDelta: number;
  blackDelta: number;
}

export function onState(cb: (state: GameState) => void): () => void {
  const s = getSocket();
  s.on('state', cb);
  return () => {
    s.off('state', cb);
  };
}

export function onMatched(
  cb: (data: { roomId: string; color: Player; state: GameState }) => void,
): () => void {
  const s = getSocket();
  s.on('matched', cb);
  return () => {
    s.off('matched', cb);
  };
}

export function onOpponentLeft(cb: () => void): () => void {
  const s = getSocket();
  s.on('opponentLeft', cb);
  return () => {
    s.off('opponentLeft', cb);
  };
}

export function onEloUpdate(cb: (data: EloUpdatePayload) => void): () => void {
  const s = getSocket();
  s.on('eloUpdate', cb);
  return () => {
    s.off('eloUpdate', cb);
  };
}

export function clearAllListeners(): void {
  const s = socket;
  if (!s) return;
  s.off('state');
  s.off('matched');
  s.off('opponentLeft');
  s.off('eloUpdate');
}

export function disconnectSocket(): void {
  if (!socket) return;
  clearAllListeners();
  socket.disconnect();
  preconnectPromise = null;
}
