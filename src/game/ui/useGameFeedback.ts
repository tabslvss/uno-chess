import confetti from 'canvas-confetti';
import { useEffect, useRef } from 'react';
import type { GameState, Side } from '@/game/types';
import { playSound } from '@/lib/sounds';

/** Sounds + confetti driven by new history entries. */
export function useGameFeedback(state: GameState | null, me: Side | null, celebrate = true) {
  const seen = useRef<number | null>(null);
  const handSize = useRef<number | null>(null);
  useEffect(() => {
    if (!state) return;
    const prev = seen.current;
    seen.current = state.history.length;
    if (prev === null || state.history.length < prev) {
      if (prev === null) playSound('shuffle');
      return;
    }
    for (const e of state.history.slice(prev)) {
      switch (e.kind) {
        case 'move': {
          const san = e.san ?? '';
          if (san.startsWith('O-O')) playSound('castle');
          else if (san.includes('=')) playSound('promote');
          else if (san.includes('x')) playSound('capture');
          else playSound('move');
          if (san.endsWith('+')) setTimeout(() => playSound('check'), 120);
          break;
        }
        case 'reverse':
        case 'veto':
          playSound('cardPlay');
          setTimeout(() => playSound('move'), 140);
          break;
        case 'draw2':
          playSound('shuffle');
          break;
        case 'dead':
          playSound('cardPlay');
          break;
        case 'uno':
          playSound('uno');
          break;
        case 'catch':
          playSound('notify');
          break;
        case 'end': {
          const r = state.result;
          if (!r) break;
          const won = me ? r.winner === me : r.winner !== null;
          if (r.winner && won) {
            playSound('win');
            if (celebrate) {
              const colors = ['#d9734e', '#e3b04b', '#7a9e7e', '#5b7fa6'];
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
              setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true }), 250);
              setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true }), 400);
            }
          } else if (r.winner) playSound('lose');
          else playSound('notify');
          break;
        }
      }
    }
  }, [state, me, celebrate]);

  // Card draw sound when my hand grows.
  useEffect(() => {
    if (!state || !me) return;
    const n = state.hands[me].length;
    if (handSize.current !== null && n > handSize.current) setTimeout(() => playSound('cardDraw'), 180);
    handSize.current = n;
  }, [state, me]);

  // Card play sound when a card hits the pile.
  const pile = useRef<number | null>(null);
  useEffect(() => {
    if (!state) return;
    if (pile.current !== null && state.discard.length > pile.current && state.phase === 'move') playSound('cardPlay');
    pile.current = state.discard.length;
  }, [state]);
}
