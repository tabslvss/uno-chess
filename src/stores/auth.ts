import type { Provider, Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { CATEGORIES, DEFAULT_RATING, type Rating, type TimeCategory } from '@/game/rating';
import { isAvatarUrl, randomAvatar } from '@/lib/avatar';
import { guestAvatar, guestId, guestName, setGuestAvatar, setGuestName } from '@/lib/guest';
import { supabase, supabaseEnabled, type ProfileRow, type RatingRow } from '@/lib/supabase';

export interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  ratings: Partial<Record<TimeCategory, RatingRow>>;
  guestName: string;
  guestAvatar: string;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  magicLink: (email: string) => Promise<string | null>;
  oauth: (provider: Provider) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<ProfileRow, 'username' | 'bio' | 'avatar_url' | 'country'>>) => Promise<string | null>;
  renameGuest: (name: string) => void;
  /** Change the current player's avatar (saved to the profile when logged in). */
  setAvatar: (url: string) => Promise<string | null>;
}

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;

/** Human-friendly messages for Supabase auth errors. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with that email already exists.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — please wait a minute.';
  if (m.includes('password') && (m.includes('6') || m.includes('short'))) return 'Password must be at least 6 characters.';
  if (m.includes('weak')) return 'That password is too weak — try a longer one.';
  if (m.includes('fetch') || m.includes('network')) return 'Network hiccup — check your connection.';
  if (m.includes('provider is not enabled')) return 'That sign-in method isn’t enabled yet.';
  return message;
}

async function fetchProfile(userId: string) {
  if (!supabase) return { profile: null, ratings: {} };
  const [p, r] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('ratings').select('*').eq('user_id', userId),
  ]);
  const ratings: Partial<Record<TimeCategory, RatingRow>> = {};
  for (const row of (r.data ?? []) as RatingRow[]) ratings[row.category] = row;
  return { profile: (p.data as ProfileRow | null) ?? null, ratings };
}

let initPromise: Promise<void> | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  ready: !supabaseEnabled,
  session: null,
  profile: null,
  ratings: {},
  guestName: guestName(),
  guestAvatar: guestAvatar(),

  init: () => {
    initPromise ??= (async () => {
      guestId();
      if (!supabase) return set({ ready: true });
      const { data } = await supabase.auth.getSession();
      set({ session: data.session });
      if (data.session) await get().refresh();
      set({ ready: true });
      supabase.auth.onAuthStateChange((_event, session) => {
        const prev = get().session?.user.id;
        set({ session });
        if (!session) set({ profile: null, ratings: {} });
        else if (session.user.id !== prev) void get().refresh();
      });
    })();
    return initPromise;
  },

  refresh: async () => {
    const uid = get().session?.user.id;
    if (!uid) return;
    const { profile, ratings } = await fetchProfile(uid);
    set({ profile, ratings });
    // Everyone gets a random avatar automatically (older accounts / OAuth pictures included).
    if (profile && !isAvatarUrl(profile.avatar_url) && supabase) {
      const url = randomAvatar();
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (!error) set({ profile: { ...profile, avatar_url: url } });
    }
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Accounts aren’t enabled on this server yet.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuthError(error.message) : null;
  },

  signUp: async (email, password, username) => {
    if (!supabase) return { error: 'Accounts aren’t enabled on this server yet.', needsConfirm: false };
    if (!USERNAME_RE.test(username)) {
      return { error: 'Usernames are 3–20 letters, numbers, dots, dashes or underscores.', needsConfirm: false };
    }
    const { data: available } = await supabase.rpc('username_available', { name: username });
    if (available === false) return { error: 'That username is taken.', needsConfirm: false };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username }, emailRedirectTo: `${window.location.origin}/play` },
    });
    if (error) return { error: friendlyAuthError(error.message), needsConfirm: false };
    return { error: null, needsConfirm: !data.session };
  },

  magicLink: async (email) => {
    if (!supabase) return 'Accounts aren’t enabled on this server yet.';
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/play` },
    });
    return error ? friendlyAuthError(error.message) : null;
  },

  oauth: async (provider) => {
    if (!supabase) return 'Accounts aren’t enabled on this server yet.';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/play` },
    });
    return error ? friendlyAuthError(error.message) : null;
  },

  resetPassword: async (email) => {
    if (!supabase) return 'Accounts aren’t enabled on this server yet.';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/settings`,
    });
    return error ? friendlyAuthError(error.message) : null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ session: null, profile: null, ratings: {} });
  },

  updateProfile: async (patch) => {
    const uid = get().session?.user.id;
    if (!supabase || !uid) return 'Not signed in.';
    if (patch.username !== undefined && !USERNAME_RE.test(patch.username)) {
      return 'Usernames are 3–20 letters, numbers, dots, dashes or underscores.';
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    if (error) return error.message.includes('duplicate') ? 'That username is taken.' : error.message;
    await get().refresh();
    return null;
  },

  renameGuest: (name) => set({ guestName: setGuestName(name) }),

  setAvatar: async (url) => {
    if (!isAvatarUrl(url)) return 'That avatar isn’t valid.';
    if (get().session) return get().updateProfile({ avatar_url: url });
    set({ guestAvatar: setGuestAvatar(url) });
    return null;
  },
}));

/** Current access token for the game server (null for guests). */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** The avatar the current player shows (profile avatar when logged in, otherwise the guest one). */
export function myAvatar(state: Pick<AuthState, 'profile' | 'guestAvatar'>): string {
  return isAvatarUrl(state.profile?.avatar_url) ? state.profile!.avatar_url! : state.guestAvatar;
}

export function displayName(state: Pick<AuthState, 'profile' | 'guestName'>): string {
  return state.profile?.username ?? state.guestName;
}

export function ratingFor(state: Pick<AuthState, 'ratings'>, cat: TimeCategory): Rating {
  const r = state.ratings[cat];
  return r ? { rating: r.rating, rd: r.rd, vol: r.vol } : DEFAULT_RATING;
}

export { CATEGORIES };
