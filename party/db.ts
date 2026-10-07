import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES, DEFAULT_RATING, type Rating, type TimeCategory } from '../src/game/rating.ts';
import type { HistoryEntry } from '../src/game/types.ts';
import { supabaseConfigured, type ServerEnv } from './env.ts';

let cached: { key: string; client: SupabaseClient } | null = null;

export function adminClient(env: ServerEnv): SupabaseClient | null {
  if (!supabaseConfigured(env)) return null;
  const key = `${env.SUPABASE_URL}|${env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  }
  return cached.client;
}

export interface ProfileInfo {
  username: string;
  avatarUrl: string | null;
  ratings: Partial<Record<TimeCategory, Rating>>;
}

export async function loadProfile(env: ServerEnv, userId: string): Promise<ProfileInfo | null> {
  const sb = adminClient(env);
  if (!sb) return null;
  const [{ data: profile }, { data: ratings }] = await Promise.all([
    sb.from('profiles').select('username, avatar_url').eq('id', userId).maybeSingle(),
    sb.from('ratings').select('category, rating, rd, vol').eq('user_id', userId),
  ]);
  if (!profile) return null;
  const out: Partial<Record<TimeCategory, Rating>> = {};
  for (const r of (ratings ?? []) as { category: TimeCategory; rating: number; rd: number; vol: number }[]) {
    if (CATEGORIES.includes(r.category)) out[r.category] = { rating: r.rating, rd: r.rd, vol: r.vol };
  }
  return { username: String(profile.username), avatarUrl: (profile.avatar_url as string | null) ?? null, ratings: out };
}

export async function loadRatings(
  env: ServerEnv,
  userIds: string[],
  category: TimeCategory,
): Promise<Record<string, Rating>> {
  const sb = adminClient(env);
  const out: Record<string, Rating> = {};
  for (const id of userIds) out[id] = { ...DEFAULT_RATING };
  if (!sb) return out;
  const { data } = await sb.from('ratings').select('user_id, rating, rd, vol').eq('category', category).in('user_id', userIds);
  for (const r of (data ?? []) as { user_id: string; rating: number; rd: number; vol: number }[]) {
    out[r.user_id] = { rating: r.rating, rd: r.rd, vol: r.vol };
  }
  return out;
}

export interface GameRecord {
  id: string;
  white_id: string | null;
  black_id: string | null;
  white_name: string;
  black_name: string;
  rated: boolean;
  mode: string;
  time_control: string;
  category: TimeCategory;
  winner: 'w' | 'b' | null;
  reason: string;
  turns: number;
  history: HistoryEntry[];
  white?: Rating & { before: number };
  black?: Rating & { before: number };
}

export async function recordGame(env: ServerEnv, record: GameRecord): Promise<boolean> {
  const sb = adminClient(env);
  if (!sb) return false;
  const { error } = await sb.rpc('record_game', { payload: record });
  if (error) {
    console.error('[db] record_game failed', error.message);
    return false;
  }
  return true;
}
