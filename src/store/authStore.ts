import { create } from 'zustand';
import { preconnectSocket, warmGameServer } from '../net/socket';
import { supabase, supabaseConfigured, type Profile } from '../lib/supabase';
import type { AuthError, Session } from '@supabase/supabase-js';

export type AuthScreen = 'login' | 'register';

interface AuthStore {
  initialized: boolean;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  authScreen: AuthScreen;
  pendingReturn: string | null;

  init: () => Promise<void>;
  setAuthScreen: (screen: AuthScreen) => void;
  setPendingReturn: (screen: string | null) => void;
  clearMessages: () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, username: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  applyEloFromServer: (elo: number) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function mapAuthError(err: AuthError | { message: string; code?: string } | null): string {
  if (!err) return 'Unknown error.';
  const msg = err.message.toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Wrong email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirm your email first — check your inbox.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account with that email already exists. Try logging in.';
  }
  if (msg.includes('password') && msg.includes('6')) {
    return 'Password must be at least 6 characters.';
  }
  if (msg.includes('password') && msg.includes('weak')) {
    return 'Password is too weak. Use at least 8 characters with letters and numbers.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return 'New registrations are disabled.';
  }
  return err.message;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, elo, wins, losses, draws')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const row = data as {
    user_id: string;
    full_name: string | null;
    elo: number | null;
    wins: number | null;
    losses: number | null;
    draws: number | null;
  };
  return {
    id: row.user_id,
    username: row.full_name?.trim() || 'Player',
    elo: row.elo ?? 500,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    draws: row.draws ?? 0,
  };
}

async function ensureProfile(
  userId: string,
  fallbackUsername: string,
): Promise<Profile | null> {
  if (!supabase) return null;
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const username = (fallbackUsername || 'player').trim() || 'player';
  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    full_name: username,
    elo: 500,
  });
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return null;
  }
  return loadProfile(userId);
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  initialized: false,
  session: null,
  profile: null,
  loading: false,
  error: null,
  notice: null,
  authScreen: 'login',
  pendingReturn: null,

  init: async () => {
    if (!supabaseConfigured || !supabase) {
      set({ initialized: true });
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session ?? null;
    let profile: Profile | null = null;
    if (session?.user) {
      profile = await ensureProfile(
        session.user.id,
        (session.user.user_metadata?.username as string | undefined) ??
          session.user.email?.split('@')[0] ??
          'player',
      );
    }
    set({ session, profile, initialized: true });
    if (session) void preconnectSocket();

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      let nextProfile: Profile | null = null;
      if (nextSession?.user) {
        nextProfile = await ensureProfile(
          nextSession.user.id,
          (nextSession.user.user_metadata?.username as string | undefined) ??
            nextSession.user.email?.split('@')[0] ??
            'player',
        );
      }
      set({ session: nextSession, profile: nextProfile });
      if (nextSession) void preconnectSocket();
    });
  },

  setAuthScreen: (authScreen) => set({ authScreen, error: null, notice: null }),
  setPendingReturn: (pendingReturn) => set({ pendingReturn }),
  clearMessages: () => set({ error: null, notice: null }),

  refreshProfile: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;
    const profile = await loadProfile(userId);
    if (profile) set({ profile });
  },

  signIn: async (email, password) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      set({ error: 'Enter your email and password.' });
      return false;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      set({ error: 'That doesn’t look like a valid email.' });
      return false;
    }
    if (!supabase) {
      set({ error: 'Supabase isn’t configured. Check your .env file.' });
      return false;
    }
    set({ loading: true, error: null, notice: null });
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) {
      set({ loading: false, error: mapAuthError(error) });
      return false;
    }
    await get().refreshProfile();
    set({ loading: false });
    return true;
  },

  signUp: async (email, password, username) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      set({ error: 'Enter your email.' });
      return false;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      set({ error: 'That doesn’t look like a valid email.' });
      return false;
    }
    if (!USERNAME_RE.test(trimmedUsername)) {
      set({
        error:
          'Username must be 3–20 characters. Letters, numbers, dot, dash, underscore only.',
      });
      return false;
    }
    if (password.length < 6) {
      set({ error: 'Password must be at least 6 characters.' });
      return false;
    }
    if (!supabase) {
      set({ error: 'Supabase isn’t configured. Check your .env file.' });
      return false;
    }

    set({ loading: true, error: null, notice: null });

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { username: trimmedUsername } },
    });

    if (error) {
      set({ loading: false, error: mapAuthError(error) });
      return false;
    }

    if (data.session) {
      if (data.user) {
        await ensureProfile(data.user.id, trimmedUsername);
      }
      await get().refreshProfile();
      set({ loading: false });
      void warmGameServer(true);
      void preconnectSocket();
      return true;
    }

    set({
      loading: false,
      notice:
        'Check your email to confirm your account, then come back and log in.',
      authScreen: 'login',
    });
    return false;
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ session: null, profile: null, error: null, notice: null });
  },

  applyEloFromServer: (elo) => {
    const { profile } = get();
    if (profile) set({ profile: { ...profile, elo } });
  },
}));
