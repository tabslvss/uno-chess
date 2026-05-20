import type * as Party from 'partykit/server';
import { createGame, applyAction } from '../src/game/engine.ts';
import type { GameAction, GameState, Player } from '../src/game/types.ts';
import { verifyAccessToken, type SocketUser } from '../server/auth.ts';
import { applyMatchElo } from '../server/elo.ts';

/** Bridge PartyKit's room.env into globalThis.process.env so the shared
 *  server modules (auth.ts, supabaseAdmin.ts) keep working unmodified. */
function installEnvBridge(env: Record<string, unknown>): void {
  const g = globalThis as unknown as { process?: { env: Record<string, string> } };
  g.process = g.process ?? { env: {} };
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') g.process.env[k] = v;
  }
}

/** Bump when matchmaking logic changes — exposed on /health */
const MATCHMAKER_VERSION = 4;

interface Room {
  id: string;
  state: GameState;
  white: string | null;
  black: string | null;
  whiteUserId: string | null;
  blackUserId: string | null;
  ranked: boolean;
  eloApplied: boolean;
}

interface QueueEntry {
  socketId: string;
  userId: string;
  elo: number;
  queuedAt: number;
}

interface RoomPlayerInfo {
  username: string;
}

interface MatchedPlayers {
  white: RoomPlayerInfo;
  black: RoomPlayerInfo | null;
}

type RpcMessage = { type: 'rpc'; id: string; method: string; args: unknown[] };
type RpcResult = { type: 'rpc'; id: string; result?: unknown; error?: string };
type EventMessage = { type: 'event'; name: string; data: unknown };

