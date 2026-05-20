import { navigateTo, type AppRoute } from './routes';
import type { GameMode, Screen } from '../store/gameStore';

/** Keep the address bar in sync with online session state. */
export function syncRouteFromStore(
  screen: Screen,
  gameMode: GameMode | null,
  roomId: string | null,
  waitingForOpponent: boolean,
): void {
  let route: AppRoute = { kind: 'home' };

  if (gameMode === 'online') {
    if (roomId && (screen === 'game' || screen === 'waiting')) {
      route = { kind: 'game', roomId };
    } else if (screen === 'waiting' && waitingForOpponent) {
      route = { kind: 'queue' };
    }
  }

  navigateTo(route, true);
}
