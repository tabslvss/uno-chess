import { Link } from 'react-router';
import { PageShell } from '@/components/PageShell';
import { GameCard } from '@/game/ui/GameCard';

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-col items-center py-16 text-center">
        <div className="flex gap-2">
          <GameCard card={{ id: '4a', kind: 'number', color: 'red', value: 4 }} width={70} className="-rotate-6" />
          <GameCard card={null} faceDown width={70} />
          <GameCard card={{ id: '4b', kind: 'number', color: 'blue', value: 4 }} width={70} className="rotate-6" />
        </div>
        <h1 className="mt-8 font-display text-5xl font-bold">Page not found</h1>
        <p className="mt-2 text-ink-soft">That square is empty. Let’s get you back to the table.</p>
        <Link to="/" className="btn-primary mt-6">
          Back home
        </Link>
      </div>
    </PageShell>
  );
}
