import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { createGame, applyAction } from '../src/game/engine.ts';
import type { GameAction, GameState, GameResult, Player } from '../src/game/types.ts';
import { verifyAccessToken, type SocketUser } from './auth.ts';
import { applyMatchElo } from './elo.ts';

const PORT = Number(process.env.PORT) || 3001;

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

const rooms = new Map<string, Room>();
const queue: QueueEntry[] = [];
const socketUsers = new Map<string, SocketUser>();

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

interface RoomPlayerInfo {
  username: string;
}

interface MatchedPlayers {
  white: RoomPlayerInfo;
  black: RoomPlayerInfo | null;
}

function roomPlayersPayload(room: Room): MatchedPlayers {
  const whiteUser = room.white ? socketUsers.get(room.white) : undefined;
  const blackUser = room.black ? socketUsers.get(room.black) : undefined;
  return {
    white: { username: whiteUser?.username ?? 'Player' },
    black: blackUser ? { username: blackUser.username } : null,
  };
}

function assignToRoom(
  socket: Socket,
  room: Room,
  io: Server,
): { color: Player; state: GameState } {
  const user = socketUsers.get(socket.id)!;
  const color: Player = !room.white ? 'white' : 'black';
  if (color === 'white') {
    room.white = socket.id;
    room.whiteUserId = user.id;
  } else {
    room.black = socket.id;
    room.blackUserId = user.id;
  }
  socket.join(room.id);
  io.to(room.id).emit('state', room.state);
  return { color, state: room.state };
}

async function onGameOver(room: Room, io: Server): Promise<void> {
  if (room.eloApplied || room.state.phase !== 'gameOver') return;
  if (!room.whiteUserId || !room.blackUserId) return;

  room.eloApplied = true;
  const result = room.state.result;
  const eloResult = await applyMatchElo(room.whiteUserId, room.blackUserId, result);
  if (!eloResult) return;

  const payload = {
    result,
    whiteElo: eloResult.whiteElo,
    blackElo: eloResult.blackElo,
    whiteDelta: eloResult.whiteDelta,
    blackDelta: eloResult.blackDelta,
  };

  if (room.white) io.to(room.white).emit('eloUpdate', payload);
  if (room.black) io.to(room.black).emit('eloUpdate', payload);
}

function removeFromQueue(socketId: string): void {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx >= 0) queue.splice(idx, 1);
}

function findRankedPartner(entry: QueueEntry, maxGap: number): QueueEntry | undefined {
  let best: QueueEntry | undefined;
  let bestGap = Infinity;
  for (const other of queue) {
    if (other.socketId === entry.socketId || other.userId === entry.userId) continue;
    const gap = Math.abs(other.elo - entry.elo);
    if (gap <= maxGap && gap < bestGap) {
      best = other;
      bestGap = gap;
    }
  }
  if (best) return best;
  if (maxGap === Infinity) {
    return queue.find((o) => o.socketId !== entry.socketId && o.userId !== entry.userId);
  }
  return undefined;
}

function playerSlot(room: Room, userId: string): Player | null {
  if (room.whiteUserId === userId) return 'white';
  if (room.blackUserId === userId) return 'black';
  return null;
}

function attachSocketToRoom(
  socket: Socket,
  room: Room,
  color: Player,
  io: Server,
): { color: Player; state: GameState } {
  if (color === 'white') room.white = socket.id;
  else room.black = socket.id;
  socket.join(room.id);
  io.to(room.id).emit('opponentReconnected');
  io.to(room.id).emit('state', room.state);
  return { color, state: room.state };
}

function createRankedRoom(
  a: QueueEntry,
  b: QueueEntry,
  io: Server,
): {
  roomId: string;
  state: GameState;
  players: MatchedPlayers;
  colorBySocket: Record<string, Player>;
} | null {
  const socketA = io.sockets.sockets.get(a.socketId);
  const socketB = io.sockets.sockets.get(b.socketId);
  if (!socketA || !socketB) return null;

  removeFromQueue(a.socketId);
  removeFromQueue(b.socketId);

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
  rooms.set(roomId, room);

  socketA.join(roomId);
  socketB.join(roomId);

  const colorA: Player = hostIsWhite ? 'white' : 'black';
  const colorB: Player = hostIsWhite ? 'black' : 'white';
  const players = roomPlayersPayload(room);

  socketA.emit('matched', { roomId, color: colorA, state, players });
  socketB.emit('matched', { roomId, color: colorB, state, players });

  return {
    roomId,
    state,
    players,
    colorBySocket: { [a.socketId]: colorA, [b.socketId]: colorB },
  };
}

