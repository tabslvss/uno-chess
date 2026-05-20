import PartySocket from 'partysocket';
import type { GameAction, GameState, Player, GameResult } from '../game/types';
import { supabase } from '../lib/supabase';

const PARTYKIT_HOST = (import.meta.env.VITE_PARTYKIT_HOST ?? '').replace(/^https?:\/\//, '');
const PARTY_NAME = 'main';
const PARTY_ROOM = 'global';
const ACK_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 20_000;
const DEBUG = true;

function log(...args: unknown[]): void {
  if (DEBUG) console.log('[net]', ...args);
}

function resolveHost(): string {
  if (PARTYKIT_HOST) return PARTYKIT_HOST;
  if (import.meta.env.DEV) return `${window.location.hostname}:${window.location.port}`;
  return '';
}

function healthUrl(): string {
  const host = resolveHost();
  if (!host) return '/parties/main/global/health';
  const proto = import.meta.env.DEV ? 'http' : 'https';
  return `${proto}://${host}/parties/${PARTY_NAME}/${PARTY_ROOM}/health`;
}

let socket: PartySocket | null = null;
let socketAuthed = false;
let warmPromise: Promise<boolean> | null = null;
let preconnectPromise: Promise<void> | null = null;
let matchmakingWarmInterval: ReturnType<typeof setInterval> | null = null;

const eventHandlers = new Map<string, Set<(data: unknown) => void>>();
const pendingRpc = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pingHealthOnce(timeoutMs = 8_000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(healthUrl(), { signal: ctrl.signal, mode: 'cors', credentials: 'omit' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; partykit?: boolean; matchmaker?: number };
    log('health', data);
    return Boolean(data.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function warmGameServer(force = false): Promise<boolean> {
  const host = resolveHost();
  if (!host && import.meta.env.PROD) return Promise.resolve(false);
  if (force) warmPromise = null;
  warmPromise ??= (async () => {
    for (let i = 0; i < 3; i++) {
      if (await pingHealthOnce(i === 0 ? 5_000 : 10_000)) return true;
      if (i < 2) await sleep(800);
    }
    return false;
  })();
  return warmPromise;
}

export function startServerKeepAlive(): () => void {
  void warmGameServer();
  const interval = setInterval(() => void warmGameServer(true), 5 * 60 * 1000);
  return () => clearInterval(interval);
}

async function accessToken(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not logged in');
  return token;
}

function dispatchMessage(raw: MessageEvent): void {
  let msg: { type: string; id?: string; name?: string; data?: unknown; result?: unknown; error?: string };
  try {
    msg = JSON.parse(String(raw.data));
  } catch {
    return;
  }
  if (msg.type === 'rpc' && msg.id) {
    const pending = pendingRpc.get(msg.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRpc.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error));
    else pending.resolve(msg.result);
    return;
  }
  if (msg.type === 'event' && msg.name) {
    log('event', msg.name, msg.data);
    const set = eventHandlers.get(msg.name);
    set?.forEach((cb) => cb(msg.data));
  }
}

function getSocket(): PartySocket {
  if (!socket) {
    const host = resolveHost();
    if (!host && import.meta.env.PROD) {
      throw new Error('Online play is not set up. Add VITE_PARTYKIT_HOST on Vercel.');
    }
    socket = new PartySocket({
      host,
      party: PARTY_NAME,
      room: PARTY_ROOM,
    });
    socket.addEventListener('message', dispatchMessage);
    socket.addEventListener('open', () => {
      socketAuthed = false;
      log('party connected', socket?.id);
    });
    socket.addEventListener('close', () => {
      socketAuthed = false;
      log('party disconnected');
    });
    socket.addEventListener('error', () => log('party error'));
  }
  return socket;
}

async function authenticateAfterOpen(token: string): Promise<void> {
  const res = await emitRpc<{ ok: boolean }>('authenticate', token);
  if (!res?.ok) throw new Error('Invalid session — log in again.');
  socketAuthed = true;
}

function connectOnce(token: string): Promise<void> {
  const s = getSocket();

  if (s.readyState === WebSocket.OPEN && socketAuthed) return Promise.resolve();
  if (s.readyState === WebSocket.OPEN) return authenticateAfterOpen(token);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onOpen = () => {
      void authenticateAfterOpen(token)
        .then(() => finish(resolve))
        .catch((err) =>
          finish(() =>
            reject(err instanceof Error ? err : new Error('Authentication failed')),
          ),
        );
    };
    const onError = () => {
      finish(() =>
        reject(
          new Error(
            'Could not reach the game server. Hard refresh; if it persists, wait a minute for SSL provisioning.',
          ),
        ),
      );
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error('Connection timed out')));
    }, CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      s.removeEventListener('open', onOpen);
      s.removeEventListener('error', onError);
    };

    s.addEventListener('open', onOpen);
    s.addEventListener('error', onError);
    s.reconnect();
  });
}

function connectionError(err: unknown): Error {
  if (!resolveHost() && import.meta.env.PROD) {
    return new Error('Online play is not set up yet. Set VITE_PARTYKIT_HOST on Vercel.');
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('not logged in')) return new Error('Not logged in');
  return new Error('Connecting… try again in a moment.');
}

export function preconnectSocket(): Promise<void> {
  if (!preconnectPromise) {
    preconnectPromise = (async () => {
      try {
        const token = await accessToken();
        void warmGameServer();
        await connectOnce(token);
      } catch {
        /* ignore */
      }
    })().finally(() => {
      preconnectPromise = null;
    });
  }
  return preconnectPromise;
}

