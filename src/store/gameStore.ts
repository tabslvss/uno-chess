import { create } from 'zustand';
import { UnoChess, randomPlayer, type GameState, type Color, type PieceType, type Square, type GameAction } from '../game/api';
import { runAiStep } from '../game/ai';
import { isReverseBonusPending, allCardsUnplayable } from '../game/engine';
import { getLegalMovesForPiece } from '../game/chess';
import { squareLabel } from '../game/uno';
import { playSoundForStateTransition, unlockChessAudio } from '../lib/chessSounds';
import {
  connectSocket,
  createRoom,
  joinRoom,
  findMatch,
  leaveQueue,
  sendAction,
  reportTimeout,
  onState,
  onMatched,
  onOpponentLeft,
  onOpponentReconnected,
  onEloUpdate,
  clearAllListeners,
  disconnectSocket,
  startMatchmakingWarmup,
  stopMatchmakingWarmup,
  type MatchPlayers,
} from '../net/socket';
import {
  parsePath,
  stashPendingJoinCode,
  stashPendingRejoinRoom,
  takePendingJoinCode,
  takePendingRejoinRoom,
} from '../lib/routes';
import { syncRouteFromStore } from '../lib/syncRoute';
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
const TOAST_MS = 3200;

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface GameToast {
  id: string;
  text: string;
  kind: ToastKind;
}

let toastSeq = 0;

interface GameStore {
  screen: Screen;
  gameMode: GameMode | null;
  state: GameState;
  tutorialDone: boolean;
  botDifficulty: BotDifficulty;
  aiColor: Player | null;
  myColor: Player | null;
  roomId: string | null;
  onlineError: string | null;
  onlineLoading: boolean;
  waitingForOpponent: boolean;
  eloMessage: string | null;
  /** Display names for online games (white / black seats). */
  playerNames: Record<Player, string> | null;
  aiThinking: boolean;
  aiTimeoutId: ReturnType<typeof setTimeout> | null;
  // Chess clock
  timers: Record<Player, number>;
  timerInterval: ReturnType<typeof setInterval> | null;
  canDiscardRedraw: () => boolean;
  toasts: GameToast[];
  premove: { from: Square; to: Square } | null;
  premoveDraft: Square | null;

  pushToast: (text: string, kind?: ToastKind) => void;
  queuePremoveSquare: (sq: Square) => void;
  clearPremove: () => void;
  tryConsumePremove: () => void;

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
  hydrateFromUrl: () => Promise<void>;
  displayState: () => GameState;
}

function pushRoute(get: () => GameStore): void {
  const { screen, gameMode, roomId, waitingForOpponent } = get();
  syncRouteFromStore(screen, gameMode, roomId, waitingForOpponent);
}

function canAct(state: GameState, myColor: Player | null, aiThinking: boolean): boolean {
  if (!myColor || aiThinking) return false;
  return state.currentPlayer === myColor;
}

function botThinkDelayMs(): number {
  return BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
}

function toastKindForMessage(text: string): ToastKind {
  const t = text.toLowerCase();
  if (t.includes('checkmate') || t.includes('wins')) return 'success';
  if (t.includes('in check') || t.includes('check')) return 'warn';
  if (t.includes('draw') || t.includes('stalemate')) return 'info';
  if (t.includes('skip') || t.includes('bonus') || t.includes('reverse')) return 'info';
  return 'info';
}

function feedbackForTransition(prev: GameState, next: GameState): string | null {
  if (next.message !== prev.message) return next.message;
  if (next.lastEvent?.type === 'draw' && next.lastEvent.cardId !== prev.lastEvent?.cardId) {
    return 'Drew a card.';
  }
  if (next.lastEvent?.type === 'play' && next.lastEvent.cardId !== prev.lastEvent?.cardId) {
    return 'Card played.';
  }
  if (next.phase === 'chess' && prev.phase === 'playCard') return 'Make your chess move.';
  if (next.phase === 'gameOver' && prev.phase !== 'gameOver') return next.message;
  return null;
}

function namesFromPlayers(players: MatchPlayers): Record<Player, string> {
  return {
    white: players.white.username,
    black: players.black?.username ?? 'Opponent',
  };
}