function processMatchQueue(io: Server): void {
  if (queue.length < 2) return;

  const now = Date.now();
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (!entry) continue;
    const waitMs = now - entry.queuedAt;
    const maxGap = waitMs > 12_000 ? Infinity : waitMs > 6_000 ? 800 : 400;
    const partner = findRankedPartner(entry, maxGap);
    if (!partner) continue;

    const result = createRankedRoom(entry, partner, io);
    if (result) return processMatchQueue(io);
    return;
  }
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOrigin =
  allowedOrigins.length === 1 && allowedOrigins[0] === '*'
    ? '*'
    : (origin: string | undefined, cb: (err: Error | null, ok: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'), false);
      };

const app = express();

function applyCors(req: express.Request, res: express.Response): void {
  const origin = req.headers.origin;
  if (origin) {
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
  } else if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Login required for online play'));
    return;
  }
  const user = await verifyAccessToken(token);
  if (!user) {
    next(new Error('Invalid session'));
    return;
  }
  socketUsers.set(socket.id, user);
  next();
});

io.on('connection', (socket) => {
  const user = socketUsers.get(socket.id)!;
  socket.emit('authenticated', { username: user.username, elo: user.elo });

  socket.on(
    'createRoom',
    (cb: (res: { roomId: string; color: Player; state: GameState } | { error: string }) => void) => {
      const roomId = genCode();
      const state = createGame();
      const room: Room = {
        id: roomId,
        state,
        white: socket.id,
        black: null,
        whiteUserId: user.id,
        blackUserId: null,
        ranked: false,
        eloApplied: false,
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      cb({ roomId, color: 'white', state });
    },
  );

  socket.on(
    'joinRoom',
    (
      roomId: string,
      cb: (
        res:
          | { roomId: string; color: Player; state: GameState; players: MatchedPlayers }
          | { error: string },
      ) => void,
    ) => {
      const room = rooms.get(String(roomId).toUpperCase());
      if (!room) {
        cb({ error: 'Room not found' });
        return;
      }

      const existing = playerSlot(room, user.id);
      if (existing) {
        const { color, state } = attachSocketToRoom(socket, room, existing, io);
        const players = roomPlayersPayload(room);
        cb({ roomId: room.id, color, state, players });
        return;
      }

      if (room.black && room.blackUserId) {
        cb({ error: 'Room is full' });
        return;
      }
      if (room.white === socket.id) {
        cb({ error: 'You are already in this room' });
        return;
      }
      const { color, state } = assignToRoom(socket, room, io);
      const players = roomPlayersPayload(room);
      const hostSocket = room.white ? io.sockets.sockets.get(room.white) : undefined;
      hostSocket?.emit('matched', { roomId: room.id, color: 'white', state, players });
      cb({ roomId: room.id, color, state, players });
    },
  );

  socket.on('leaveQueue', () => {
    removeFromQueue(socket.id);
  });

  socket.on('findMatch', (cb: (res: unknown) => void) => {
    removeFromQueue(socket.id);

    const entry: QueueEntry = {
      socketId: socket.id,
      userId: user.id,
      elo: user.elo,
      queuedAt: Date.now(),
    };
    queue.push(entry);

    const partner = findRankedPartner(entry, 400);
    if (partner) {
      const created = createRankedRoom(entry, partner, io);
      if (created) {
        const color = created.colorBySocket[entry.socketId];
        if (color) {
          cb({
            ok: true,
            roomId: created.roomId,
            color,
            state: created.state,
            players: created.players,
          });
          return;
        }
      }
    }

    processMatchQueue(io);
    const stillQueued = queue.some((e) => e.socketId === socket.id);
    if (stillQueued) {
      cb({ ok: true, queued: true });
      return;
    }

    cb({ ok: true, queued: true });
  });

  socket.on('action', async (payload: { roomId: string; action: GameAction }) => {
    const room = rooms.get(payload.roomId.toUpperCase());
    if (!room) return;
    const player: Player | null =
      room.white === socket.id ? 'white' : room.black === socket.id ? 'black' : null;
    if (!player || room.state.currentPlayer !== player) return;

    const wasOver = room.state.phase === 'gameOver';
    room.state = applyAction(room.state, payload.action);
    io.to(room.id).emit('state', room.state);

    if (!wasOver && room.state.phase === 'gameOver') {
      await onGameOver(room, io);
    }
  });

  socket.on('reportTimeout', async (payload: { roomId: string; loser: Player }) => {
    const room = rooms.get(payload.roomId.toUpperCase());
    if (!room || room.state.phase === 'gameOver') return;
    const player: Player | null =
      room.white === socket.id ? 'white' : room.black === socket.id ? 'black' : null;
    if (!player || payload.loser !== player) return;

    const winner: Player = payload.loser === 'white' ? 'black' : 'white';
    room.state = {
      ...room.state,
      phase: 'gameOver',
      result: winner,
      resultReason: 'Time forfeit.',
      message: `${winner} wins on time!`,
    };
    io.to(room.id).emit('state', room.state);
    await onGameOver(room, io);
  });

  socket.on('disconnect', () => {
    socketUsers.delete(socket.id);
    removeFromQueue(socket.id);
    for (const [id, room] of rooms) {
      if (room.white === socket.id) room.white = null;
      if (room.black === socket.id) room.black = null;
      if (!room.white && !room.black) {
        if (room.state.phase === 'gameOver') rooms.delete(id);
      } else {
        io.to(id).emit('opponentLeft');
      }
    }
  });
});

setInterval(() => processMatchQueue(io), 2_000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`UNO Chess server on port ${PORT}`);
});
