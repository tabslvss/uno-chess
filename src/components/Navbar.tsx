import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Dices, LogIn, LogOut, Menu, Moon, Smile, Settings, Sun, Trophy, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { AvatarPicker, useRandomizeAvatar } from '@/components/AvatarPicker';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';
import { supabaseEnabled } from '@/lib/supabase';
import { displayName, myAvatar, useAuth } from '@/stores/auth';
import { applyTheme, useSettings } from '@/stores/settings';

const links = [
  { to: '/play', label: 'Play' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/rules', label: 'How to play' },
];

export function ThemeToggle() {
  const { theme, set } = useSettings();
  const dark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <button
      className="btn-ghost !p-2"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'moon' : 'sun'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
          {dark ? <Moon size={19} /> : <Sun size={19} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

const itemCls =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-surface-2';

function UserMenu() {
  const auth = useAuth();
  const navigate = useNavigate();
  const randomize = useRandomizeAvatar();
  const [picker, setPicker] = useState(false);
  const name = displayName(auth);
  const signedIn = !!auth.session;
  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-surface-2" aria-label="Account menu" data-testid="account-menu">
          <Avatar seed={name} url={myAvatar(auth)} name={name} size={32} />
          <span className="hidden font-extrabold sm:inline">{name}</span>
          {!signedIn && <span className="chip hidden bg-surface-2 text-ink-faint lg:inline-flex">guest</span>}
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={8} className="card-surface z-50 min-w-52 p-1.5">
            <Dropdown.Item onSelect={() => setPicker(true)} className={itemCls} data-testid="menu-change-avatar">
              <Smile size={16} /> Change avatar
            </Dropdown.Item>
            <Dropdown.Item onSelect={(e) => { e.preventDefault(); void randomize(); }} className={itemCls} data-testid="menu-randomize-avatar">
              <Dices size={16} /> Randomize avatar
            </Dropdown.Item>
            <Dropdown.Separator className="my-1 h-px bg-line" />
            {signedIn && (
              <Dropdown.Item onSelect={() => navigate(`/u/${auth.profile?.username ?? ''}`)} className={itemCls}>
                <User size={16} /> Profile
              </Dropdown.Item>
            )}
            <Dropdown.Item onSelect={() => navigate('/leaderboard')} className={itemCls}>
              <Trophy size={16} /> Leaderboard
            </Dropdown.Item>
            <Dropdown.Item onSelect={() => navigate('/settings')} className={itemCls}>
              <Settings size={16} /> Settings
            </Dropdown.Item>
            <Dropdown.Separator className="my-1 h-px bg-line" />
            {signedIn ? (
              <Dropdown.Item
                onSelect={() => void auth.signOut()}
                className={itemCls + ' text-uno-red data-[highlighted]:bg-uno-red/10'}
              >
                <LogOut size={16} /> Sign out
              </Dropdown.Item>
            ) : (
              <Dropdown.Item onSelect={() => navigate('/login')} className={itemCls}>
                <LogIn size={16} /> {supabaseEnabled ? 'Log in / sign up' : 'Guest settings'}
              </Dropdown.Item>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      {!signedIn && supabaseEnabled && (
        <Link to="/login" className="btn-primary hidden !py-2 sm:inline-flex">
          <LogIn size={16} /> Log in
        </Link>
      )}
      <AvatarPicker open={picker} onOpenChange={setPicker} />
    </>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo />
        <div className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn('rounded-xl px-3 py-2 text-sm font-extrabold transition', isActive ? 'bg-surface-2 text-ink' : 'text-ink-soft hover:text-ink')
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link to="/settings" className="btn-ghost hidden !p-2 sm:inline-flex" aria-label="Settings">
            <Settings size={19} />
          </Link>
          <UserMenu />
          <button className="btn-ghost !p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {[...links, { to: '/settings', label: 'Settings' }].map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-extrabold hover:bg-surface-2">
                  {l.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-ink-soft sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-6 w-6" />
          <span>
            UNO Chess — a fan-made variant inspired by{' '}
            <a className="font-bold underline decoration-dotted" href="https://www.youtube.com/@TripleSGames" target="_blank" rel="noreferrer">
              TripleSGames
            </a>
            . Not affiliated with Mattel.
          </span>
        </div>
        <div className="flex gap-4 font-bold">
          <Link to="/rules">Rules</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <a href="https://github.com/tabslvss/uno-chess" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
