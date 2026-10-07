import { KeyRound, Mail, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { PageShell } from '@/components/PageShell';
import { Segmented, Spinner } from '@/components/ui';
import { randomGuestName } from '@/lib/guest';
import { supabaseEnabled } from '@/lib/supabase';
import { useAuth, USERNAME_RE } from '@/stores/auth';

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8.3 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

function GuestCard() {
  const { guestName, renameGuest } = useAuth();
  const [name, setName] = useState(guestName);
  const navigate = useNavigate();
  return (
    <div className="card-surface p-6">
      <div className="flex items-center gap-3">
        <Avatar seed={guestName} name={guestName} size={48} />
        <div>
          <h2 className="font-display text-xl font-bold">Play as a guest</h2>
          <p className="text-sm text-ink-soft">Bots, friends and casual games — no account needed.</p>
        </div>
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          renameGuest(name);
          toast.success('Name saved');
          navigate('/play');
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Guest name" />
        <button type="button" className="btn-secondary !px-3" onClick={() => setName(randomGuestName())} aria-label="Random name">
          <Sparkles size={16} />
        </button>
        <button className="btn-sage" data-testid="guest-continue">
          Continue
        </button>
      </form>
    </div>
  );
}

export default function Login() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/play';
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (auth.session) navigate(next, { replace: true });
  }, [auth.session, navigate, next]);

  if (auth.session) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'signin') {
        const err = await auth.signIn(email, password);
        if (err) toast.error(err);
      } else {
        const { error, needsConfirm } = await auth.signUp(email, password, username);
        if (error) toast.error(error);
        else if (needsConfirm) setSent(`We sent a confirmation link to ${email}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    if (!email) return toast.error('Enter your email first.');
    setBusy(true);
    const err = await auth.magicLink(email);
    setBusy(false);
    if (err) toast.error(err);
    else setSent(`Check ${email} for a sign-in link.`);
  };

  return (
    <PageShell>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="card-surface p-6 sm:p-8">
          <h1 className="font-display text-3xl font-bold">{tab === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-ink-soft">Accounts unlock ranked games, ratings and your game history.</p>

          {!supabaseEnabled ? (
            <div className="mt-6 rounded-2xl bg-mustard/15 p-5 text-sm">
              <p className="font-extrabold">Accounts aren’t switched on yet.</p>
              <p className="mt-1 text-ink-soft">
                This server is running in guest mode. Add <code className="kbd">VITE_SUPABASE_URL</code> and{' '}
                <code className="kbd">VITE_SUPABASE_ANON_KEY</code> to enable sign-in. Meanwhile, you can play everything except ranked.
              </p>
            </div>
          ) : sent ? (
            <div className="mt-6 rounded-2xl bg-sage/15 p-5">
              <Mail className="text-sage-deep" />
              <p className="mt-2 font-extrabold">{sent}</p>
              <button className="btn-ghost mt-2 !px-0" onClick={() => setSent(null)}>
                Back
              </button>
            </div>
          ) : (
            <>
              <Segmented
                className="mt-6"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'signin', label: 'Log in' },
                  { value: 'signup', label: 'Sign up' },
                ]}
              />
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button className="btn-secondary" onClick={() => void auth.oauth('google').then((e) => e && toast.error(e))} aria-label="Continue with Google">
                  <GoogleIcon />
                </button>
                <button className="btn-secondary" onClick={() => void auth.oauth('github').then((e) => e && toast.error(e))} aria-label="Continue with GitHub">
                  <GithubIcon />
                </button>
                <button className="btn-secondary" onClick={() => void auth.oauth('discord').then((e) => e && toast.error(e))} aria-label="Continue with Discord">
                  <DiscordIcon />
                </button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-ink-faint">
                <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
              </div>
              <form onSubmit={submit} className="space-y-3">
                {tab === 'signup' && (
                  <label className="block space-y-1.5">
                    <span className="label">Username</span>
                    <div className="relative">
                      <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                      <input
                        className="input pl-9"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="cozy_rook"
                        autoComplete="username"
                        required
                        pattern="[A-Za-z0-9_.\-]{3,20}"
                        aria-invalid={username.length > 0 && !USERNAME_RE.test(username)}
                      />
                    </div>
                    {username.length > 0 && !USERNAME_RE.test(username) && (
                      <span className="text-xs font-bold text-uno-red">3–20 letters, numbers, dots, dashes or underscores.</span>
                    )}
                  </label>
                )}
                <label className="block space-y-1.5">
                  <span className="label">Email</span>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input className="input pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className="label">Password</span>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      className="input pl-9"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                      minLength={6}
                      required
                    />
                  </div>
                </label>
                <button className="btn-primary w-full !py-3" disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4 border-2" /> : tab === 'signin' ? 'Log in' : 'Create account'}
                </button>
              </form>
              <div className="mt-3 flex justify-between text-sm">
                <button className="font-bold text-ink-soft hover:text-ink" onClick={magic} disabled={busy}>
                  Email me a magic link
                </button>
                {tab === 'signin' && (
                  <button
                    className="font-bold text-ink-soft hover:text-ink"
                    onClick={async () => {
                      if (!email) return toast.error('Enter your email first.');
                      const err = await auth.resetPassword(email);
                      if (err) toast.error(err);
                      else toast.success('Password reset email sent.');
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="space-y-6">
          <GuestCard />
          <div className="card-surface p-6 text-sm text-ink-soft">
            <h3 className="font-display text-lg font-bold text-ink">Why make an account?</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Ranked games with bullet, blitz and rapid ratings</li>
              <li>A profile with your rating chart and history</li>
              <li>A spot on the leaderboard</li>
            </ul>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
