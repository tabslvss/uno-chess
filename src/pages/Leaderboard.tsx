import { useQuery } from '@tanstack/react-query';
import { Crown, Medal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { PageShell, PageTitle } from '@/components/PageShell';
import { Segmented, Spinner } from '@/components/ui';
import type { TimeCategory } from '@/game/rating';
import { cn } from '@/lib/cn';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';

interface Row {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number;
  rd: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function Leaderboard() {
  const [cat, setCat] = useState<TimeCategory>('blitz');
  const me = useAuth((s) => s.session?.user.id);
  const q = useQuery({
    queryKey: ['leaderboard', cat],
    enabled: supabaseEnabled,
    queryFn: async () => {
      const { data, error } = await supabase!.from('leaderboard').select('*').eq('category', cat).order('rank').limit(100);
      if (error) throw error;
      return data as Row[];
    },
  });

  return (
    <PageShell>
      <PageTitle eyebrow="Hall of fame" title="Leaderboard">
        The top ranked players in each time control.
      </PageTitle>
      <Segmented
        value={cat}
        onChange={setCat}
        className="mb-6 max-w-md"
        options={[
          { value: 'bullet', label: '⚡ Bullet' },
          { value: 'blitz', label: '🔥 Blitz' },
          { value: 'rapid', label: '☕ Rapid' },
        ]}
      />
      <div className="card-surface overflow-hidden">
        {!supabaseEnabled ? (
          <Empty title="Leaderboards are coming soon" body="Accounts aren’t enabled on this server yet. Ranked play and leaderboards appear once they are." />
        ) : q.isLoading ? (
          <div className="grid place-items-center p-16">
            <Spinner className="h-7 w-7 text-terracotta" />
          </div>
        ) : q.error ? (
          <Empty title="Couldn’t load the leaderboard" body={(q.error as Error).message} />
        ) : !q.data?.length ? (
          <Empty title="No ranked games yet" body="Be the first name on the board!" cta />
        ) : (
          <table className="w-full text-left">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">W / D / L</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Games</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.user_id} className={cn('border-t border-line', r.user_id === me && 'bg-mustard/10')}>
                  <td className="px-4 py-3 font-display text-lg font-bold">
                    {r.rank === 1 ? <Crown className="text-mustard-deep" size={20} /> : r.rank <= 3 ? <Medal className="text-ink-faint" size={20} /> : r.rank}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/u/${r.username}`} className="flex items-center gap-3 font-extrabold hover:text-terracotta">
                      <Avatar seed={r.user_id} url={r.avatar_url} name={r.username} size={34} />
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-lg font-bold">
                    {r.rating}
                    {r.rd > 110 && <span className="text-ink-faint">?</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm font-bold text-ink-soft sm:table-cell">
                    {r.wins} / {r.draws} / {r.losses}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm font-bold text-ink-soft sm:table-cell">{r.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}

function Empty({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="flex flex-col items-center p-12 text-center">
      <Crown size={36} className="text-mustard" />
      <h2 className="mt-3 font-display text-2xl font-bold">{title}</h2>
      <p className="mt-1 max-w-md text-ink-soft">{body}</p>
      {cta && (
        <Link to="/play?tab=online" className="btn-primary mt-5">
          Play ranked
        </Link>
      )}
    </div>
  );
}
