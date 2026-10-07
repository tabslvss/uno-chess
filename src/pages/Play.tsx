import { Bot, Crown, Globe2, Link2, Lock, Play as PlayIcon, Swords, Timer, Users, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageShell, PageTitle } from '@/components/PageShell';
import { Dialog, Segmented, Switch } from '@/components/ui';
import { BOTS } from '@/game/ai/bots';
import { formatRating, previewDeltas, TIME_CONTROLS, timeControlById, type TimeCategory } from '@/game/rating';
import type { Side } from '@/game/types';
import { cn } from '@/lib/cn';
import { newRoomId, onlineEnabled } from '@/net/config';
import { useLobby } from '@/net/useLobby';
import { displayName, ratingFor, useAuth } from '@/stores/auth';
import { useLocalGame } from '@/stores/localGame';
import { supabaseEnabled } from '@/lib/supabase';

const CAT_ICON: Record<TimeCategory, typeof Zap> = { bullet: Zap, blitz: Timer, rapid: Timer };

function TimeControlPicker({ value, onChange, allowUntimed }: { value: string | null; onChange: (v: string | null) => void; allowUntimed?: boolean }) {
  return (
    <div className="space-y-3">
      {(['bullet', 'blitz', 'rapid'] as TimeCategory[]).map((cat) => {
        const Icon = CAT_ICON[cat];
        return (
          <div key={cat}>
            <div className="label mb-1.5 flex items-center gap-1.5">
              <Icon size={13} /> {cat}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIME_CONTROLS.filter((t) => t.category === cat).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange(t.id)}
                  aria-pressed={value === t.id}
                  className={cn(
                    'rounded-xl border px-2 py-2.5 font-extrabold transition',
                    value === t.id ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {allowUntimed && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            'w-full rounded-xl border px-2 py-2.5 font-extrabold transition',
            value === null ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-line bg-surface hover:bg-surface-2',
          )}
        >
          ☕ Untimed — take it easy
        </button>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: Side | 'random'; onChange: (v: Side | 'random') => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'w', label: '♔ White' },
        { value: 'random', label: '🎲 Random' },
        { value: 'b', label: '♚ Black' },
      ]}
    />
  );
}

function OnlineTab() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<'casual' | 'ranked'>(auth.session ? 'ranked' : 'casual');
  const [tc, setTc] = useState<string>(() => localStorage.getItem('unochess-tc') ?? '5+3');
  const lobby = useLobby((gameId) => navigate(`/game/${gameId}`));
  const control = timeControlById(tc);
  const myRating = ratingFor(auth, control.category);
  const [win, , loss] = previewDeltas(myRating, myRating);
  const [elapsed, setElapsed] = useState(0);
  const searching = lobby.queue.kind === 'queued' || lobby.queue.kind === 'joining';

  useEffect(() => {
    if (lobby.queue.kind !== 'queued') return setElapsed(0);
    const since = lobby.queue.since;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 500);
    return () => clearInterval(id);
  }, [lobby.queue]);

  if (!onlineEnabled()) {
    return (
      <div className="rounded-2xl bg-surface-2 p-6 text-center">
        <Globe2 className="mx-auto text-ink-faint" />
        <p className="mt-2 font-bold">Online play isn’t configured on this deployment yet.</p>
        <p className="text-sm text-ink-soft">Set VITE_PARTYKIT_HOST to your PartyKit server. Bots and pass & play work offline!</p>
      </div>
    );
  }

  const ranked = mode === 'ranked';
  const locked = ranked && !auth.session;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'casual', label: <span className="flex items-center justify-center gap-1.5"><Globe2 size={15} /> Casual</span> },
            { value: 'ranked', label: <span className="flex items-center justify-center gap-1.5"><Crown size={15} /> Ranked</span> },
          ]}
        />
        <TimeControlPicker
          value={tc}
          onChange={(v) => {
            if (!v) return;
            setTc(v);
            localStorage.setItem('unochess-tc', v);
          }}
        />
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-5">
        <div>
          <div className="label">{ranked ? `Your ${control.category} rating` : 'Playing as'}</div>
          <div className="font-display text-3xl font-bold">{ranked && auth.session ? formatRating(myRating) : displayName(auth)}</div>
          {ranked && auth.session && (
            <p className="mt-1 text-sm text-ink-soft">
              Even game: <span className="font-bold text-sage-deep dark:text-sage">+{win}</span> /{' '}
              <span className="font-bold text-uno-red">{loss}</span>
            </p>
          )}
          {!ranked && <p className="mt-1 text-sm text-ink-soft">Casual games don’t affect ratings. Guests welcome.</p>}
        </div>
        {locked ? (
          <Link to="/login?next=/play" className="btn-primary mt-auto !py-3.5">
            <Lock size={16} /> {supabaseEnabled ? 'Log in for ranked' : 'Ranked needs accounts'}
          </Link>
        ) : (
          <button className="btn-primary mt-auto !py-3.5 !text-base" onClick={() => lobby.join(mode, tc)} disabled={searching} data-testid="find-game">
            <PlayIcon size={18} /> Play {control.label}
          </button>
        )}
        {lobby.stats && (
          <p className="text-center text-xs font-bold text-ink-faint">
            {lobby.stats.online} online · {lobby.stats.queued} searching
          </p>
        )}
      </div>

      <Dialog open={searching} onOpenChange={(o) => !o && lobby.cancel()} title="Finding an opponent…" dismissable hideClose>
        <div className="flex flex-col items-center text-center">
          <div className="relative my-4 h-28 w-28">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-4 border-terracotta"
                initial={{ scale: 0.4, opacity: 0.8 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.66 }}
              />
            ))}
            <img src="/logo.svg" alt="" className="absolute inset-6 animate-wiggle" />
          </div>
          <p className="font-extrabold">
            {ranked ? 'Ranked' : 'Casual'} · {control.label}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {ranked && elapsed > 15 ? 'Widening the rating range…' : 'Shuffling the deck…'}
          </p>
          <button className="btn-secondary mt-5 w-full" onClick={lobby.cancel} data-testid="cancel-search">
            Cancel
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function FriendTab() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [tc, setTc] = useState<string | null>('10+0');
  const [color, setColor] = useState<Side | 'random'>('random');
  const [rated, setRated] = useState(false);
  const [code, setCode] = useState('');

  if (!onlineEnabled()) {
    return <p className="rounded-2xl bg-surface-2 p-6 text-center font-bold">Online play isn’t configured on this deployment yet.</p>;
  }

  const create = () => {
    const id = newRoomId();
    navigate(`/game/${id}?create=1&tc=${encodeURIComponent(tc ?? '10+0')}&color=${color}&rated=${rated && auth.session ? 1 : 0}`);
  };
  const join = () => {
    const m = code.trim().match(/(?:game\/)?([a-z0-9]{4,32})\/?$/i);
    if (!m) return toast.error('Paste an invite link or game code.');
    navigate(`/game/${m[1]!.toLowerCase()}`);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <TimeControlPicker value={tc} onChange={setTc} />
        <div>
          <div className="label mb-1.5">I play as</div>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {auth.session && <Switch checked={rated} onCheckedChange={setRated} label="Rated game" hint="Both players must be logged in." />}
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-5">
        <div>
          <h3 className="font-display text-xl font-bold">Invite a friend</h3>
          <p className="text-sm text-ink-soft">You’ll get a link to share. The game starts when they open it.</p>
        </div>
        <button className="btn-primary !py-3.5" onClick={create} data-testid="create-invite">
          <Link2 size={18} /> Create invite link
        </button>
        <div className="mt-2 border-t border-line pt-4">
          <div className="label mb-1.5">Have a link?</div>
          <div className="flex gap-2">
            <input className="input" placeholder="Paste link or code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} />
            <button className="btn-secondary" onClick={join}>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotTab() {
  const navigate = useNavigate();
  const start = useLocalGame((s) => s.start);
  const [botId, setBotId] = useState(() => localStorage.getItem('unochess-bot') ?? 'biscuit');
  const [color, setColor] = useState<Side | 'random'>('random');
  const [tc, setTc] = useState<string | null>(null);
  const [showTc, setShowTc] = useState(false);
  const go = () => {
    localStorage.setItem('unochess-bot', botId);
    const humanSide: Side = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    start({ mode: 'bot', botId, humanSide, tc });
    navigate('/bot');
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BOTS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBotId(b.id)}
            aria-pressed={botId === b.id}
            data-testid={`bot-${b.id}`}
            className={cn(
              'flex flex-col items-center rounded-2xl border-2 p-4 text-center transition',
              botId === b.id ? 'border-terracotta bg-terracotta/5 shadow-[var(--shadow-soft)]' : 'border-transparent bg-surface-2 hover:bg-surface',
            )}
          >
            <motion.img src={b.avatar} alt="" className="h-20 w-20 rounded-2xl" animate={botId === b.id ? { rotate: [0, -6, 6, 0] } : {}} />
            <span className="mt-2 font-display text-lg font-bold">{b.name}</span>
            <span className="chip mt-1 text-white" style={{ background: b.accent }}>
              ~{b.rating}
            </span>
            <span className="mt-2 text-xs text-ink-soft">{b.tagline}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="label">I play as</div>
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn-ghost !px-0 text-sm" onClick={() => setShowTc((s) => !s)}>
            <Timer size={15} /> {tc ? `Clock: ${timeControlById(tc).label}` : 'Untimed'} · change
          </button>
          {showTc && <TimeControlPicker value={tc} onChange={setTc} allowUntimed />}
        </div>
        <button className="btn-primary self-end !py-4 !text-base" onClick={go} data-testid="start-bot">
          <Bot size={18} /> Play {BOTS.find((b) => b.id === botId)?.name}
        </button>
      </div>
    </div>
  );
}

