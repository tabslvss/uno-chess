import type { ReactNode } from 'react';
import { Footer, Navbar } from './Navbar';

export function PageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className={wide ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12'}>{children}</main>
      <Footer />
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="label mb-2 text-terracotta">{eyebrow}</p>}
      <h1 className="font-display text-4xl font-bold sm:text-5xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-lg text-ink-soft">{children}</div>}
    </div>
  );
}
