import { useEffect, useMemo } from 'react';
import { useLocalGame } from '@/stores/localGame';
import type { ClockView } from './controller';

/** Clock view + flag detection for bot / pass & play games. */
export function useLocalClock(): ClockView | null {
  const clock = useLocalGame((s) => s.clock);
  const state = useLocalGame((s) => s.state);
  const tick = useLocalGame((s) => s.tick);
  useEffect(() => {
    if (!clock || !state || state.result) return;
    const id = setInterval(() => tick(Date.now()), 200);
    return () => clearInterval(id);
  }, [clock, state, tick]);
  return useMemo(() => {
    if (!clock || !state) return null;
    const running = !state.result && state.turnCount >= 2 ? state.turn : null;
    const elapsed = Date.now() - clock.turnStartedAt;
    return {
      w: clock.remaining.w,
      b: clock.remaining.b,
      running,
      // Translate the wall-clock start into the performance clock used by <Clock/>.
      at: performance.now() - elapsed,
    };
  }, [clock, state]);
}
