import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyAction, createGame, forceResult } from '@/game/engine';
import { timeControlById } from '@/game/rating';
import type { GameAction, GameState, Side } from '@/game/types';

export interface LocalSetup {
  mode: 'bot' | 'local';
  botId?: string;
  /** Human's side in bot games. */
  humanSide?: Side;
  /** Time control id, or null for an untimed game. */
  tc: string | null;
  names?: { w: string; b: string };
  /** Random avatars for pass & play players. */
  avatars?: { w: string; b: string };
}

export interface LocalClock {
  remaining: { w: number; b: number };
  turnStartedAt: number;
  increment: number;
}

interface LocalGameStore {
  setup: LocalSetup | null;
  state: GameState | null;
  clock: LocalClock | null;
  /** Bumped on each new game so components can reset local UI. */
  gameId: number;
  start: (setup: LocalSetup) => void;
  act: (side: Side, action: GameAction) => string | null;
  tick: (now: number) => void;
  remaining: (now: number) => { w: number; b: number } | null;
  clear: () => void;
}

/** The clock starts once both players have completed their first turn (like online games). */
function clockRunning(state: GameState | null): boolean {
  return !!state && !state.result && state.turnCount >= 2;
}

export const useLocalGame = create<LocalGameStore>()(
  persist(
    (set, get) => ({
      setup: null,
      state: null,
      clock: null,
      gameId: 0,

      start: (setup) => {
        const tc = setup.tc ? timeControlById(setup.tc) : null;
        set({
          setup,
          state: createGame(),
          gameId: get().gameId + 1,
          clock: tc
            ? { remaining: { w: tc.initial * 1000, b: tc.initial * 1000 }, turnStartedAt: Date.now(), increment: tc.increment * 1000 }
            : null,
        });
      },

      act: (side, action) => {
        const { state, clock } = get();
        if (!state) return 'No game in progress.';
        const now = Date.now();
        get().tick(now);
        const current = get().state!;
        if (current.result) return 'The game is over.';
        const res = applyAction(current, side, action);
        if (!res.ok) return res.error;
        const next = res.state;
        let nextClock = clock;
        const turnChanged = next.turn !== current.turn || next.turnCount !== current.turnCount;
        if (clock && (turnChanged || next.result)) {
          const remaining = { ...clock.remaining };
          if (clockRunning(current)) {
            remaining[current.turn] -= now - clock.turnStartedAt;
            if (next.turnCount !== current.turnCount && !next.result) remaining[current.turn] += clock.increment;
          }
          nextClock = { ...clock, remaining, turnStartedAt: now };
        }
        set({ state: next, clock: nextClock });
        return null;
      },

      tick: (now) => {
        const { state, clock } = get();
        if (!state || !clock || !clockRunning(state)) return;
        const r = get().remaining(now)!;
        const side = state.turn;
        if (r[side] <= 0) {
          set({
            state: forceResult(state, side === 'w' ? 'b' : 'w', 'timeout'),
            clock: { ...clock, remaining: { ...r, [side]: 0 }, turnStartedAt: now },
          });
        }
      },

      remaining: (now) => {
        const { state, clock } = get();
        if (!clock) return null;
        const r = { ...clock.remaining };
        if (state && clockRunning(state)) r[state.turn] -= now - clock.turnStartedAt;
        return { w: Math.max(0, r.w), b: Math.max(0, r.b) };
      },

      clear: () => set({ setup: null, state: null, clock: null }),
    }),
    {
      name: 'unochess-local-game',
      version: 2,
      partialize: (s) => ({ setup: s.setup, state: s.state, clock: s.clock, gameId: s.gameId }),
      // Don't charge time spent away from the tab.
      onRehydrateStorage: () => (s) => {
        if (s?.clock) queueMicrotask(() => useLocalGame.setState({ clock: { ...s.clock!, turnStartedAt: Date.now() } }));
      },
    },
  ),
);
