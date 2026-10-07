import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageShell, PageTitle } from '@/components/PageShell';
import type { Card } from '@/game/types';
import { GameCard } from '@/game/ui/GameCard';

const c = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });

function Section({ n, title, children, art }: { n: number; title: string; children: ReactNode; art?: ReactNode }) {
  return (
    <section className="card-surface grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]" id={title.toLowerCase().replace(/\W+/g, '-')}>
      <div>
        <span className="font-display text-sm font-bold text-brand">{String(n).padStart(2, '0')}</span>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        <div className="prose-cozy mt-3 space-y-3 text-ink-soft [&_strong]:text-ink">{children}</div>
      </div>
      {art && <div className="flex items-center justify-center">{art}</div>}
    </section>
  );
}

function Fan({ cards }: { cards: Card[] }) {
  return (
    <div className="flex">
      {cards.map((card, i) => (
        <div key={card.id} style={{ marginLeft: i ? -34 : 0, transform: `rotate(${(i - (cards.length - 1) / 2) * 8}deg)` }}>
          <GameCard card={card} width={76} />
        </div>
      ))}
    </div>
  );
}

function LineDemo() {
  // E card: e-file + rank 5.
  return (
    <div className="grid w-48 grid-cols-8 overflow-hidden rounded-xl shadow-md" aria-label="The E card unlocks the e-file and rank 5">
      {Array.from({ length: 64 }).map((_, i) => {
        const rank = 7 - Math.floor(i / 8);
        const file = i % 8;
        const lit = file === 4 || rank === 4;
        return (
          <div
            key={i}
            className="aspect-square"
            style={{
              background: (rank + file) % 2 === 0 ? '#b58863' : '#f0d9b5',
              boxShadow: lit ? 'inset 0 0 0 100vmax rgba(47,111,214,0.45)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Rules() {
  return (
    <PageShell>
      <PageTitle title="How to play UNO Chess" icon="learn">
        Standard chess meets a slimmed-down UNO deck. Based on the variant by TripleSGames. Here’s everything you need — it takes two minutes.
      </PageTitle>

      <div className="space-y-5">
        <Section n={1} title="Setup" art={<Fan cards={[c('a', 'number', 'red', 1), c('b', 'number', 'yellow', 4), c('cc', 'reverse', 'green'), c('d', 'draw2', 'blue'), c('e', 'wild', null)]} />}>
          <p>
            Pieces start as in normal chess. The deck has <strong>76 cards</strong>: two of each letter <strong>A–H</strong> (that’s 1–8) in
            four colours, one <strong>Reverse</strong> and one <strong>Draw Two</strong> per colour, and four <strong>Wilds</strong>.
          </p>
          <p>
            Each player is dealt <strong>7 cards</strong>. The top card of the deck is flipped to start the discard pile (its action is
            ignored). White goes first.
          </p>
        </Section>

        <Section n={2} title="Your turn: play a card" art={<Fan cards={[c('f', 'number', 'blue', 5), c('g', 'number', 'blue', 2), c('h', 'number', 'green', 5)]} />}>
          <p>
            You <strong>must</strong> play one card that matches the top of the pile by <strong>colour</strong>, <strong>letter</strong> or{' '}
            <strong>symbol</strong> (Reverse on Reverse, Draw Two on Draw Two). Wilds match anything.
          </p>
          <p>
            Can’t play anything — or none of your matching cards could actually move a piece? Then <strong>discard any one card</strong>{' '}
            (its action doesn’t happen) and your turn ends.
          </p>
        </Section>

        <Section n={3} title="Then move a piece" art={<LineDemo />}>
          <p>
            A letter card unlocks a <strong>file and a rank</strong>: A = a-file and rank 1, B = b-file and rank 2 … H = h-file and rank 8.
            Move any of your pieces that <strong>starts</strong> on one of those lines, with its normal chess move.
          </p>
          <p>
            Example: White opens with a B — any rank-2 pawn or the b1 knight may move. A <strong>Wild</strong> lets you move any piece, and
            you choose the colour your opponent must match.
          </p>
          <p>
            After a move (or a discard), <strong>draw one card</strong>. If the deck runs out, the discard pile (except the top card) is
            shuffled into a new deck.
          </p>
        </Section>

        <Section n={4} title="Action cards" art={<Fan cards={[c('i', 'reverse', 'yellow'), c('j', 'draw2', 'red')]} />}>
          <p>
            <strong>Reverse</strong> — instead of moving, undo your opponent’s last chess move. Captured pieces come back.
          </p>
          <p>
            <strong>Draw Two</strong> — instead of moving, pick two cards from your hand to discard and draw two replacements. Discarded action
            cards do nothing. (The Draw Two stays on top of the pile.)
          </p>
        </Section>

        <Section n={5} title="Chess, but spicier">
          <p>
            There is <strong>no check</strong> and no checkmate: kings may move into or through danger and pieces are never pinned. Castling
            needs a card that references your <strong>king</strong>; you may castle out of, through or into check, but the king and rook must
            not have moved and the squares between them must be empty. <strong>En passant</strong> works if your card references the capturing
            pawn. Pawns promote as usual.
          </p>
        </Section>

        <Section n={6} title="Winning" art={<GameCard card={c('k', 'reverse', 'blue')} width={84} />}>
          <p>
            <strong>Capture the king</strong> to win — unless your opponent holds a <strong>Reverse that matches the pile</strong>. They may
            play it to undo the capture and the game goes on!
          </p>
          <p>
            <strong>UNO!</strong> If you’re reduced to a lone king, you must call UNO before your turn ends. Forget, and if your opponent
            catches you, you lose instantly.
          </p>
          <p>
            <strong>Draws:</strong> six cards in a row played without any piece moving, a draw by agreement, or both players running out of
            patience. Online games also end on time and by resignation.
          </p>
        </Section>

        <section className="card-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">Online etiquette & ratings</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>Your clock only starts after both players have taken their first turn. Don’t move within 30 seconds and the game is aborted.</li>
            <li>Disconnected for over 60 seconds while your opponent waits? That’s a loss by abandonment.</li>
            <li>Ranked games use Glicko-2 with separate bullet, blitz and rapid ratings. New ratings show a “?” until they settle.</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 text-center">
        <Link to="/play" className="btn-primary !px-8 !py-4 !text-lg">
          I’m ready — let’s play <ArrowRight size={18} />
        </Link>
      </div>
    </PageShell>
  );
}
