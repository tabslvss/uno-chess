import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type BoardTheme = 'walnut' | 'sage' | 'dusk' | 'rose' | 'cocoa';

export interface Settings {
  theme: ThemeMode;
  board: BoardTheme;
  sound: boolean;
  volume: number;
  showLegalMoves: boolean;
  highlightLines: boolean;
  autoQueen: boolean;
  animations: boolean;
  coordinates: boolean;
  /** Pass & play: flip the board to the player whose turn it is. */
  flipLocal: boolean;
  /** Ask before resigning. */
  confirmResign: boolean;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'dark',
      board: 'sage',
      sound: true,
      volume: 0.7,
      showLegalMoves: true,
      highlightLines: true,
      autoQueen: false,
      animations: true,
      coordinates: true,
      flipLocal: true,
      confirmResign: true,
      set: (patch) => set(patch),
    }),
    {
      name: 'unochess-settings',
      version: 2,
      // v2: dark theme + green board are the new defaults.
      migrate: (persisted, version) => {
        const s = persisted as Partial<Settings>;
        if (version < 2) {
          if (s.theme === 'system') s.theme = 'dark';
          if (s.board === 'walnut') s.board = 'sage';
        }
        return s as Settings;
      },
    },
  ),
);

export function applyTheme(theme: ThemeMode): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