function log(...args: unknown[]): void {
  console.log('[unochess-party]', ...args);
}

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default class UnoChessParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  rooms = new Map<string, Room>();
  queue: QueueEntry[] = [];
  socketUsers = new Map<string, SocketUser>();
  /** Which game room code this connection is in (for broadcasts). */
  gameRoomByConn = new Map<string, string>();

  async onStart(): Promise<void> {
    installEnvBridge(this.room.env as Record<string, unknown>);
    await this.scheduleMatchmaker();
  }

  async scheduleMatchmaker(): Promise<void> {
    if (this.queue.length >= 2) this.processMatchQueue();
    await this.room.storage.setAlarm(Date.now() + 1000);
  }

  async onAlarm(): Promise<void> {
    await this.scheduleMatchmaker();
  }

  onRequest(req: Party.Request): Response {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/health')) {
      return Response.json({
        ok: true,
        partykit: true,
        matchmaker: MATCHMAKER_VERSION,
        queueSize: this.queue.length,
        rooms: this.rooms.size,
      });
    }
    return new Response('UnoChess PartyKit', { status: 200 });
  }

  async onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext): Promise<void> {
    installEnvBridge(this.room.env as Record<string, unknown>);
    log('connect', { id: conn.id });
    // Auth happens via `authenticate` RPC — do not put JWT in the WebSocket URL (too long for some TLS stacks).
  }

  async onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection): Promise<void> {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    let msg: RpcMessage;
    try {
      msg = JSON.parse(text) as RpcMessage;
    } catch {
      return;
    }
    if (msg.type !== 'rpc') return;

    try {
      if (msg.method === 'authenticate') {
        const token = String(msg.args?.[0] ?? '');
        const user = await verifyAccessToken(token);
        if (!user) {
          this.sendRpc(sender, msg.id, undefined, 'Invalid session — log in again.');
          sender.close(4001, 'Unauthorized');
          return;
        }
        this.socketUsers.set(sender.id, user);
        log('authenticated', { id: sender.id, user: user.username });
        this.sendEvent(sender, 'authenticated', { username: user.username, elo: user.elo });
        this.sendRpc(sender, msg.id, { ok: true });
        return;
      }

      const user = this.socketUsers.get(sender.id);
      if (!user) {
        this.sendRpc(sender, msg.id, undefined, 'Not authenticated');
        return;
      }

      const result = await this.handleRpc(sender, user, msg.method, msg.args ?? []);
      this.sendRpc(sender, msg.id, result);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Request failed';
      this.sendRpc(sender, msg.id, undefined, err);
    }
  }

  onClose(conn: Party.Connection): void {
    const user = this.socketUsers.get(conn.id);
    log('disconnect', { id: conn.id, user: user?.username });
    this.socketUsers.delete(conn.id);
    this.gameRoomByConn.delete(conn.id);
    this.removeFromQueue(conn.id);
    for (const [id, room] of this.rooms) {
      if (room.white === conn.id) room.white = null;
      if (room.black === conn.id) room.black = null;
      if (!room.white && !room.black) {
        if (room.state.phase === 'gameOver') this.rooms.delete(id);
      } else {
        this.emitToGameRoom(id, 'opponentLeft', {});
      }
    }
  }

  private sendEvent(conn: Party.Connection, name: string, data: unknown): void {
    const payload: EventMessage = { type: 'event', name, data };
    conn.send(JSON.stringify(payload));
  }

  private sendRpc(conn: Party.Connection, id: string, result?: unknown, error?: string): void {
    const payload: RpcResult = error ? { type: 'rpc', id, error } : { type: 'rpc', id, result };
    conn.send(JSON.stringify(payload));
  }

  private emitToConn(connId: string, name: string, data: unknown): void {
    const conn = this.room.getConnection(connId);
    if (conn) this.sendEvent(conn, name, data);
  }

  private emitToGameRoom(gameRoomId: string, name: string, data: unknown, except?: string): void {
    for (const conn of this.room.getConnections()) {
      if (except && conn.id === except) continue;
      if (this.gameRoomByConn.get(conn.id) === gameRoomId) {
        this.sendEvent(conn, name, data);
      }
    }
  }

  private setConnGameRoom(connId: string, gameRoomId: string): void {
    this.gameRoomByConn.set(connId, gameRoomId);
  }

  private roomPlayersPayload(room: Room): MatchedPlayers {
    const whiteUser = room.white ? this.socketUsers.get(room.white) : undefined;
    const blackUser = room.black ? this.socketUsers.get(room.black) : undefined;
    return {
      white: { username: whiteUser?.username ?? 'Player' },
      black: blackUser ? { username: blackUser.username } : null,
    };
  }

  private removeFromQueue(socketId: string): void {
    const idx = this.queue.findIndex((e) => e.socketId === socketId);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  private playerSlot(room: Room, userId: string): Player | null {
    if (room.whiteUserId === userId) return 'white';
    if (room.blackUserId === userId) return 'black';
    return null;
  }

  private roomForSocket(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.white === socketId || room.black === socketId) return room;
    }
    return null;
  }

  private createRankedRoom(a: QueueEntry, b: QueueEntry): boolean {
    const connA = this.room.getConnection(a.socketId);
    const connB = this.room.getConnection(b.socketId);
    if (!connA || !connB) return false;

    this.removeFromQueue(a.socketId);
    this.removeFromQueue(b.socketId);

    const roomId = genCode();
    const state = createGame();
    const hostIsWhite = Math.random() < 0.5;
    const room: Room = {
      id: roomId,
      state,
      white: hostIsWhite ? a.socketId : b.socketId,
      black: hostIsWhite ? b.socketId : a.socketId,
      whiteUserId: hostIsWhite ? a.userId : b.userId,
      blackUserId: hostIsWhite ? b.userId : a.userId,
      ranked: true,
      eloApplied: false,
    };
    this.rooms.set(roomId, room);

    this.setConnGameRoom(a.socketId, roomId);
    this.setConnGameRoom(b.socketId, roomId);

    const colorA: Player = hostIsWhite ? 'white' : 'black';
    const colorB: Player = hostIsWhite ? 'black' : 'white';
    const players = this.roomPlayersPayload(room);

    this.emitToConn(a.socketId, 'matched', { roomId, color: colorA, state, players });
    this.emitToConn(b.socketId, 'matched', { roomId, color: colorB, state, players });
    log('ranked match', { roomId, a: this.socketUsers.get(a.socketId)?.username, b: this.socketUsers.get(b.socketId)?.username });
    return true;
  }

  private pairAnyTwoInQueue(): boolean {
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const a = this.queue[i]!;
        const b = this.queue[j]!;
        if (a.userId === b.userId) continue;
        if (this.createRankedRoom(a, b)) return true;
      }
    }
    return false;
  }

  private drainMatchQueue(): void {
    while (this.pairAnyTwoInQueue()) log('drainMatchQueue');
  }

  private processMatchQueue(): void {
    if (this.queue.length < 2) return;
    this.drainMatchQueue();
  }

  private async onGameOver(room: Room): Promise<void> {
    if (room.eloApplied || room.state.phase !== 'gameOver') return;
    if (!room.whiteUserId || !room.blackUserId) return;
    room.eloApplied = true;
    const eloResult = await applyMatchElo(room.whiteUserId, room.blackUserId, room.state.result);
    if (!eloResult) return;
    const payload = {
      result: room.state.result,
      whiteElo: eloResult.whiteElo,
      blackElo: eloResult.blackElo,
      whiteDelta: eloResult.whiteDelta,
      blackDelta: eloResult.blackDelta,
    };
    if (room.white) this.emitToConn(room.white, 'eloUpdate', payload);
    if (room.black) this.emitToConn(room.black, 'eloUpdate', payload);
  }

  private async handleRpc(
    conn: Party.Connection,
    user: SocketUser,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'createRoom':
        return this.rpcCreateRoom(conn, user);
      case 'joinRoom':
        return this.rpcJoinRoom(conn, user, args[0] as string);
      case 'findMatch':
        return this.rpcFindMatch(conn, user);
      case 'leaveQueue':
        this.removeFromQueue(conn.id);
        return { ok: true };
      case 'action':
        return this.rpcAction(conn, args[0] as { roomId: string; action: GameAction });
      case 'reportTimeout':
        return this.rpcReportTimeout(conn, args[0] as { roomId: string; loser: Player });
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private rpcCreateRoom(conn: Party.Connection, user: SocketUser) {
    const roomId = genCode();
    const state = createGame();
    const room: Room = {
      id: roomId,
      state,
      white: conn.id,
      black: null,
      whiteUserId: user.id,
      blackUserId: null,
      ranked: false,
      eloApplied: false,
    };
    this.rooms.set(roomId, room);
    this.setConnGameRoom(conn.id, roomId);
    log('createRoom', { roomId, user: user.username });
    return { roomId, color: 'white' as Player, state };
  }

  private rpcJoinRoom(conn: Party.Connection, user: SocketUser, roomId: string) {
    const code = String(roomId).toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const existing = this.playerSlot(room, user.id);
    if (existing) {
      if (existing === 'white') room.white = conn.id;
      else room.black = conn.id;
      this.setConnGameRoom(conn.id, code);
      const players = this.roomPlayersPayload(room);
      this.emitToGameRoom(code, 'opponentReconnected', {});
      this.emitToGameRoom(code, 'state', room.state);
      return { roomId: room.id, color: existing, state: room.state, players };
    }

    if (room.black && room.blackUserId) throw new Error('Room is full');
    if (room.white === conn.id) throw new Error('You are already in this room');

    const color: Player = !room.white ? 'white' : 'black';
    if (color === 'white') {
      room.white = conn.id;
      room.whiteUserId = user.id;
    } else {
      room.black = conn.id;
      room.blackUserId = user.id;
    }
    this.setConnGameRoom(conn.id, code);
    const players = this.roomPlayersPayload(room);
    if (room.white && room.white !== conn.id) {
      this.emitToConn(room.white, 'matched', { roomId: room.id, color: 'white', state: room.state, players });
    }
    this.emitToGameRoom(code, 'state', room.state);
    return { roomId: room.id, color, state: room.state, players };
  }

  private rpcFindMatch(conn: Party.Connection, user: SocketUser) {
    this.removeFromQueue(conn.id);
    const entry: QueueEntry = {
      socketId: conn.id,
      userId: user.id,
      elo: user.elo,
      queuedAt: Date.now(),
    };
    this.queue.push(entry);
    log('findMatch queued', { user: user.username, queueSize: this.queue.length });

    this.drainMatchQueue();

    const room = this.roomForSocket(conn.id);
    if (room) {
      const color: Player = room.white === conn.id ? 'white' : 'black';
      return {
        ok: true,
        roomId: room.id,
        color,
        state: room.state,
        players: this.roomPlayersPayload(room),
      };
    }

    const othersDifferentUser = this.queue.filter((e) => e.userId !== user.id);
    if (this.queue.length >= 2 && othersDifferentUser.length === 0) {
      this.removeFromQueue(conn.id);
      throw new Error(
        'Ranked needs two different logins. Use another account in the second browser.',
      );
    }

    for (const q of this.queue) {
      this.emitToConn(q.socketId, 'queueUpdate', { size: this.queue.length });
    }

    return { ok: true, queued: true, queueSize: this.queue.length };
  }

  private async rpcAction(
    conn: Party.Connection,
    payload: { roomId: string; action: GameAction },
  ) {
    const room = this.rooms.get(payload.roomId.toUpperCase());
    if (!room) return;
    const player: Player | null =
      room.white === conn.id ? 'white' : room.black === conn.id ? 'black' : null;
    if (!player || room.state.currentPlayer !== player) return;
    const wasOver = room.state.phase === 'gameOver';
    room.state = applyAction(room.state, payload.action);
    this.emitToGameRoom(room.id, 'state', room.state);
    if (!wasOver && room.state.phase === 'gameOver') await this.onGameOver(room);
  }

  private async rpcReportTimeout(
    conn: Party.Connection,
    payload: { roomId: string; loser: Player },
  ) {
    const room = this.rooms.get(payload.roomId.toUpperCase());
    if (!room || room.state.phase === 'gameOver') return;
    const player: Player | null =
      room.white === conn.id ? 'white' : room.black === conn.id ? 'black' : null;
    if (!player || payload.loser !== player) return;
    const winner: Player = payload.loser === 'white' ? 'black' : 'white';
    room.state = {
      ...room.state,
      phase: 'gameOver',
      result: winner,
      resultReason: 'Time forfeit.',
      message: `${winner} wins on time!`,
    };
    this.emitToGameRoom(room.id, 'state', room.state);
    await this.onGameOver(room);
  }
}
