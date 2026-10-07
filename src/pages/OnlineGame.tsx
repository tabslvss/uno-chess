import { Home } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Spinner } from '@/components/ui';
import { formatRating, timeControlById } from '@/game/rating';
import type { Side } from '@/game/types';
import type { GameController, SeatInfo } from '@/game/ui/controller';
import { GameScreen } from '@/game/ui/GameScreen';
import { CopyInvite } from '@/components/CopyInvite';
import type { CreateOptions, PublicPlayer } from '@/net/protocol';
import { useOnlineGame } from '@/net/useOnlineGame';
import { Logo } from '@/components/Logo';

function seatFrom(p: PublicPlayer | null, fallback: string): SeatInfo {
  if (!p) return { name: fallback, seed: fallback, subtitle: 'waiting…', connected: true };
  return {
    name: p.name,
    seed: p.publicId,
    avatarUrl: p.avatarUrl,
    subtitle: p.guest ? 'Guest' : p.rating ? formatRating(p.rating) : undefined,
    connected: p.connected,
    guest: p.guest,
  };
}

export default function OnlineGame() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const create = useMemo<CreateOptions | undefined>(() => {
    if (params.get('create') !== '1') return undefined;
    const color = params.get('color');
    return {
      tc: params.get('tc') ?? '5+3',
      rated: params.get('rated') === '1',
      color: color === 'w' || color === 'b' ? color : 'random',
    };
  }, [params]);
  const { room, receivedAt, status, fatal, chat, send, act } = useOnlineGame(id, create);
  const shareUrl = `${window.location.origin}/game/${id}`;

  const controller = useMemo<GameController | null>(() => {
    if (!room?.state) return null;
    const tc = timeControlById(room.tc);
    const me: Side | null = room.you;
    const canAbort = !!me && room.status === 'playing' && room.state.turnCount < 2;
    return {
      mode: 'online',
      state: room.state,
      me,
      orientation: me ?? 'w',
      seats: { w: seatFrom(room.players.w, 'White'), b: seatFrom(room.players.b, 'Black') },
      clock: { ...room.clock, at: receivedAt },
      act,
      resign: () => act({ type: 'resign' }),
      title: me ? `${room.mode === 'ranked' ? 'Ranked' : room.mode === 'casual' ? 'Casual' : 'Friendly'} game` : 'Spectating',
      subtitle: `${tc.label} · ${room.rated ? 'rated' : 'unrated'}${room.spectators ? ` · ${room.spectators} watching` : ''}`,
      drawOffer: room.drawOffer,
      offerDraw: me && room.status === 'playing' ? () => send({ t: 'offerDraw' }) : undefined,
      answerDraw: (accept) => send({ t: 'answerDraw', accept }),
      canAbort,
      abort: () => send({ t: 'abort' }),
      rematch: room.rematch,
      requestRematch: me ? (want) => send({ t: 'rematch', want }) : undefined,
      ratingChange: room.ratingChange,
      rated: room.rated,
      chat,
      sendChat: (index) => send({ t: 'chat', index }),
      connection: status === 'unavailable' ? 'unavailable' : status,
      spectators: room.spectators,
      shareUrl,
    };
  }, [room, receivedAt, act, send, chat, status, shareUrl]);

  if (fatal || status === 'unavailable' || status === 'closed') {
    return (
      <CenterCard>
        <h1 className="font-display text-3xl font-bold">Hmm, no game here</h1>
        <p className="mt-2 text-ink-soft">
          {status === 'unavailable'
            ? 'Online play isn’t configured on this site yet (VITE_PARTYKIT_HOST).'
            : (fatal ?? 'This game is no longer available.')}
        </p>
        <Link to="/play" className="btn-primary mt-6">
          <Home size={16} /> Back to the lobby
        </Link>
      </CenterCard>
    );
  }

  if (!room || !room.state || room.status === 'waiting') {
    return (
      <CenterCard>
        {room?.status === 'waiting' ? (
          <>
            <h1 className="font-display text-3xl font-bold">Waiting for your friend…</h1>
            <p className="mt-2 text-ink-soft">
              Send them this link. The game starts as soon as they open it ({timeControlById(room.tc).label}
              {room.rated ? ', rated' : ''}).
            </p>
            <CopyInvite url={shareUrl} />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-ink-soft">
              <Spinner className="h-4 w-4 border-2" /> Your seat is saved — you can keep this tab open.
            </div>
            <button className="btn-ghost mt-4" onClick={() => send({ t: 'abort' })}>
              Cancel invite
            </button>
          </>
        ) : (
          <>
            <Spinner className="h-8 w-8 text-terracotta" />
            <p className="mt-4 font-bold text-ink-soft">{status === 'reconnecting' ? 'Reconnecting…' : 'Joining game…'}</p>
          </>
        )}
      </CenterCard>
    );
  }

  return <GameScreen c={controller!} />;
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4">
      <div className="w-full max-w-6xl py-4">
        <Logo small />
      </div>
      <div className="card-surface mt-[10vh] flex w-full max-w-lg flex-col items-center p-8 text-center">{children}</div>
    </div>
  );
}
