import { io, type Socket } from 'socket.io-client';
import type { GameAction, GameState, Player, GameResult } from '../game/types';
import { supabase } from '../lib/supabase';

const URL = import.meta.env.VITE_SERVER_URL ?? '';
const ACK_TIMEOUT_MS = 10_000;

let socket: Socket | null = null;

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
      reconnectionAttempts: 4,
      reconnectionDelay: 600,
      timeout: 8_000,
    });
  }
  return socket;
}

async function probeGameServer(): Promise<void> {
  // Local dev: empty VITE_SERVER_URL → use Vite proxy (/health → :3001)
  const healthUrl = URL ? `${URL.replace(/\/$/, '')}/health` : '/health';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4_000);
  try {
    const res = await fetch(healthUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error('Game server unavailable');
  } catch {
    if (!URL && import.meta.env.PROD) {
      throw new Error(
        'Online play is not set up yet. Host the game API on Render (free), then add VITE_SERVER_URL on Vercel. See HOSTING.md in the project.',
      );
    }
    if (!URL) {
      throw new Error(
        'Game server is not running. Open a terminal in the project folder and run: npm run dev',
      );
    }
    throw new Error(
      'Game server is offline or waking up (Render free tier sleeps after ~15 min). Wait 30 seconds and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function connectSocket(): Promise<void> {
  await probeGameServer();
  const token = await accessToken();
  const s = getSocket();

  if (s.connected) {
    s.auth = { token };
    return;
  }

  s.auth = { token };

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
      reject(err);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Server is taking too long to respond.'));
    }, ACK_TIMEOUT_MS);

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
}
