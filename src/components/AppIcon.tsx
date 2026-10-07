import {
  BookOpen,
  Bot,
  Crown,
  Flame,
  Globe,
  Hourglass,
  Layers,
  type LucideIcon,
  Moon,
  Settings,
  Sun,
  Trophy,
  Users,
  UsersRound,
  Zap,
  Coffee,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * App icons. Custom artwork is loaded from /icons/<name>.png (see docs/ASSET_PROMPTS.md);
 * until a file exists, a plain line icon is shown instead.
 */
const FALLBACK = {
  play: Layers,
  bots: Bot,
  friends: Users,
  leaderboard: Trophy,
  learn: BookOpen,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  online: Globe,
  ranked: Crown,
  local: UsersRound,
  bullet: Zap,
  blitz: Flame,
  rapid: Hourglass,
  untimed: Coffee,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof FALLBACK;

const missing = new Set<string>();

export function AppIcon({ name, size = 24, className }: { name: AppIconName; size?: number; className?: string }) {
  const [failed, setFailed] = useState(missing.has(name));
  if (failed) {
    const Fallback = FALLBACK[name];
    return <Fallback size={Math.round(size * 0.85)} strokeWidth={2.2} className={cn('shrink-0', className)} aria-hidden />;
  }
  return (
    <img
      src={`/icons/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
      onError={() => {
        missing.add(name);
        setFailed(true);
      }}
    />
  );
}
