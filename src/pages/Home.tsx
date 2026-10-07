import { AppIcon } from '@/components/AppIcon';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { HeroBoard } from '@/components/HeroBoard';
import { OptionalImg } from '@/components/OptionalImg';
import { PageShell } from '@/components/PageShell';
import { BOTS } from '@/game/ai/bots';
import type { Card } from '@/game/types';
import { GameCard } from '@/game/ui/GameCard';
import { partyHttpUrl } from '@/net/config';
import { RankBadge, useLeaderboard } from './Leaderboard';

const c = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });

function useOnlineCount() {
  return useQuery({
    queryKey: ['lobby-stats'],
    queryFn: async () => {
      const url = partyHttpUrl('/parties/main/lobby');
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as { online: number; queued: number; games: number };
    },
    refetchInterval: 20_000,
  });
}

function Band({ children, alt }: { children: React.ReactNode; alt?: boolean }) {
  return (
    <section className={alt ? 'bg-bg-soft/60' : ''}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function Home() {
  const stats = useOnlineCount();
  const top = useLeaderboard('blitz', 5);

  return (
    <PageShell wide>
      {/* Hero */}
      <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col items-center justify-center gap-12 px-6 py-10 lg:min-h-dvh lg:flex-row lg:gap-16">
        <HeroBoard size="min(600px, 78vh, 88vw)" />
        <div className="flex max-w-md flex-col items-center text-center">
          <h1 className="text-4xl leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Play UNO Chess Online</h1>
          <p className="mt-5 text-lg text-ink-soft">
            Chess, except every move needs the right card. Play friends, bots and ranked opponents — free, no download.
          </p>
          <div className="mt-9 flex w-full max-w-sm flex-col gap-4">
            <Link to="/play" className="btn-primary btn-xl" data-testid="cta-play">
              <AppIcon name="play" size={34} />
              Play Online
            </Link>
            <Link to="/play?tab=bot" className="btn-secondary btn-xl">
              <AppIcon name="bots" size={34} />
              Play a Bot
            </Link>
          </div>
          {stats.data && stats.data.online > 0 && (
            <p className="mt-6 text-sm text-ink-faint">
              <span className="font-bold text-ink">{stats.data.online.toLocaleString()}</span> playing now
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <Band alt>
        <div className="flex justify-center">
          <div className="flex">
            {[c('a', 'number', 'yellow', 3), c('b', 'reverse', 'red'), c('d', 'draw2', 'blue'), c('e', 'wild', null)].map((card, i) => (
              <div key={card.id} style={{ marginLeft: i ? -42 : 0, transform: `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 10}px)` }}>
                <GameCard card={card} width={110} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-3xl">Every move needs the right card</h2>
          <p className="mt-4 text-ink-soft">
            Play a card that matches the pile, then move a piece standing on that card’s file or rank — C means the c-file or rank 3.
            Wilds move anything, Reverse undoes your opponent’s last move, and there’s no check: you win by capturing the king.
          </p>
          <Link to="/rules" className="btn-secondary mt-7">
            Learn the rules
          </Link>
        </div>
      </Band>

      {/* Bots */}
      <Band>
        <div className="md:order-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2">
            {BOTS.map((b) => (
              <Link
                key={b.id}
                to="/play?tab=bot"
                className="group overflow-hidden rounded-xl bg-surface-2 transition hover:-translate-y-1"
              >
                <OptionalImg
                  srcs={[b.avatar]}
                  alt=""
                  className="aspect-square w-full object-cover transition group-hover:scale-105"
                />
                <div className="px-3 py-2">
                  <div className="font-display font-bold">{b.name}</div>
                  <div className="text-xs text-ink-faint">{b.rating}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="md:order-1">
          <h2 className="text-3xl">Practice against bots</h2>
          <p className="mt-4 text-ink-soft">
            Four bots from beginner to expert. They only see what you’d see — the board, the pile and their own hand — and the strongest one
            counts every card that’s been played.
          </p>
          <Link to="/play?tab=bot" className="btn-primary mt-7">
            Choose a bot
          </Link>
        </div>
      </Band>

      {/* Leaderboard */}
      <Band alt>
        <div className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 font-display font-bold">
              <AppIcon name="blitz" size={20} /> Blitz leaders
            </span>
            <Link to="/leaderboard" className="text-sm font-bold text-brand hover:underline">
              View all
            </Link>
          </div>
          <ul>
            {(top.data ?? []).map((r) => (
              <li key={r.user_id} className="flex items-center gap-3 px-4 py-2.5">
                <RankBadge rank={r.rank} />
                <Avatar seed={r.username} url={r.avatar_url} name={r.username} size={30} className="rounded-md" />
                <span className="min-w-0 flex-1 truncate font-bold">{r.username}</span>
                <span className="font-display font-bold">{r.rating}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-3xl">Climb the ladder</h2>
          <p className="mt-4 text-ink-soft">
            Ranked games use Glicko-2 ratings — the same system as the big chess sites — with separate bullet, blitz and rapid ratings. Everyone
            starts at 1200.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/play?tab=online" className="btn-primary">
              Play ranked
            </Link>
            <Link to="/login?mode=signup" className="btn-secondary">
              Create account
            </Link>
          </div>
        </div>
      </Band>
    </PageShell>
  );
}
