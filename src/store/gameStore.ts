import { create } from 'zustand';
import { UnoChess, randomPlayer, type GameState, type Color, type PieceType, type Square, type GameAction } from '../game/api';
import { runAiStep } from '../game/ai';
import { isReverseBonusPending, allCardsUnplayable } from '../game/engine';
import {
  connectSocket,
  createRoom,
  joinRoom,
  findMatch,
  sendAction,
  reportTimeout,
  onState,
  onMatched,
  onOpponentLeft,
  onEloUpdate,
  clearAllListeners,
  disconnectSocket,
} from '../net/socket';
import { useAuthStore } from './authStore';
import type { BotDifficulty, Player } from '../game/types';

export type GameMode = 'bot' | 'online';
export type Screen =
  | 'lobby'
  | 'bot-pick'
  | 'friend-menu'
  | 'join-code'
  | 'auth'
  | 'game'
  | 'waiting';

const BOT_THINK_MIN_MS = 2000;
const BOT_THINK_MAX_MS = 5000;
const BOT_MOVE_DELAY_MS = 600;
const BOT_REVERSE_CHAIN_MS = 400;
const BOT_WILD_PICK_MS = 250;
const TURN_SECONDS = 600; // 10 minutes per player

interface GameStore {
  screen: Screen;
  gameMode: GameMode | null;
  state: GameState;
  tutorialDone: boolean;
  promotionPending: { from: Square; to: Square } | null;
  botDifficulty: BotDifficulty;
  aiColor: Player | null;
  myColor: Player | null;
  roomId: string | null;
  onlineError: string | null;
  onlineLoading: boolean;
  waitingForOpponent: boolean;
  eloMessage: string | null;
  aiThinking: boolean;
  aiTimeoutId: ReturnType<typeof setTimeout> | null;
  // Chess clock
  timers: Record<Player, number>;
  timerInterval: ReturnType<typeof setInterval> | null;
  canDiscardRedraw: () => boolean;

  openLobby: () => void;
  showBotPicker: () => void;
  showFriendMenu: () => void;
  showJoinCode: () => void;
  showAuth: (returnScreen: Screen) => void;
  startBot: (difficulty: BotDifficulty) => void;
  startCreateGame: () => Promise<void>;
  startJoinGame: (code: string) => Promise<void>;
  startRandomMatch: () => Promise<void>;
  finishTutorial: () => void;
  dispatch: (action: GameAction) => void;
  playCard: (id: string, wild?: Color) => void;
  pickWild: (c: Color) => void;
  tapSquare: (sq: Square) => void;
  movePiece: (from: Square, to: Square) => void;
  promote: (piece: PieceType) => void;
  veto: (cardId: string) => void;
  concedeCapture: () => void;
  discardAndRedraw: (cardId: string) => void;
  cancelBotSchedule: () => void;
  scheduleBotTurn: () => void;
  runBotStep: () => void;
  startClock: () => void;
  stopClock: () => void;
  tickClock: () => void;
  leaveGame: () => void;
  displayState: () => GameState;
}

function canAct(state: GameState, myColor: Player | null, aiThinking: boolean): boolean {
  if (!myColor || aiThinking) return false;
  return state.currentPlayer === myColor;
}

function botThinkDelayMs(): number {
  return BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
}

function bindOnlineHandlers(
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
): void {
  // Clear any stale handlers from a previous session before adding new ones
  clearAllListeners();

  onState((s) => {
    const { gameMode, screen } = get();
    set({
      state: s,
      waitingForOpponent: false,
      screen: gameMode === 'online' && screen !== 'game' ? 'game' : screen,
    });
    if (s.phase === 'gameOver') get().stopClock();
    else if (!get().timerInterval) get().startClock();
  });
  onMatched((data) => {
    set({
      state: data.state,
      roomId: data.roomId,
      myColor: data.color,
      waitingForOpponent: false,
      screen: 'game',
    });
    get().startClock();
  });
  onOpponentLeft(() =>
    set({ onlineError: 'Opponent disconnected.', waitingForOpponent: true }),
  );
  onEloUpdate((payload) => {
    const { myColor } = get();
    if (!myColor) return;
    const newElo = myColor === 'white' ? payload.whiteElo : payload.blackElo;
    const delta = myColor === 'white' ? payload.whiteDelta : payload.blackDelta;
    useAuthStore.getState().applyEloFromServer(newElo);
    void useAuthStore.getState().refreshProfile();
    set({
      eloMessage: `ELO ${delta >= 0 ? '+' : ''}${delta} (now ${newElo})`,
    });
  });
}

function onlineErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const msg = raw.toLowerCase();
  if (!raw) return 'Could not connect to the game server.';
  if (msg.includes('not logged in') || msg.includes('login required')) {
    return 'Please log in to play online.';
  }
  if (msg.includes('invalid session')) return 'Session expired. Log in again.';
  if (msg.includes('room not found')) return 'No room with that code. Double-check it.';
  if (msg.includes('room is full')) return 'That room is already full.';
  if (msg.includes('already in this room')) return 'You’re already in this room.';
  if (msg.includes('too long') || msg.includes("didn’t respond") || msg.includes("didn't respond")) {
    return 'Server didn’t respond. Make sure the dev server is running.';
  }
  if (msg.includes('not set up yet') || msg.includes('hosting.md')) {
    return raw;
  }
  if (msg.includes('xhr poll error') || msg.includes('websocket error') || msg.includes('not connected')) {
    if (import.meta.env.PROD) {
      return 'Can’t reach the game server. Deploy the API on Render and set VITE_SERVER_URL on Vercel (see HOSTING.md).';
    }
    return 'Can’t reach the game server. Run npm run dev in the project folder (starts web + server).';
  }
  return raw;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'lobby',
  gameMode: null,
  state: UnoChess.newGame(),
  tutorialDone: localStorage.getItem('unochess-tutorial') === 'done',
  promotionPending: null,
  botDifficulty: 'medium',
  aiColor: null,
  myColor: null,
  roomId: null,
  onlineError: null,
  onlineLoading: false,
  waitingForOpponent: false,
  eloMessage: null,
  aiThinking: false,
  aiTimeoutId: null,
  timers: { white: TURN_SECONDS, black: TURN_SECONDS },
  timerInterval: null,

  canDiscardRedraw: () => {
    const { state, myColor, aiThinking } = get();
    if (!myColor || aiThinking) return false;
    if (state.currentPlayer !== myColor) return false;
    if (state.phase !== 'playCard') return false;
    return allCardsUnplayable(state, myColor);
  },

  startClock: () => {
    const existing = get().timerInterval;
    if (existing) clearInterval(existing);
    const id = setInterval(() => get().tickClock(), 1000);
    set({ timerInterval: id });
  },

  stopClock: () => {
    const id = get().timerInterval;
    if (id) clearInterval(id);
    set({ timerInterval: null });
  },

  tickClock: () => {
    const { state, timers } = get();
    if (state.phase === 'gameOver') { get().stopClock(); return; }
    const player = state.currentPlayer;
    const remaining = timers[player] - 1;
    if (remaining <= 0) {
      get().stopClock();
      const { gameMode, roomId } = get();
      if (gameMode === 'online' && roomId) {
        reportTimeout(roomId, player);
        set({ timers: { ...timers, [player]: 0 } });
        return;
      }
      const winner: Player = player === 'white' ? 'black' : 'white';
      const loser = player;
      set({
        state: {
          ...state,
          phase: 'gameOver',
          result: winner,
          resultReason: `${loser.charAt(0).toUpperCase() + loser.slice(1)} ran out of time.`,
          message: `${winner} wins on time!`,
        },
        timers: { ...timers, [player]: 0 },
      });
    } else {
      set({ timers: { ...timers, [player]: remaining } });
    }
  },

  displayState: () => {
    const { state, myColor } = get();
    if (!myColor) return state;
    return UnoChess.viewForPlayer(state, myColor);
  },

  cancelBotSchedule: () => {
    const id = get().aiTimeoutId;
    if (id != null) clearTimeout(id);
    set({ aiTimeoutId: null, aiThinking: false });
  },

  scheduleBotTurn: () => {
    const { gameMode, aiColor, state, aiThinking } = get();
    if (gameMode !== 'bot' || !aiColor || aiThinking) return;
    if (state.phase === 'gameOver' || state.currentPlayer !== aiColor) return;

    get().cancelBotSchedule();
    set({ aiThinking: true });

    const id = setTimeout(() => get().runBotStep(), botThinkDelayMs());
    set({ aiTimeoutId: id });
  },

  runBotStep: () => {
    const { gameMode, aiColor, botDifficulty, aiThinking } = get();
    if (gameMode !== 'bot' || !aiColor || !aiThinking) return;

    let state = get().state;
    if (state.phase === 'gameOver' || state.currentPlayer !== aiColor) {
      get().cancelBotSchedule();
      return;
    }

    const runStep = (s: GameState) => runAiStep(s, aiColor, botDifficulty);

    let before = state;
    state = runStep(state);

    if (state.currentPlayer === aiColor && isReverseBonusPending(state)) {
      state = runStep(state);
    }

    if (state.currentPlayer === aiColor && state.phase === 'pickWildColor') {
      state = runStep(state);
    }

    set({ state, aiTimeoutId: null });

    if (state.phase === 'gameOver' || state.currentPlayer !== aiColor) {
      get().cancelBotSchedule();
      return;
    }

    if (state === before) {
      get().cancelBotSchedule();
      return;
    }

    if (state.phase === 'chess') {
      const moveId = setTimeout(() => get().runBotStep(), BOT_MOVE_DELAY_MS);
      set({ aiTimeoutId: moveId });
      return;
    }

    if (isReverseBonusPending(state)) {
      const chainId = setTimeout(() => get().runBotStep(), BOT_REVERSE_CHAIN_MS);
      set({ aiTimeoutId: chainId });
      return;
    }

    if (state.phase === 'pickWildColor') {
      const wildId = setTimeout(() => get().runBotStep(), BOT_WILD_PICK_MS);
      set({ aiTimeoutId: wildId });
      return;
    }

    get().scheduleBotTurn();
  },

  openLobby: () => {
    get().cancelBotSchedule();
    get().stopClock();
    clearAllListeners();
    disconnectSocket();
    set({
      screen: 'lobby',
      gameMode: null,
      myColor: null,
      aiColor: null,
      timers: { white: TURN_SECONDS, black: TURN_SECONDS },
      roomId: null,
      state: UnoChess.newGame(),
      promotionPending: null,
      onlineError: null,
      onlineLoading: false,
      waitingForOpponent: false,
      eloMessage: null,
    });
  },

  showBotPicker: () => set({ screen: 'bot-pick', onlineError: null }),
  showFriendMenu: () => set({ screen: 'friend-menu', onlineError: null }),
  showJoinCode: () => set({ screen: 'join-code', onlineError: null }),
  showAuth: (returnScreen) => {
    useAuthStore.getState().setPendingReturn(returnScreen);
    set({ screen: 'auth', onlineError: null });
  },

  startBot: (difficulty) => {
    get().cancelBotSchedule();
    get().stopClock();
    const myColor = randomPlayer();
    const aiColor = myColor === 'white' ? 'black' : 'white';
    set({
      screen: 'game',
      gameMode: 'bot',
      botDifficulty: difficulty,
      myColor,
      aiColor,
      roomId: null,
      state: UnoChess.newGame(),
      promotionPending: null,
      waitingForOpponent: false,
      timers: { white: TURN_SECONDS, black: TURN_SECONDS },
    });
    get().startClock();
    if (aiColor === 'white') {
      get().scheduleBotTurn();
    }
  },

  startCreateGame: async () => {
    set({ onlineLoading: true, onlineError: null, eloMessage: null });
    try {
      await connectSocket();
      bindOnlineHandlers(set, get);
      const { roomId, color, state } = await createRoom();
      set({
        screen: 'waiting',
        gameMode: 'online',
        roomId,
        myColor: color,
        state,
        onlineLoading: false,
        waitingForOpponent: true,
      });
    } catch (e) {
      set({ onlineLoading: false, onlineError: onlineErrorMessage(e) });
    }
  },

  startJoinGame: async (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      set({ onlineError: 'Enter a room code first.' });
      return;
    }
    set({ onlineLoading: true, onlineError: null, eloMessage: null });
    try {
      await connectSocket();
      bindOnlineHandlers(set, get);
      const { roomId, color, state } = await joinRoom(trimmed);
      set({
        screen: 'game',
        gameMode: 'online',
        roomId,
        myColor: color,
        state,
        onlineLoading: false,
        waitingForOpponent: false,
      });
      get().startClock();
    } catch (e) {
      set({ onlineLoading: false, onlineError: onlineErrorMessage(e) });
    }
  },

  startRandomMatch: async () => {
    set({ onlineLoading: true, onlineError: null, eloMessage: null });
    try {
      await connectSocket();
      bindOnlineHandlers(set, get);
      const res = await findMatch();
      if (res.state && res.roomId && res.color) {
        set({
          screen: 'game',
          gameMode: 'online',
          roomId: res.roomId,
          myColor: res.color,
          state: res.state,
          onlineLoading: false,
          waitingForOpponent: false,
        });
        get().startClock();
      } else if (res.queued) {
        set({
          screen: 'waiting',
          gameMode: 'online',
          onlineLoading: false,
          waitingForOpponent: true,
          onlineError: null,
        });
      } else {
        set({ onlineLoading: false, onlineError: res.error ?? 'Match failed' });
      }
    } catch (e) {
      set({ onlineLoading: false, onlineError: onlineErrorMessage(e) });
    }
  },

  finishTutorial: () => {
    localStorage.setItem('unochess-tutorial', 'done');
    set({ tutorialDone: true });
  },

  discardAndRedraw: (cardId) => {
    const { state, myColor, aiThinking } = get();
    if (!myColor || aiThinking || state.currentPlayer !== myColor) return;
    if (state.phase !== 'playCard') return;
    get().dispatch({ type: 'discardForRedraw', cardId });
  },

  dispatch: (action) => {
    const { state, gameMode, roomId, myColor, aiThinking } = get();
    if (!canAct(state, myColor, aiThinking)) return;
    if (gameMode === 'online' && roomId) {
      sendAction(roomId, action);
      return;
    }
    const next = UnoChess.apply(state, action).state;
    set({ state: next });
    if (gameMode === 'bot' && myColor && next.currentPlayer !== myColor && next.phase !== 'gameOver') {
      get().scheduleBotTurn();
    }
  },

  playCard: (id, wild) => get().dispatch({ type: 'playCard', cardId: id, wildColor: wild }),
  pickWild: (c) => get().dispatch({ type: 'pickWild', color: c }),
  veto: (cardId) => get().dispatch({ type: 'veto', cardId }),
  concedeCapture: () => get().dispatch({ type: 'acceptCapture' }),

  tapSquare: (sq) => {
    const { state, myColor, aiThinking } = get();
    if (!canAct(state, myColor, aiThinking) || state.phase !== 'chess') return;
    const sel = state.selectedSquare;
    if (sel) {
      const targets = UnoChess.targetSquares(state);
      const isTarget = targets.some((t) => t.file === sq.file && t.rank === sq.rank);
      const piece = state.board[sel.rank][sel.file];
      if (isTarget && piece?.type === 'pawn' && (sq.rank === 0 || sq.rank === 7)) {
        set({ promotionPending: { from: sel, to: sq } });
        return;
      }
    }
    get().dispatch({ type: 'selectSquare', square: sq });
  },

  movePiece: (from, to) => {
    const { state, myColor, aiThinking } = get();
    if (!canAct(state, myColor, aiThinking)) return;
    const piece = state.board[from.rank][from.file];
    if (piece?.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
      set({ promotionPending: { from, to } });
      return;
    }
    get().dispatch({ type: 'move', from, to });
  },

  promote: (piece) => {
    const { promotionPending } = get();
    if (!promotionPending) return;
    get().dispatch({
      type: 'move',
      from: promotionPending.from,
      to: promotionPending.to,
      promotion: piece,
    });
    set({ promotionPending: null });
  },

  leaveGame: () => get().openLobby(),
}));
