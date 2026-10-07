import type { RatingChange } from '@/net/protocol';
import type { GameAction, GameState, Side } from '@/game/types';
import type { ChatLine } from '@/net/useOnlineGame';

export interface SeatInfo {
  name: string;
  /** Seed for generated avatars. */
  seed: string;
  avatarUrl?: string | null;
  /** e.g. "1432" or "1200?" or "Bot · 900" */
  subtitle?: string;
  isBot?: boolean;
  connected?: boolean;
  guest?: boolean;
  accent?: string;
}

export interface ClockView {
  w: number;
  b: number;
  running: Side | null;
  /** performance.now() when the snapshot was taken. */
  at: number;
  firstMoveMs?: number | null;
}

/** Everything the game screen needs, implemented by bot, local and online games. */
export interface GameController {
  mode: 'bot' | 'local' | 'online';
  /** State from the perspective of `me` (hidden cards masked). */
  state: GameState;
  /** Side controlled by this screen right now (null = spectator). */
  me: Side | null;
  orientation: Side;
  seats: Record<Side, SeatInfo>;
  clock: ClockView | null;
  /** Bot is thinking / waiting for server. */
  busy?: boolean;
  act: (action: GameAction) => void;
  resign: () => void;
  title: string;
  subtitle?: string;
  // Optional online extras
  drawOffer?: Side | null;
  offerDraw?: () => void;
  answerDraw?: (accept: boolean) => void;
  canAbort?: boolean;
  abort?: () => void;
  rematch?: { w: boolean; b: boolean };
  requestRematch?: (want: boolean) => void;
  newGame?: () => void;
  ratingChange?: RatingChange | null;
  rated?: boolean;
  chat?: ChatLine[];
  sendChat?: (index: number) => void;
  connection?: 'open' | 'connecting' | 'reconnecting' | 'closed' | 'unavailable';
  spectators?: number;
  shareUrl?: string;
  /** Pass & play: hide the hand until the next player confirms. */
  concealed?: boolean;
  reveal?: () => void;
}
