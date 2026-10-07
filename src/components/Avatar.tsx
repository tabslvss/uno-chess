import { useState } from 'react';
import { avatarFor } from '@/lib/avatar';
import { cn } from '@/lib/cn';

export function Avatar({
  seed,
  url,
  name,
  size = 40,
  className,
  ring,
}: {
  seed: string;
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = avatarFor(seed, url);
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2', className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }}
    >
      {failed ? (
        <span className="font-display font-bold text-ink-soft" style={{ fontSize: size * 0.45 }}>
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
