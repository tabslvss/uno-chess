import { createRemoteJWKSet, jwtVerify } from 'jose';
import { fetchProfile, type ProfileRow } from './supabaseAdmin.ts';

export interface SocketUser {
  id: string;
  email?: string;
  username: string;
  elo: number;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL not configured');
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifyAccessToken(token: string): Promise<SocketUser | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url && !secret) return null;

  try {
    let sub: string;
    let email: string | undefined;

    if (secret) {
      const key = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (!payload.sub) return null;
      sub = payload.sub;
      email = typeof payload.email === 'string' ? payload.email : undefined;
    } else {
      const { payload } = await jwtVerify(token, getJwks());
      if (!payload.sub) return null;
      sub = payload.sub;
      email = typeof payload.email === 'string' ? payload.email : undefined;
    }

    let profile: ProfileRow | null = await fetchProfile(sub);
    if (!profile) {
      profile = {
        id: sub,
        username: email?.split('@')[0] ?? 'player',
        elo: 500,
        wins: 0,
        losses: 0,
        draws: 0,
      };
    }

    return {
      id: sub,
      email,
      username: profile.username,
      elo: profile.elo,
    };
  } catch (e) {
    console.warn('[server] JWT verify failed:', (e as Error).message);
    return null;
  }
}
