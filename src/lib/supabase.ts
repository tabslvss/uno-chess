import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True when accounts are enabled (Supabase env vars present). Otherwise the site runs guest-only. */
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

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
