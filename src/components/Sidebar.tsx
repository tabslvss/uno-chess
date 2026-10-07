import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { LogOut, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Avatar } from '@/components/Avatar';
import { AvatarPicker, useRandomizeAvatar } from '@/components/AvatarPicker';
import { Tip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { displayName, myAvatar, useAccountsOnline, useAuth } from '@/stores/auth';
import { applyTheme, useSettings } from '@/stores/settings';

const NAV: { to: string; label: string; icon: AppIconName }[] = [
  { to: '/play', label: 'Play', icon: 'play' },
  { to: '/play?tab=bot', label: 'Bots', icon: 'bots' },
  { to: '/play?tab=friend', label: 'Friends', icon: 'friends' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { to: '/rules', label: 'Learn', icon: 'learn' },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[1.45rem] font-extrabold tracking-tight text-ink', className)}>
      <span className="text-brand">UNO</span>Chess
    </span>
  );
}

export function LogoLink({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 px-1" aria-label="UNO Chess home">
      <img src="/brand/logo-192.png" alt="" width={34} height={34} className="h-[34px] w-[34px] object-contain" />
      {!compact && <Wordmark />}
    </Link>
  );
}

function useIsDark() {
  const theme = useSettings((s) => s.theme);
  return theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function NavItem({ to, label, icon, compact, onClick }: { to: string; label: string; icon: AppIconName; compact?: boolean; onClick?: () => void }) {
  const loc = useLocation();
  const [path, query] = to.split('?');
  const active = loc.pathname === path && (query ? loc.search.includes(query) : !loc.search.includes('tab=bot') && !loc.search.includes('tab=friend'));
  const item = (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2.5 py-2 font-display text-[0.95rem] font-bold transition',
        active ? 'bg-surface-2 text-ink' : 'text-ink-soft hover:bg-surface-2/70 hover:text-ink',
        compact && 'justify-center px-0',
      )}
    >
      <AppIcon name={icon} size={26} className="transition group-hover:scale-110" />
      {!compact && label}
    </NavLink>
  );
  return compact ? (
    <Tip content={label} side="right">
      {item}
    </Tip>
  ) : (
    item
  );
}

function AccountArea({ compact }: { compact?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const randomize = useRandomizeAvatar();
  const [picker, setPicker] = useState(false);
  const name = displayName(auth);
  const signedIn = !!auth.session;
  const accountsOnline = useAccountsOnline();
  const item = 'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold outline-none data-[highlighted]:bg-surface-2';

  return (
    <div className="flex flex-col gap-2">
      <Dropdown.Root>
        <Dropdown.Trigger
          className={cn('flex items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-surface-2', compact && 'justify-center')}
          aria-label="Account menu"
          data-testid="account-menu"
        >
          <Avatar seed={name} url={myAvatar(auth)} name={name} size={32} className="rounded-md" />
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{name}</span>
              <span className="block text-xs text-ink-faint">{signedIn ? 'View options' : 'Guest'}</span>
            </span>
          )}
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content side={compact ? 'right' : 'top'} align="start" sideOffset={8} className="card-surface z-50 min-w-52 p-1.5">
            <Dropdown.Item onSelect={() => setPicker(true)} className={item} data-testid="menu-change-avatar">
              Change avatar
            </Dropdown.Item>
            <Dropdown.Item
              onSelect={(e) => {
                e.preventDefault();
                void randomize();
              }}
              className={item}
              data-testid="menu-randomize-avatar"
            >
              Randomize avatar
            </Dropdown.Item>
            {signedIn && (
              <Dropdown.Item onSelect={() => navigate(`/u/${auth.profile?.username ?? ''}`)} className={item}>
                My profile
              </Dropdown.Item>
            )}
            <Dropdown.Item onSelect={() => navigate('/settings')} className={item}>
              Settings
            </Dropdown.Item>
            {signedIn && (
              <>
                <Dropdown.Separator className="my-1 h-px bg-line" />
                <Dropdown.Item onSelect={() => void auth.signOut()} className={item + ' text-uno-red'}>
                  <LogOut size={15} /> Sign out
                </Dropdown.Item>
              </>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      {!signedIn && accountsOnline && !compact && (
        <>
          <Link to="/login?mode=signup" className="btn-primary w-full">
            Sign Up
          </Link>
          <Link to="/login" className="btn-secondary w-full">
            Log In
          </Link>
        </>
      )}
      <AvatarPicker open={picker} onOpenChange={setPicker} />
    </div>
  );
}

function ThemeRow({ compact }: { compact?: boolean }) {
  const dark = useIsDark();
  const set = useSettings((s) => s.set);
  return (
    <button
      type="button"
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      }}
      className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-soft transition hover:bg-surface-2 hover:text-ink', compact && 'justify-center px-0')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AppIcon name={dark ? 'sun' : 'moon'} size={20} />
      {!compact && (dark ? 'Light mode' : 'Dark mode')}
    </button>
  );
}

/** chess.com-style left navigation. `compact` shows icons only (game screen). */
export function Sidebar({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <aside
      className={cn(
        'sticky top-0 h-dvh shrink-0 flex-col gap-1 bg-bg-soft px-2 py-3',
        compact ? 'w-[64px]' : 'w-[184px]',
        className,
      )}
    >
      <div className="mb-3">
        <LogoLink compact={compact} />
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} compact={compact} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <ThemeRow compact={compact} />
        {compact ? (
          <NavItem to="/settings" label="Settings" icon="settings" compact />
        ) : (
          <NavItem to="/settings" label="Settings" icon="settings" />
        )}
        <div className="mt-1 border-t border-line pt-2">
          <AccountArea compact={compact} />
        </div>
      </div>
    </aside>
  );
}

/** Top bar + slide-out menu for small screens. */
export function MobileBar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, loc.search]);
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-bg-soft px-3 lg:hidden">
        <LogoLink />
        <button className="btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-bg-soft lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <button className="btn-ghost absolute right-2 top-3 !p-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
              <Sidebar className="!static flex !h-full !w-full" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