export async function connectSocket(): Promise<void> {
  const token = await accessToken();
  void warmGameServer();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await connectOnce(token);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < 4) await sleep(500 * (attempt + 1));
    }
  }
  throw connectionError(lastErr);
}

function emitRpc<T>(method: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (s.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected to the game server.'));
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timer = setTimeout(() => {
      pendingRpc.delete(id);
      reject(new Error("Server didn't respond. Try again."));
    }, ACK_TIMEOUT_MS);
    pendingRpc.set(id, {
      resolve: (v) => resolve(v as T),
      reject,
      timer,
    });
    log('rpc', method, method === 'authenticate' ? ['<token>'] : args);
    s.send(JSON.stringify({ type: 'rpc', id, method, args }));
  });
}

export async function createRoom(): Promise<{
  roomId: string;
  color: Player;
  state: GameState;
}> {
  const res = await emitRpc<{ roomId: string; color: Player; state: GameState } | { error: string }>(
    'createRoom',
  );
  if ('error' in res) throw new Error(res.error);
  if (!res?.roomId) throw new Error('Failed to create room.');
  return res;
}

export async function joinRoom(roomId: string): Promise<MatchedPayload> {
  const code = roomId.trim().toUpperCase();
  if (!code) throw new Error('Enter a room code.');
  const res = await emitRpc<MatchedPayload | { error: string }>('joinRoom', code);
  if ('error' in res) throw new Error(res.error);
  if (!res?.roomId) throw new Error('Failed to join room.');
  if (!res.players) {
    res.players = { white: { username: 'Player' }, black: { username: 'You' } };
  }
  return res;
}

export interface MatchPlayers {
  white: { username: string };
  black: { username: string } | null;
}

export interface MatchedPayload {
  roomId: string;
  color: Player;
  state: GameState;
  players: MatchPlayers;
}

export interface FindMatchResult {
  ok: boolean;
  roomId?: string;
  color?: Player;
  state?: GameState;
  players?: MatchPlayers;
  queued?: boolean;
  queueSize?: number;
  error?: string;
}

export async function findMatch(): Promise<FindMatchResult> {
  const res = await emitRpc<FindMatchResult>('findMatch');
  if (res?.players == null && res?.roomId) {
    res.players = { white: { username: 'Player' }, black: { username: 'Opponent' } };
  }
  return res;
}

export function leaveQueue(): void {
  if (socket?.readyState === WebSocket.OPEN) {
    void emitRpc('leaveQueue').catch(() => {});
  }
}

export function startMatchmakingWarmup(): void {
  stopMatchmakingWarmup();
  void warmGameServer(true);
  matchmakingWarmInterval = setInterval(() => void warmGameServer(true), 8_000);
}

export function stopMatchmakingWarmup(): void {
  if (matchmakingWarmInterval) {
    clearInterval(matchmakingWarmInterval);
    matchmakingWarmInterval = null;
  }
}

export function sendAction(roomId: string, action: GameAction): void {
  void emitRpc('action', { roomId: roomId.toUpperCase(), action });
}

export function reportTimeout(roomId: string, loser: Player): void {
  void emitRpc('reportTimeout', { roomId: roomId.toUpperCase(), loser });
}

export interface EloUpdatePayload {
  result: GameResult;
  whiteElo: number;
  blackElo: number;
  whiteDelta: number;
  blackDelta: number;
}

function onEvent(name: string, cb: (data: unknown) => void): () => void {
  if (!eventHandlers.has(name)) eventHandlers.set(name, new Set());
  eventHandlers.get(name)!.add(cb);
  return () => eventHandlers.get(name)?.delete(cb);
}

export function onState(cb: (state: GameState) => void): () => void {
  return onEvent('state', (d) => cb(d as GameState));
}

export function onMatched(cb: (data: MatchedPayload) => void): () => void {
  return onEvent('matched', (d) => {
    const data = d as MatchedPayload;
    if (!data.players) {
      data.players = { white: { username: 'Player' }, black: { username: 'Opponent' } };
    }
    cb(data);
  });
}

export function onOpponentLeft(cb: () => void): () => void {
  return onEvent('opponentLeft', () => cb());
}

export function onOpponentReconnected(cb: () => void): () => void {
  return onEvent('opponentReconnected', () => cb());
}

export function onQueueUpdate(cb: (data: { size: number }) => void): () => void {
  return onEvent('queueUpdate', (d) => cb(d as { size: number }));
}

export function onEloUpdate(cb: (data: EloUpdatePayload) => void): () => void {
  return onEvent('eloUpdate', (d) => cb(d as EloUpdatePayload));
}

export async function logServerMatchmakerVersion(): Promise<void> {
  try {
    const res = await fetch(healthUrl());
    const data = (await res.json()) as { matchmaker?: number; partykit?: boolean };
    log('API health', data);
    if (!data.partykit || (data.matchmaker ?? 0) < 4) {
      log('WARNING: PartyKit API may be outdated — run partykit deploy');
    }
  } catch (e) {
    log('health check failed', e);
  }
}

export function clearAllListeners(): void {
  eventHandlers.clear();
}

export function disconnectSocket(): void {
  stopMatchmakingWarmup();
  for (const [, p] of pendingRpc) clearTimeout(p.timer);
  pendingRpc.clear();
  if (!socket) return;
  clearAllListeners();
  socket.close();
  socket = null;
  socketAuthed = false;
  preconnectPromise = null;
}
