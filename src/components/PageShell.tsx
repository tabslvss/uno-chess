import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { AppIcon, type AppIconName } from './AppIcon';
import { MobileBar, Sidebar } from './Sidebar';

export function PageShell({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className={cn(wide ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-10', className)}>{children}</main>
        <footer className="px-4 py-8 text-center text-xs text-ink-faint sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/rules" className="hover:text-ink">Rules</Link>
            <Link to="/leaderboard" className="hover:text-ink">Leaderboard</Link>
            <Link to="/settings" className="hover:text-ink">Settings</Link>
            <a href="https://github.com/tabslvss/uno-chess" target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
          </div>
          <p className="mt-3">
            Fan-made variant inspired by{' '}
            <a className="underline" href="https://www.youtube.com/@TripleSGames" target="_blank" rel="noreferrer">TripleSGames</a>. Not affiliated with Mattel.
          </p>
        </footer>
      </div>
    </div>
  );
}

export function PageTitle({ title, children, icon }: { title: ReactNode; children?: ReactNode; icon?: AppIconName }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      {icon && <AppIcon name={icon} size={48} />}
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {children && <div className="mt-1 text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}
