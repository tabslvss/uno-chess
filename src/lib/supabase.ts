import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True when accounts are enabled (Supabase env vars present). Otherwise the site runs guest-only. */
export const supabaseEnabled = Boolean(url && anonKey);

/** Forget any saved session (e.g. for a project that no longer exists). */
export function clearStoredSession(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

/**
 * The client is created only once the project has answered the health check below. Creating it
 * eagerly makes supabase-js try to refresh any saved session straight away, which against an
 * unreachable project means a burst of failed requests on every page load.
 * `null` until then, and forever when accounts are disabled or the project is unreachable.
 */
export let supabase: SupabaseClient | null = null;

/**
 * Resolves true when the Supabase project answers at all (any HTTP status), false when it
 * can't be reached (deleted project, DNS failure, offline) within 5 seconds.
 */
export const supabaseHealth: Promise<boolean> = supabaseEnabled
  ? fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey! }, signal: AbortSignal.timeout(5000) })
      .then(() => {
        supabase = createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        return true;
      })
      .catch(() => {
        console.warn('[accounts] Supabase is unreachable — running in guest mode.');
        clearStoredSession();
        return false;
      })
  : Promise.resolve(false);

export interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  created_at: string;
}

export interface RatingRow {
  user_id: string;
  category: 'bullet' | 'blitz' | 'rapid';
  rating: number;
  rd: number;
  vol: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
}

export interface GameRow {
  id: string;
  white_id: string | null;
  black_id: string | null;
  white_name: string;
  black_name: string;
  rated: boolean;
  mode: string;
  time_control: string;
  category: string;
  winner: 'w' | 'b' | null;
  reason: string;
  white_rating_before: number | null;
  white_rating_after: number | null;
  black_rating_before: number | null;
  black_rating_after: number | null;
  turns: number;
  ended_at: string;
}
