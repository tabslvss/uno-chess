import { boardFromFen, INITIAL_CASTLING } from '../board';
import { createGame } from '../engine';
import type { Card, Color, GameState, Side } from '../types';

let n = 0;
export const num = (color: Color, value: number): Card => ({ id: `t${n++}`, kind: 'number', color, value });
export const rev = (color: Color): Card => ({ id: `t${n++}`, kind: 'reverse', color });
export const d2 = (color: Color): Card => ({ id: `t${n++}`, kind: 'draw2', color });
export const wild = (): Card => ({ id: `t${n++}`, kind: 'wild', color: null });

/** Build a custom game position. */
export function position(opts: {
  fen?: string;
  turn?: Side;
  w?: Card[];
  b?: Card[];
  top?: Card;
  activeColor?: Color | null;
  deck?: Card[];
  castling?: GameState['castling'];
}): GameState {
  const base = createGame({ seed: 42 });
  const top = opts.top ?? num('red', 5);
  const filler = Array.from({ length: 30 }, (_, i) => num('green', (i % 8) + 1));
  return {
    ...base,
    board: opts.fen ? boardFromFen(opts.fen) : base.board,
    turn: opts.turn ?? 'w',
    hands: { w: opts.w ?? [], b: opts.b ?? [num('blue', 1)] },
    discard: [top],
    activeColor: opts.activeColor === undefined ? top.color : opts.activeColor,
    deck: opts.deck ?? filler,
    castling: opts.castling ?? { ...INITIAL_CASTLING },
  };
}
