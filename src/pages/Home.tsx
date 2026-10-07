import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bot, Crown, Globe2, Sparkles, Swords, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { defaultPieces } from 'react-chessboard';
import { PageShell } from '@/components/PageShell';
import { BOTS } from '@/game/ai/bots';
import { boardFromFen, sqName } from '@/game/board';
import type { Card } from '@/game/types';
import { GameCard } from '@/game/ui/GameCard';
import { partyHttpUrl } from '@/net/config';

const card = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });

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

const HERO_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R';

function MiniBoard() {
  const board = boardFromFen(HERO_FEN);
  const lit = new Set<number>();
  // "C" card → c-file and rank 3 glow.
  for (let i = 0; i < 8; i++) {
    lit.add(i * 8 + 2);
    lit.add(2 * 8 + i);
  }
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl shadow-[0_2px_0_rgba(60,40,20,.25),0_30px_60px_-20px_rgba(60,40,20,.55)]">
      {Array.from({ length: 64 }).map((_, i) => {
        const rank = 7 - Math.floor(i / 8);
        const file = i % 8;
        const sq = rank * 8 + file;
        const dark = (rank + file) % 2 === 0;
        const p = board[sq];
        const Piece = p ? defaultPieces[p] : null;
        return (
          <div
            key={sqName(sq)}
            className="relative"
            style={{
              background: dark ? '#b58863' : '#f0d9b5',
              boxShadow: lit.has(sq) ? 'inset 0 0 0 100vmax rgba(47,111,214,0.28)' : undefined,
            }}
          >
            {Piece && (
              <div className="absolute inset-[6%]">
                <Piece />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HeroArt() {
  const fan = [
    card('h1', 'number', 'blue', 3),
    card('h2', 'wild', null),
    card('h3', 'reverse', 'red'),
    card('h4', 'draw2', 'green'),
  ];
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <motion.div initial={{ rotate: -4, y: 20, opacity: 0 }} animate={{ rotate: -4, y: 0, opacity: 1 }} transition={{ duration: 0.7 }}>
        <MiniBoard />
      </motion.div>
      <div className="absolute -bottom-10 -left-6 flex sm:-left-12">
        {fan.map((c, i) => (
          <motion.div
            key={c.id}
            className="animate-float"
            style={{ ['--r' as string]: `${(i - 1.5) * 9}deg`, animationDelay: `${i * 0.4}s`, marginLeft: i ? -26 : 0 }}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
          >
            <GameCard card={c} width={82} />
          </motion.div>
        ))}
      </div>
      <motion.div
        className="card-surface absolute -right-2 -top-6 flex items-center gap-2 px-3 py-2 sm:-right-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9 }}
      >
        <span className="font-display text-xl font-bold text-terracotta">UNO!</span>
        <span className="text-xs font-bold text-ink-soft">
          lone king?
          <br />
          call it!
        </span>
      </motion.div>
    </div>
  );
}

const steps = [
  {
    title: 'Play a card',
    body: 'Match the pile by colour, letter or symbol — just like UNO. You must play every turn.',
    cards: [card('s1', 'number', 'yellow', 5), card('s2', 'number', 'yellow', 2)],
  },
  {
    title: 'Move on its lines',
    body: 'A card unlocks its file and rank: E lets anything on the e-file or rank 5 move.',
    cards: [card('s3', 'number', 'blue', 5)],
  },
  {
    title: 'Draw & capture the king',
    body: 'Draw a replacement and pass the turn. There’s no check — take the king to win.',
    cards: [card('s4', 'number', 'green', 8)],
  },
];

const specials = [
  { c: card('x1', 'wild', null), title: 'Wild', body: 'Move any piece and pick the colour to match.' },
  { c: card('x2', 'reverse', 'blue'), title: 'Reverse', body: 'Undo your opponent’s last move — captures come back too.' },
  { c: card('x3', 'draw2', 'red'), title: 'Draw Two', body: 'Skip moving: swap two cards from your hand for fresh ones.' },
];

const modes = [
  { icon: Crown, title: 'Ranked', body: 'Glicko-2 ratings per time control, chess.com style.', tint: 'bg-mustard/25 text-mustard-deep', to: '/play?tab=online' },
  { icon: Globe2, title: 'Casual', body: 'Quick games against real people — guests welcome.', tint: 'bg-dusk/20 text-dusk', to: '/play?tab=online' },
  { icon: Users, title: 'Friends', body: 'Share a link and play instantly. Spectators can watch.', tint: 'bg-sage/25 text-sage-deep', to: '/play?tab=friend' },
  { icon: Bot, title: 'Bots', body: 'Four card-counting bots from Pebble to The Dealer.', tint: 'bg-terracotta/20 text-terracotta', to: '/play?tab=bot' },
  { icon: Swords, title: 'Pass & play', body: 'One device, two players, hidden hands between turns.', tint: 'bg-ink/10 text-ink', to: '/play?tab=local' },
];

const faqs = [
  ['Do I need an account?', 'No — you can play bots, friends and casual games as a guest. Create an account to play ranked and keep your rating and game history.'],
  ['What happens if I can’t play a card?', 'If nothing in your hand matches the pile (or no piece on its lines can move), you discard any one card and draw a replacement.'],
  ['Is there check or checkmate?', 'No! Kings may walk into danger. You win by actually capturing the king — unless your opponent vetoes it with a matching Reverse.'],
  ['When do I say UNO?', 'When all you have left is your king. Call UNO before your turn ends — if your opponent catches you, you lose on the spot.'],
  ['How are ratings calculated?', 'With Glicko-2, the system used by chess.com and Lichess. New players have a provisional rating (shown with a “?”) that settles after a few games.'],
];

export default function Home() {
  const stats = useOnlineCount();
  return (
    <PageShell wide>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="chip mb-5 bg-surface py-1.5 text-sm text-ink-soft shadow-sm ring-1 ring-line"
          >
            <Sparkles size={14} className="text-mustard-deep" /> A cozy mash-up of UNO × Chess
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl"
          >
            Play a card.
            <br />
            <span className="text-terracotta">Move a piece.</span>
            <br />
            Capture the king.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-6 max-w-xl text-lg text-ink-soft">
            Every card unlocks a file and a rank. Match colours, steal tempo with Reverse, and remember to shout{' '}
            <strong className="text-ink">UNO</strong> when you’re down to a lone king.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-8 flex flex-wrap gap-3">
            <Link to="/play" className="btn-primary !px-6 !py-3.5 !text-base" data-testid="cta-play">
              Play now <ArrowRight size={18} />
            </Link>
            <Link to="/play?tab=bot" className="btn-secondary !px-6 !py-3.5 !text-base">
              <Bot size={18} /> Practice vs a bot
            </Link>
          </motion.div>
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-ink-faint">
            {stats.data ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sage" />
                </span>
                {stats.data.online} online now · free · no sign-up needed
              </>
            ) : (
              'Free · no sign-up needed'
            )}
          </p>
        </div>
        <HeroArt />
      </section>

      {/* How it works */}
      <section className="border-y border-line/60 bg-surface/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="label text-terracotta">How a turn works</p>
          <h2 className="mt-2 font-display text-4xl font-bold">Three steps, endless chaos</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.08 }}
                className="card-surface flex gap-5 p-6"
              >
                <div className="flex shrink-0">
                  {s.cards.map((c, j) => (
                    <div key={c.id} style={{ marginLeft: j ? -30 : 0, transform: `rotate(${j * 8}deg)` }}>
                      <GameCard card={c} width={58} />
                    </div>
                  ))}
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-terracotta">Step {i + 1}</span>
                  <h3 className="font-display text-xl font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {specials.map((s) => (
              <div key={s.title} className="flex items-center gap-4 rounded-2xl p-3">
                <GameCard card={s.c} width={52} />
                <div>
                  <h3 className="font-display text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-ink-soft">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <Link to="/rules" className="btn-ghost mt-6">
            Read the full rules <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Modes */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="label text-terracotta">Ways to play</p>
        <h2 className="mt-2 font-display text-4xl font-bold">Pull up a chair</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {modes.map((m) => (
            <Link key={m.title} to={m.to} className="card-surface group p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${m.tint}`}>
                <m.icon size={22} />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{m.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{m.body}</p>
            </Link>
          ))}
        </div>

        <div className="card-surface mt-10 flex flex-col items-center gap-6 p-6 sm:flex-row">
          <div className="flex -space-x-3">
            {BOTS.map((b) => (
              <img key={b.id} src={b.avatar} alt={b.name} className="h-14 w-14 rounded-2xl ring-4 ring-surface" />
            ))}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-display text-xl font-bold">Meet the bots</h3>
            <p className="text-sm text-ink-soft">
              From sleepy Pebble to The Dealer, who counts every card on the table. They only see what you’d see.
            </p>
          </div>
          <Link to="/play?tab=bot" className="btn-secondary">
            Challenge one
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4">
        <h2 className="text-center font-display text-4xl font-bold">Questions, answered</h2>
        <div className="mt-8 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="card-surface group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold">
                {q}
                <span className="text-terracotta transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link to="/play" className="btn-primary !px-8 !py-4 !text-lg">
            Deal me in <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
