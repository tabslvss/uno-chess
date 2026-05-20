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

function findRankedPartner(entry: QueueEntry): QueueEntry | undefined {
  const MAX_GAP = 400;
  let best: QueueEntry | undefined;
  let bestGap = Infinity;
  for (const other of queue) {
    if (other.socketId === entry.socketId || other.userId === entry.userId) continue;
    const gap = Math.abs(other.elo - entry.elo);
    if (gap <= MAX_GAP && gap < bestGap) {
      best = other;
      bestGap = gap;
    }
  }
  if (best) return best;
  return queue.find((o) => o.socketId !== entry.socketId && o.userId !== entry.userId);
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
      cb: (res: { roomId: string; color: Player; state: GameState } | { error: string }) => void,
    ) => {
      const room = rooms.get(String(roomId).toUpperCase());
      if (!room) {
        cb({ error: 'Room not found' });
        return;
      }
      if (room.black) {
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

  socket.on('findMatch', (cb: (res: unknown) => void) => {
    removeFromQueue(socket.id);

    const entry: QueueEntry = { socketId: socket.id, userId: user.id, elo: user.elo };
    queue.push(entry);

    const partner = findRankedPartner(entry);
    if (!partner) {
      cb({ ok: true, queued: true });
      return;
    }

    removeFromQueue(socket.id);
    removeFromQueue(partner.socketId);

    const roomId = genCode();
    const state = createGame();
    const hostIsWhite = Math.random() < 0.5;
    const partnerUser = socketUsers.get(partner.socketId);
    const room: Room = {
      id: roomId,
      state,
      white: hostIsWhite ? partner.socketId : socket.id,
      black: hostIsWhite ? socket.id : partner.socketId,
      whiteUserId: hostIsWhite ? partner.userId : user.id,
      blackUserId: hostIsWhite ? user.id : partner.userId,
      ranked: true,
      eloApplied: false,
    };
    rooms.set(roomId, room);

    const pSocket = io.sockets.sockets.get(partner.socketId);
    pSocket?.join(roomId);
    socket.join(roomId);

    const colorP: Player = hostIsWhite ? 'white' : 'black';
    const colorS: Player = hostIsWhite ? 'black' : 'white';
    const players = roomPlayersPayload(room);
    pSocket?.emit('matched', { roomId, color: colorP, state, players });
    socket.emit('matched', { roomId, color: colorS, state, players });
    cb({ ok: true, roomId, color: colorS, state, players });
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
      if (!room.white && !room.black) rooms.delete(id);
      else io.to(id).emit('opponentLeft');
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`UNO Chess server on port ${PORT}`);
});
