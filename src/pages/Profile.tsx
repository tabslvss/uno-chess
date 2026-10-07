import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar } from '@/components/Avatar';
import { PageShell } from '@/components/PageShell';
import { Segmented, Spinner } from '@/components/ui';
import { CATEGORIES, PROVISIONAL_RD, type TimeCategory } from '@/game/rating';
import { cn } from '@/lib/cn';
import { signed } from '@/lib/format';
import { supabase, supabaseEnabled, type GameRow, type ProfileRow, type RatingRow } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { sampleProfile } from '@/lib/sampleLeaderboard';

const REASONS: Record<string, string> = {
  kingCapture: 'king captured',
  unoCaught: 'UNO caught',
  resign: 'resignation',
  timeout: 'time',
  sixNoMove: 'six-card rule',
  agreement: 'agreement',
  abandon: 'abandonment',
};

export default function Profile() {
  const { username = '' } = useParams();
  const myId = useAuth((s) => s.session?.user.id);
  const [cat, setCat] = useState<TimeCategory>('blitz');

  const profile = useQuery({
    queryKey: ['profile', username],
    enabled: supabaseEnabled && !!username,
    queryFn: async () => {
      const { data: p } = await supabase!.from('profiles').select('*').eq('username', username).maybeSingle();
      if (!p) return null;
      const prof = p as ProfileRow;
      const [ratings, games] = await Promise.all([
        supabase!.from('ratings').select('*').eq('user_id', prof.id),
        supabase!
          .from('games')
          .select('*')
          .or(`white_id.eq.${prof.id},black_id.eq.${prof.id}`)
          .order('ended_at', { ascending: false })
          .limit(20),
      ]);
      return { profile: prof, ratings: (ratings.data ?? []) as RatingRow[], games: (games.data ?? []) as GameRow[] };
    },
  });

  const history = useQuery({
    queryKey: ['rating-history', profile.data?.profile.id, cat],
    enabled: !!profile.data,
    queryFn: async () => {
      const { data } = await supabase!
        .from('rating_history')
        .select('rating, created_at')
        .eq('user_id', profile.data!.profile.id)
        .eq('category', cat)
        .order('created_at')
        .limit(300);
      return (data ?? []) as { rating: number; created_at: string }[];
    },
  });

  const chart = useMemo(
    () => (history.data ?? []).map((h, i) => ({ i: i + 1, rating: Math.round(h.rating), date: new Date(h.created_at).toLocaleDateString() })),
    [history.data],
  );

  const sample = sampleProfile(username);
  if ((!supabaseEnabled || (!profile.isLoading && !profile.data)) && sample) return <SampleProfile p={sample} />;

  if (!supabaseEnabled) {
    return (
      <PageShell>
        <p className="card-surface p-10 text-center text-ink-soft">Profiles appear once accounts are enabled on this server.</p>
      </PageShell>
    );
  }
  if (profile.isLoading) {
    return (
      <PageShell>
        <div className="grid place-items-center p-20">
          <Spinner className="h-8 w-8 text-brand" />
        </div>
      </PageShell>
    );
  }
  if (!profile.data) {
    return (
      <PageShell>
        <div className="card-surface p-10 text-center">
          <h1 className="font-display text-3xl font-bold">No player called “{username}”</h1>
          <Link to="/leaderboard" className="btn-primary mt-6">
            Browse the leaderboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const { profile: p, ratings, games } = profile.data;
  const isMe = p.id === myId;
  const byCat = Object.fromEntries(ratings.map((r) => [r.category, r])) as Partial<Record<TimeCategory, RatingRow>>;

  return (
    <PageShell>
      <div className="card-surface flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <Avatar seed={p.id} url={p.avatar_url} name={p.username} size={96} className="rounded-3xl" />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-display text-4xl font-bold">{p.username}</h1>
          {p.bio && <p className="mt-1 text-ink-soft">{p.bio}</p>}
          <p className="mt-2 text-sm font-bold text-ink-faint">Joined {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
        </div>
        {isMe && (
          <Link to="/settings" className="btn-secondary">
            <Pencil size={16} /> Edit profile
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const r = byCat[c];
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn('card-surface p-5 text-left transition', cat === c && 'ring-2 ring-brand')}
            >
              <div className="label capitalize">{c}</div>
              <div className="mt-1 font-display text-4xl font-bold">
                {r ? Math.round(r.rating) : '—'}
                {r && r.rd > PROVISIONAL_RD && <span className="text-ink-faint">?</span>}
              </div>
              <div className="mt-1 text-sm font-bold text-ink-soft">
                {r ? `${r.games} games · ${r.wins}W ${r.draws}D ${r.losses}L · peak ${Math.round(r.peak)}` : 'No rated games yet'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card-surface mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Rating history</h2>
          <Segmented value={cat} onChange={setCat} className="w-72" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </div>
        {chart.length < 2 ? (
          <p className="p-10 text-center text-ink-soft">Play a couple of rated {cat} games to see a chart.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="4 4" />
                <XAxis dataKey="i" tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} />
                <YAxis domain={['dataMin - 30', 'dataMax + 30']} tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontWeight: 700 }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Line type="monotone" dataKey="rating" stroke="#d9734e" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card-surface mt-6 overflow-hidden">
        <h2 className="p-5 pb-3 font-display text-2xl font-bold">Recent games</h2>
        {games.length === 0 ? (
          <p className="p-5 pt-0 text-ink-soft">No games yet.</p>
        ) : (
          <ul>
            {games.map((g) => {
              const side = g.white_id === p.id ? 'w' : 'b';
              const opp = side === 'w' ? g.black_name : g.white_name;
              const outcome = g.winner === null ? 'draw' : g.winner === side ? 'win' : 'loss';
              const before = side === 'w' ? g.white_rating_before : g.black_rating_before;
              const after = side === 'w' ? g.white_rating_after : g.black_rating_after;
              return (
                <li key={g.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                  <span
                    className={cn(
                      'chip w-14 justify-center uppercase',
                      outcome === 'win' ? 'bg-sage/20 text-sage-deep dark:text-sage' : outcome === 'loss' ? 'bg-uno-red/15 text-uno-red' : 'bg-surface-2 text-ink-soft',
                    )}
                  >
                    {outcome}
                  </span>
                  <span className={cn('h-3 w-3 rounded-full ring-1 ring-ink/30', side === 'w' ? 'bg-[#f7f1e6]' : 'bg-[#2b2420]')} />
                  <span className="min-w-0 flex-1 truncate font-bold">vs {opp}</span>
                  <span className="hidden text-sm text-ink-soft sm:inline">
                    {g.time_control} · {g.rated ? 'rated' : 'casual'} · {REASONS[g.reason] ?? g.reason}
                  </span>
                  {g.rated && before != null && after != null && (
                    <span className={cn('font-mono text-sm font-bold', after - before >= 0 ? 'text-sage-deep dark:text-sage' : 'text-uno-red')}>
                      {signed(after - before)}
                    </span>
                  )}
                  <span className="w-24 text-right text-xs text-ink-faint">{formatDistanceToNow(new Date(g.ended_at), { addSuffix: true })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

function SampleProfile({ p }: { p: NonNullable<ReturnType<typeof sampleProfile>> }) {
  return (
    <PageShell>
      <div className="card-surface flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <Avatar seed={p.username} url={p.avatar_url} name={p.username} size={96} className="rounded-2xl" />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-4xl">{p.username}</h1>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const r = p.ratings[c];
          return (
            <div key={c} className="card-surface p-5">
              <div className="label capitalize">{c}</div>
              <div className="mt-1 font-display text-4xl font-bold">{r.rating}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {r.games} games · {r.wins}W {r.draws}D {r.losses}L · peak {r.peak}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-surface mt-6 p-6 text-center text-ink-soft">
        Think you can beat {p.username}?{' '}
        <Link to="/play?tab=online" className="font-bold text-brand hover:underline">
          Play ranked
        </Link>
      </div>
    </PageShell>
  );
}
