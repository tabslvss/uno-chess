import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { PageShell, PageTitle } from '@/components/PageShell';
import { Spinner } from '@/components/ui';
import type { TimeCategory } from '@/game/rating';
import { cn } from '@/lib/cn';
import { sampleLeaderboard, type LeaderboardRow } from '@/lib/sampleLeaderboard';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';

const CATS: { id: TimeCategory; label: string; icon: string }[] = [
  { id: 'bullet', label: 'Bullet', icon: '/icons/bullet.svg' },
  { id: 'blitz', label: 'Blitz', icon: '/icons/blitz.svg' },
  { id: 'rapid', label: 'Rapid', icon: '/icons/rapid.svg' },
];

/** Live leaderboard, falling back to the built-in sample players when the table is empty or unreachable. */
export function useLeaderboard(cat: TimeCategory, limit = 100) {
  return useQuery({
    queryKey: ['leaderboard', cat, limit],
    queryFn: async (): Promise<LeaderboardRow[]> => {
      if (!supabaseEnabled) return sampleLeaderboard(cat).slice(0, limit);
      try {
        const { data, error } = await supabase!.from('leaderboard').select('*').eq('category', cat).order('rank').limit(limit);
        if (error || !data?.length) return sampleLeaderboard(cat).slice(0, limit);
        return data as LeaderboardRow[];
      } catch {
        return sampleLeaderboard(cat).slice(0, limit);
      }
    },
  });
}

export function RankBadge({ rank }: { rank: number }) {
  const medal = ['#f2c22c', '#c3c2c0', '#d08a4f'][rank - 1];
  return medal ? (
    <span className="grid h-7 w-7 place-items-center rounded-full font-display text-sm font-extrabold text-[#2b2006]" style={{ background: medal }}>
      {rank}
    </span>
  ) : (
    <span className="grid h-7 w-7 place-items-center font-display text-sm font-bold text-ink-faint">{rank}</span>
  );
}

export default function Leaderboard() {
  const [cat, setCat] = useState<TimeCategory>('blitz');
  const me = useAuth((s) => s.session?.user.id);
  const q = useLeaderboard(cat);

  return (
    <PageShell>
      <PageTitle title="Leaderboard" icon="/icons/leaderboard.svg">
        Top rated players. Everyone starts at 1200 — win a few ranked games to climb.
      </PageTitle>

      <div className="mb-4 flex gap-2" role="tablist">
        {CATS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-bold transition',
              cat === c.id ? 'bg-surface-2 text-ink' : 'text-ink-soft hover:bg-surface-2/60',
            )}
          >
            <img src={c.icon} alt="" width={18} height={18} />
            {c.label}
          </button>
        ))}
      </div>

      <div className="card-surface overflow-hidden">
        {q.isLoading ? (
          <div className="grid place-items-center p-16">
            <Spinner className="h-7 w-7 text-brand" />
          </div>
        ) : (
          <table className="w-full text-left" data-testid="leaderboard">
            <thead className="text-xs uppercase tracking-wider text-ink-faint">
              <tr className="border-b border-line">
                <th className="w-14 px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Won / Drawn / Lost</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.user_id} className={cn('border-b border-line/50 last:border-0 hover:bg-surface-2/40', r.user_id === me && 'bg-brand/10')}>
                  <td className="px-4 py-2.5">
                    <RankBadge rank={r.rank} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/u/${r.username}`} className="flex items-center gap-3 font-bold hover:text-brand">
                      <Avatar seed={r.username} url={r.avatar_url} name={r.username} size={32} className="rounded-md" />
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-bold">
                    {r.rating}
                    {r.rd > 110 && <span className="text-ink-faint">?</span>}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-sm text-ink-soft sm:table-cell">
                    {r.wins} / {r.draws} / {r.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
