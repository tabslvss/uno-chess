import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';
import { viewFor } from '@/game/engine';
import { timeControlById } from '@/game/rating';
import type { Side } from '@/game/types';
import type { GameController } from '@/game/ui/controller';
import { GameScreen } from '@/game/ui/GameScreen';
import { useLocalClock } from '@/game/ui/useLocalClock';
import { useLocalGame } from '@/stores/localGame';
import { useSettings } from '@/stores/settings';

/** Pass & play on one device. Hands are hidden between turns. */
export default function LocalGame() {
  const { setup, state, act, start } = useLocalGame();
  const flip = useSettings((s) => s.flipLocal);
  const clock = useLocalClock();
  const [revealed, setRevealed] = useState<Side | null>(null);

  // A new player is up: hide cards until they confirm.
  const actor = state?.turn ?? 'w';
  useEffect(() => {
    if (state && !state.result && revealed !== actor) setRevealed(null);
  }, [actor, state, revealed]);

  const controller = useMemo<GameController | null>(() => {
    if (!state || !setup) return null;
    const tc = setup.tc ? timeControlById(setup.tc) : null;
    const names = setup.names ?? { w: 'White', b: 'Black' };
    const concealed = !state.result && revealed !== state.turn && state.turnCount + state.history.length > 0;
    return {
      mode: 'local',
      state: viewFor(state, state.turn),
      me: state.turn,
      orientation: flip ? (state.result ? 'w' : state.turn) : 'w',
      seats: {
        w: { name: names.w, seed: `local-w-${names.w}`, avatarUrl: setup.avatars?.w, subtitle: 'White' },
        b: { name: names.b, seed: `local-b-${names.b}`, avatarUrl: setup.avatars?.b, subtitle: 'Black' },
      },
      clock,
      act: (a) => {
        const err = act(state.turn, a);
        if (err) toast.error(err);
      },
      resign: () => act(state.turn, { type: 'resign' }),
      title: 'Pass & play',
      subtitle: tc ? `${tc.label}` : 'Untimed',
      newGame: () =>
        start({
          ...setup,
          names: { w: names.b, b: names.w },
          avatars: setup.avatars ? { w: setup.avatars.b, b: setup.avatars.w } : undefined,
        }),
      concealed,
      reveal: () => setRevealed(state.turn),
    };
  }, [state, setup, flip, clock, revealed, act, start]);

  if (!setup || setup.mode !== 'local' || !controller) return <Navigate to="/play?tab=local" replace />;
  return <GameScreen c={controller} />;
}