function applyGameState(
  get: () => GameStore,
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  next: GameState,
  extra?: Partial<GameStore>,
): void {
  const prev = get().state;
  set({ state: next, ...extra });
  const note = feedbackForTransition(prev, next);
  if (note) get().pushToast(note, toastKindForMessage(note));
  playSoundForStateTransition(prev, next);
  get().tryConsumePremove();
}

function bindOnlineHandlers(
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
): void {
  // Clear any stale handlers from a previous session before adding new ones
  clearAllListeners();

  onState((s) => {
    const { gameMode, screen } = get();
    applyGameState(get, set, s, {
      waitingForOpponent: false,
      screen: gameMode === 'online' && screen !== 'game' ? 'game' : screen,
    });
    if (s.phase === 'gameOver') get().stopClock();
    else if (!get().timerInterval) get().startClock();
  });
  onMatched((data) => {
    unlockChessAudio();
    stopMatchmakingWarmup();
    set({
      state: data.state,
      roomId: data.roomId,
      myColor: data.color,
      playerNames: namesFromPlayers(data.players),
      waitingForOpponent: false,
      screen: 'game',
    });
    get().startClock();
    pushRoute(get);
  });
  onOpponentLeft(() =>
    set({ onlineError: 'Opponent disconnected — they may reconnect.', waitingForOpponent: false }),
  );
  onOpponentReconnected(() => {
    set({ onlineError: null });
    get().pushToast('Opponent reconnected.', 'success');
  });
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
  if (msg.includes('connecting') || msg.includes('try again in a moment')) {
    return 'Still connecting to the game server…';
  }
  if (msg.includes('xhr poll error') || msg.includes('websocket error') || msg.includes('not connected')) {
    if (import.meta.env.PROD) {
      return 'Lost connection to the game server. Try again.';
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
  botDifficulty: 'medium',
  aiColor: null,
  myColor: null,
  roomId: null,
  onlineError: null,
  onlineLoading: false,
  waitingForOpponent: false,
  eloMessage: null,
  playerNames: null,
  aiThinking: false,
  aiTimeoutId: null,
  timers: { white: TURN_SECONDS, black: TURN_SECONDS },
  timerInterval: null,
  toasts: [],
  premove: null,
  premoveDraft: null,

  pushToast: (text, kind = 'info') => {
    const id = `toast-${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_MS);
  },

  clearPremove: () => set({ premove: null, premoveDraft: null }),

  queuePremoveSquare: (sq) => {
    const { premoveDraft, myColor, state } = get();
    if (!myColor || state.currentPlayer === myColor || state.phase === 'gameOver') return;

    if (!premoveDraft) {
      set({ premoveDraft: sq });
      get().pushToast(`Premove from ${squareLabel(sq)} — click destination`, 'info');
      return;
    }

    if (premoveDraft.file === sq.file && premoveDraft.rank === sq.rank) {
      get().clearPremove();
      get().pushToast('Premove cleared', 'info');
      return;
    }

    set({
      premove: { from: premoveDraft, to: sq },
      premoveDraft: null,
    });
    get().pushToast(
      `Premove: ${squareLabel(premoveDraft)} → ${squareLabel(sq)}`,
      'success',
    );
  },

  tryConsumePremove: () => {
    const { state, myColor, premove, aiThinking } = get();
    if (!premove || !myColor || aiThinking) return;
    if (state.phase !== 'chess' || state.currentPlayer !== myColor || !state.activeCard) return;

    const legal = getLegalMovesForPiece(state, premove.from, state.activeCard);
    const ok = legal.some((t) => t.file === premove.to.file && t.rank === premove.to.rank);
    if (!ok) {
      get().pushToast('Premove illegal with this card — cleared', 'warn');
      get().clearPremove();
      return;
    }

    const piece = state.board[premove.from.rank]?.[premove.from.file];
    if (piece?.type === 'pawn' && (premove.to.rank === 0 || premove.to.rank === 7)) {
      get().clearPremove();
      set({
        state: {
          ...state,
          selectedSquare: premove.from,
          pendingPromotion: { from: premove.from, to: premove.to },
          message: 'Choose promotion.',
        },
      });
      get().pushToast('Choose a piece to promote to', 'info');
      return;
    }

    get().clearPremove();
    get().dispatch({ type: 'move', from: premove.from, to: premove.to });
    get().pushToast(`Premove executed: ${squareLabel(premove.from)} → ${squareLabel(premove.to)}`, 'success');
  },

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

    applyGameState(get, set, state, { aiTimeoutId: null });

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
      set({ aiTimeoutId: wildId, aiThinking: true });
      return;
    }

    if (state.currentPlayer === aiColor && state.phase === 'playCard') {
      const id = setTimeout(() => get().runBotStep(), botThinkDelayMs());
      set({ aiTimeoutId: id, aiThinking: true });
      return;
    }

    get().cancelBotSchedule();
  },

  openLobby: () => {
    get().cancelBotSchedule();
    get().stopClock();
    leaveQueue();
    stopMatchmakingWarmup();
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
      onlineError: null,
      onlineLoading: false,
      waitingForOpponent: false,
      eloMessage: null,
      playerNames: null,
      toasts: [],
      premove: null,
      premoveDraft: null,
    });
    pushRoute(get);
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
      waitingForOpponent: false,
      playerNames: null,
      timers: { white: TURN_SECONDS, black: TURN_SECONDS },
    });
    unlockChessAudio();
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
      pushRoute(get);
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
      const { roomId, color, state, players } = await joinRoom(trimmed);
      set({
        screen: 'game',
        gameMode: 'online',
        roomId,
        myColor: color,
        state,
        playerNames: namesFromPlayers(players),
        onlineLoading: false,
        waitingForOpponent: false,
      });
      get().startClock();
      pushRoute(get);
    } catch (e) {
      set({ onlineLoading: false, onlineError: onlineErrorMessage(e) });
    }
  },

  startRandomMatch: async () => {
    set({ onlineLoading: true, onlineError: null, eloMessage: null });
    startMatchmakingWarmup();
    try {
      await connectSocket();
      bindOnlineHandlers(set, get);
      const res = await findMatch();
      if (res.state && res.roomId && res.color && res.players) {
        stopMatchmakingWarmup();
        set({
          screen: 'game',
          gameMode: 'online',
          roomId: res.roomId,
          myColor: res.color,
          state: res.state,
          playerNames: namesFromPlayers(res.players),
          onlineLoading: false,
          waitingForOpponent: false,
        });
        get().startClock();
        pushRoute(get);
      } else if (res.queued) {
        set({
          screen: 'waiting',
          gameMode: 'online',
          roomId: null,
          onlineLoading: false,
          waitingForOpponent: true,
          onlineError: null,
        });
        pushRoute(get);
      } else {
        stopMatchmakingWarmup();
        set({ onlineLoading: false, onlineError: res.error ?? 'Match failed' });
      }
    } catch (e) {
      stopMatchmakingWarmup();
      set({ onlineLoading: false, onlineError: onlineErrorMessage(e) });
    }
  },

  hydrateFromUrl: async () => {
    const route = parsePath(window.location.pathname);
    const pendingJoin = takePendingJoinCode();
    const pendingRejoin = takePendingRejoinRoom();

    if (route.kind === 'home' && !pendingJoin && !pendingRejoin) {
      if (get().screen !== 'lobby' && get().gameMode === 'online') {
        get().openLobby();
      }
      return;
    }

    const session = useAuthStore.getState().session;

    if (route.kind === 'join' || pendingJoin) {
      const code = route.kind === 'join' ? route.roomId : pendingJoin!;
      if (!session) {
        stashPendingJoinCode(code);
        useAuthStore.getState().setPendingReturn('join-code');
        set({ screen: 'join-code', onlineError: null });
        return;
      }
      set({ screen: 'join-code' });
      await get().startJoinGame(code);
      return;
    }

    if (route.kind === 'game' || pendingRejoin) {
      const code = route.kind === 'game' ? route.roomId : pendingRejoin!;
      if (!session) {
        stashPendingRejoinRoom(code);
        useAuthStore.getState().setPendingReturn('join-code');
        set({ screen: 'auth', onlineError: null });
        return;
      }
      set({ onlineLoading: true, onlineError: null });
      try {
        await connectSocket();
        bindOnlineHandlers(set, get);
        const { roomId, color, state, players } = await joinRoom(code);
        const waiting = !players.black;
        set({
          screen: waiting ? 'waiting' : 'game',
          gameMode: 'online',
          roomId,
          myColor: color,
          state,
          playerNames: namesFromPlayers(players),
          onlineLoading: false,
          waitingForOpponent: waiting,
        });
        if (!waiting) get().startClock();
        pushRoute(get);
      } catch (e) {
        set({
          onlineLoading: false,
          onlineError: onlineErrorMessage(e),
          screen: 'join-code',
        });
      }
      return;
    }

    if (route.kind === 'queue') {
      if (!session) {
        useAuthStore.getState().setPendingReturn('waiting');
        set({ screen: 'auth', onlineError: null });
        return;
      }
      await get().startRandomMatch();
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
    const prev = state;
    get().dispatch({ type: 'discardForRedraw', cardId });
    const next = get().state;
    if (next !== prev) {
      get().pushToast('Card swapped — play a card from your hand.', 'info');
    }
  },

  dispatch: (action) => {
    const { state, gameMode, roomId, myColor, aiThinking } = get();
    if (!canAct(state, myColor, aiThinking)) return;
    if (gameMode === 'online' && roomId) {
      sendAction(roomId, action);
      return;
    }
    unlockChessAudio();
    const next = UnoChess.apply(state, action).state;
    applyGameState(get, set, next);
    if (gameMode === 'bot' && myColor && next.phase !== 'gameOver') {
      if (next.currentPlayer !== myColor) {
        get().scheduleBotTurn();
      } else if (next.phase === 'playCard' && (next.extraCardPlays ?? 0) === 0) {
        get().cancelBotSchedule();
      }
    }
  },

  playCard: (id, wild) => {
    unlockChessAudio();
    get().dispatch({ type: 'playCard', cardId: id, wildColor: wild });
  },
  pickWild: (c) => get().dispatch({ type: 'pickWild', color: c }),
  veto: (cardId) => get().dispatch({ type: 'veto', cardId }),
  concedeCapture: () => get().dispatch({ type: 'acceptCapture' }),

  tapSquare: (sq) => {
    unlockChessAudio();
    const { state, myColor, aiThinking } = get();
    if (
      myColor &&
      !aiThinking &&
      state.currentPlayer !== myColor &&
      state.phase !== 'gameOver'
    ) {
      get().queuePremoveSquare(sq);
      return;
    }
    if (!canAct(state, myColor, aiThinking) || state.phase !== 'chess') return;
    const sel = state.selectedSquare;
    if (sel) {
      const targets = UnoChess.targetSquares(state);
      const isTarget = targets.some((t) => t.file === sq.file && t.rank === sq.rank);
      const piece = state.board[sel.rank][sel.file];
      if (isTarget && piece?.type === 'pawn' && (sq.rank === 0 || sq.rank === 7)) {
        set({
          state: {
            ...state,
            selectedSquare: sel,
            pendingPromotion: { from: sel, to: sq },
            message: 'Choose promotion.',
          },
        });
        return;
      }
    }
    get().dispatch({ type: 'selectSquare', square: sq });
  },

  movePiece: (from, to) => {
    unlockChessAudio();
    const { state, myColor, aiThinking } = get();
    if (!canAct(state, myColor, aiThinking)) return;
    const piece = state.board[from.rank][from.file];
    if (piece?.type === 'pawn' && (to.rank === 0 || to.rank === 7)) {
      set({
        state: {
          ...state,
          selectedSquare: from,
          pendingPromotion: { from, to },
          message: 'Choose promotion.',
        },
      });
      return;
    }
    get().dispatch({ type: 'move', from, to });
  },

  promote: (piece) => {
    unlockChessAudio();
    const { state } = get();
    const pending = state.pendingPromotion;
    if (!pending || state.phase !== 'chess') return;
    get().dispatch({
      type: 'move',
      from: pending.from,
      to: pending.to,
      promotion: piece,
    });
  },

  leaveGame: () => get().openLobby(),
}));
