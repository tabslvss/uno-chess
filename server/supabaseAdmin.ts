import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      '[server] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY not set — ELO updates disabled.',
    );
    return null;
  }
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export interface ProfileRow {
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

type DbProfile = {
  user_id: string;
  full_name: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
};

function mapProfile(row: DbProfile): ProfileRow {
  return {
    id: row.user_id,
    username: row.full_name?.trim() || 'Player',
    elo: row.elo ?? 500,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    draws: row.draws ?? 0,
  };
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, full_name, elo, wins, losses, draws')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[server] fetchProfile', error.message);
    return null;
  }
  if (!data) return null;
  return mapProfile(data as DbProfile);
}
