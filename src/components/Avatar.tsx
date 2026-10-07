import { useState } from 'react';
import { avatarSrc, isLocalAvatar } from '@/lib/avatar';
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
  const candidates = isLocalAvatar(url) ? [url!] : [avatarSrc(seed, url)];
  const key = candidates.join('|');
  const [failed, setFailed] = useState<{ key: string; n: number }>({ key, n: 0 });
  const n = failed.key === key ? failed.n : 0;
  const src = candidates[n];
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2', className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }}
    >
      {!src ? (
        <span className="font-display font-bold text-ink-soft" style={{ fontSize: size * 0.45 }}>
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" onError={() => setFailed({ key, n: n + 1 })}
          loading="lazy"
          decoding="async" />
      )}
    </span>
  );
}