function LocalTab() {
  const navigate = useNavigate();
  const start = useLocalGame((s) => s.start);
  const [w, setW] = useState('Player 1');
  const [b, setB] = useState('Player 2');
  const [tc, setTc] = useState<string | null>(null);
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="label">♔ White</span>
            <input className="input" value={w} maxLength={20} onChange={(e) => setW(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="label">♚ Black</span>
            <input className="input" value={b} maxLength={20} onChange={(e) => setB(e.target.value)} />
          </label>
        </div>
        <TimeControlPicker value={tc} onChange={setTc} allowUntimed />
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-5">
        <h3 className="font-display text-xl font-bold">Pass & play</h3>
        <p className="text-sm text-ink-soft">One device. Your cards are hidden while you hand it over — no peeking!</p>
        <button
          className="btn-primary mt-auto !py-3.5"
          data-testid="start-local"
          onClick={() => {
            start({ mode: 'local', tc, names: { w: w.trim() || 'White', b: b.trim() || 'Black' } });
            navigate('/local');
          }}
        >
          <Swords size={18} /> Start game
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { value: 'online', label: 'Online', icon: Globe2 },
  { value: 'friend', label: 'Friend', icon: Users },
  { value: 'bot', label: 'Bots', icon: Bot },
  { value: 'local', label: 'Pass & play', icon: Swords },
] as const;

export default function Play() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'online';
  const local = useLocalGame();
  const resumable = local.state && !local.state.result && local.setup;

  return (
    <PageShell>
      <PageTitle eyebrow="Pull up a chair" title="Let’s play">
        Choose how you’d like to play. Everything works as a guest — log in to play ranked.
      </PageTitle>

      {resumable && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="card-surface mb-6 flex items-center gap-4 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mustard/30">♟</span>
          <div className="flex-1">
            <div className="font-extrabold">You have a game in progress</div>
            <div className="text-sm text-ink-soft">{local.setup!.mode === 'bot' ? `vs ${BOTS.find((b) => b.id === local.setup!.botId)?.name ?? 'bot'}` : 'Pass & play'}</div>
          </div>
          <Link to={local.setup!.mode === 'bot' ? '/bot' : '/local'} className="btn-primary">
            Resume
          </Link>
        </motion.div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-surface-2/60 p-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setParams({ tab: t.value }, { replace: true })}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-extrabold transition',
                tab === t.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
              )}
            >
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-7">
          {tab === 'online' && <OnlineTab />}
          {tab === 'friend' && <FriendTab />}
          {tab === 'bot' && <BotTab />}
          {tab === 'local' && <LocalTab />}
        </div>
      </div>
    </PageShell>
  );
}
