/**
 * Wire protocol shared by the browser client and the PartyKit server.
 * Every client → server message is validated with zod on the server.
 */
import { z } from 'zod';
import type { GameResult, GameState, Side } from '../game/types';
import type { Rating, TimeCategory } from '../game/rating';

const square = z.number().int().min(0).max(63);
const color = z.enum(['red', 'yellow', 'green', 'blue']);
const cardId = z.string().min(1).max(32);

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('play'), cardId, color: color.optional() }),
  z.object({ type: z.literal('move'), from: square, to: square, promotion: z.enum(['Q', 'R', 'B', 'N']).optional() }),
  z.object({ type: z.literal('discardDead'), cardId }),
  z.object({ type: z.literal('draw2Discard'), cardIds: z.array(cardId).max(2) }),
  z.object({ type: z.literal('veto'), cardId }),
  z.object({ type: z.literal('acceptCapture') }),
  z.object({ type: z.literal('callUno') }),
  z.object({ type: z.literal('catchUno') }),
  z.object({ type: z.literal('resign') }),
]);

export const authSchema = z.object({
  /** Supabase access token (logged-in players). */
  token: z.string().max(4096).optional(),
  /** Random per-browser secret identifying a guest. Never broadcast. */
  guestId: z.string().min(8).max(64),
  guestName: z.string().max(32).optional(),
});
export type AuthPayload = z.infer<typeof authSchema>;

export const QUICK_CHAT = [
  'Good luck! 🍀',
  'Have fun!',
  'Nice move!',
  'Wow 😮',
  'Oops 😅',
  'Well played!',
  'Good game! 🤝',
  'Thanks!',
  'Rematch?',
] as const;

export const createOptionsSchema = z.object({
  tc: z.string().max(8),
  rated: z.boolean().default(false),
  color: z.enum(['w', 'b', 'random']).default('random'),
});
export type CreateOptions = z.infer<typeof createOptionsSchema>;

export const gameClientSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), auth: authSchema, create: createOptionsSchema.optional() }),
  z.object({ t: z.literal('action'), action: gameActionSchema, seq: z.number().int() }),
  z.object({ t: z.literal('offerDraw') }),
  z.object({ t: z.literal('answerDraw'), accept: z.boolean() }),
  z.object({ t: z.literal('abort') }),
  z.object({ t: z.literal('rematch'), want: z.boolean() }),
  z.object({ t: z.literal('chat'), index: z.number().int().min(0).max(QUICK_CHAT.length - 1) }),
  z.object({ t: z.literal('ping') }),
]);
export type GameClientMessage = z.infer<typeof gameClientSchema>;

export const lobbyClientSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), auth: authSchema }),
  z.object({ t: z.literal('queue'), mode: z.enum(['casual', 'ranked']), tc: z.string().max(8) }),
  z.object({ t: z.literal('cancel') }),
]);
export type LobbyClientMessage = z.infer<typeof lobbyClientSchema>;

// ───────────────────────── server → client ─────────────────────────

export interface PublicPlayer {
  name: string;
  /** Public (non-secret) identifier — Supabase user id or a hash for guests. */
  publicId: string;
  guest: boolean;
  rating: Rating | null;
  connected: boolean;
  avatarUrl?: string | null;
}

export interface ClockSnapshot {
  /** Remaining milliseconds at `serverNow`. */
  w: number;
  b: number;
  /** Whose clock is running (null = paused / first-move grace / over). */
  running: Side | null;
  /** Deadline (ms from now) to make the first move before the game aborts. */
  firstMoveMs: number | null;
}

export interface RatingChange {
  w: { before: number; after: number };
  b: { before: number; after: number };
}

export interface RoomSnapshot {
  id: string;
  gameNo: number;
  tc: string;
  category: TimeCategory;
  rated: boolean;
  mode: 'private' | 'casual' | 'ranked';
  status: 'waiting' | 'playing' | 'over';
  players: { w: PublicPlayer | null; b: PublicPlayer | null };
  /** Seat of the receiving connection, null for spectators. */
  you: Side | null;
  state: GameState | null;
  clock: ClockSnapshot;
  drawOffer: Side | null;
  rematch: { w: boolean; b: boolean };
  ratingChange: RatingChange | null;
  result: GameResult | null;
  spectators: number;
}

export type GameServerMessage =
  | { t: 'sync'; room: RoomSnapshot }
  | { t: 'error'; message: string }
  | { t: 'chat'; side: Side | null; name: string; text: string; at: number }
  | { t: 'pong' };

export type LobbyServerMessage =
  | { t: 'welcome'; name: string; guest: boolean; ratings: Partial<Record<TimeCategory, Rating>> }
  | { t: 'queued'; mode: 'casual' | 'ranked'; tc: string; size: number; since: number }
  | { t: 'matched'; gameId: string }
  | { t: 'cancelled' }
  | { t: 'stats'; online: number; queued: number; games: number }
  | { t: 'error'; message: string };
