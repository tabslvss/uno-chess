import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-extrabold tracking-tight', className)}>
      <span className="text-terracotta">U</span>
      <span className="text-mustard-deep dark:text-mustard">N</span>
      <span className="text-sage">O</span>
      <span className="ml-[0.18em] text-ink">Chess</span>
    </span>
  );
}

export function Logo({ className, small = false }: { className?: string; small?: boolean }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2', className)} aria-label="UNO Chess home">
      <img
        src="/logo.svg"
        alt=""
        className={cn('transition group-hover:-rotate-6', small ? 'h-8 w-8' : 'h-10 w-10')}
        width={40}
        height={40}
      />
      <Wordmark className={small ? 'text-xl' : 'text-2xl'} />
    </Link>
  );
}
