import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';
import { chooseAction } from '@/game/ai/bot';
import { botById } from '@/game/ai/bots';
import { other } from '@/game/board';
import { viewFor } from '@/game/engine';
import { timeControlById } from '@/game/rating';
import type { GameAction } from '@/game/types';
import type { GameController } from '@/game/ui/controller';
import { GameScreen } from '@/game/ui/GameScreen';
import { useLocalClock } from '@/game/ui/useLocalClock';
import { displayName, useAuth } from '@/stores/auth';
import { useLocalGame } from '@/stores/localGame';

export default function BotGame() {
  const { setup, state, act, start } = useLocalGame();
  const auth = useAuth();
  const clock = useLocalClock();
  const [thinking, setThinking] = useState(false);

  const human = setup?.humanSide ?? 'w';
  const botSide = other(human);
  const bot = botById(setup?.botId);

  // Drive the bot: whenever the state changes, ask it for an action and play it after a short "think".
  useEffect(() => {
    if (!state || state.result || setup?.mode !== 'bot') return;
    const action = chooseAction(viewFor(state, botSide), botSide, bot.level);
    if (!action) {
      setThinking(false);
      return;
    }
    const sideAction = action.type === 'catchUno' || action.type === 'callUno';
    setThinking(!sideAction);
    const base = state.phase === 'move' ? 450 : state.phase === 'card' ? 700 : 500;
    const delay = sideAction ? 900 + Math.random() * 1200 : base + Math.random() * (300 + bot.level * 250);
    const t = setTimeout(() => {
      const err = act(botSide, action);
      if (err) console.warn('[bot] rejected action', action, err);
      if (action.type === 'catchUno') toast(`${bot.name} caught you without UNO!`, { icon: '🚨' });
      if (action.type === 'callUno') toast(`${bot.name}: “UNO!”`, { icon: '📣' });
    }, delay);
    return () => clearTimeout(t);
  }, [state, botSide, bot, act, setup?.mode]);

  const controller = useMemo<GameController | null>(() => {
    if (!state || !setup) return null;
    const tc = setup.tc ? timeControlById(setup.tc) : null;
    const name = displayName(auth);
    const humanSeat = { name, seed: auth.profile?.id ?? name, avatarUrl: auth.profile?.avatar_url, subtitle: 'You' };
    const botSeat = { name: bot.name, seed: bot.id, avatarUrl: bot.avatar, subtitle: `Bot · ~${bot.rating}`, isBot: true };
    return {
      mode: 'bot',
      state: viewFor(state, human),
      me: human,
      orientation: human,
      seats: human === 'w' ? { w: humanSeat, b: botSeat } : { w: botSeat, b: humanSeat },
      clock,
      busy: thinking && state.turn === botSide,
      act: (a: GameAction) => {
        const err = act(human, a);
        if (err) toast.error(err);
      },
      resign: () => act(human, { type: 'resign' }),
      title: `vs ${bot.name}`,
      subtitle: `${tc ? `${tc.label} · ` : 'Untimed · '}casual`,
      newGame: () => start({ ...setup, humanSide: other(human) }),
    };
  }, [state, setup, auth, bot, human, botSide, clock, thinking, act, start]);

  if (!setup || setup.mode !== 'bot' || !controller) return <Navigate to="/play?tab=bot" replace />;
  return <GameScreen c={controller} />;
}
