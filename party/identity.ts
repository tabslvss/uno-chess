import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isAvatarUrl } from '../src/lib/avatar.ts';
import type { AuthPayload } from '../src/net/protocol.ts';
import type { Identity } from './gameRoom.ts';
import { loadProfile } from './db.ts';
import type { ServerEnv } from './env.ts';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function verifyToken(env: ServerEnv, token: string): Promise<{ sub: string; email?: string } | null> {
  try {
    if (env.SUPABASE_JWT_SECRET) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), {
        algorithms: ['HS256'],
      });
      return payload.sub ? { sub: payload.sub, email: payload.email as string | undefined } : null;
    }
    if (!env.SUPABASE_URL) return null;
    let jwks = jwksCache.get(env.SUPABASE_URL);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
      jwksCache.set(env.SUPABASE_URL, jwks);
    }
    const { payload } = await jwtVerify(token, jwks);
    return payload.sub ? { sub: payload.sub, email: payload.email as string | undefined } : null;
  } catch {
    return null;
  }
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Guest display names: letters, digits, space, _ . - ; 2–20 chars. */
export function sanitizeName(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return cleaned.length >= 2 ? cleaned : fallback;
}

/**
 * Resolve who is connecting. A valid Supabase token → account identity;
 * otherwise a guest identity bound to the browser's private guest id.
 */
export async function resolveIdentity(env: ServerEnv, auth: AuthPayload): Promise<{ identity: Identity; error?: string }> {
  const guestHash = (await sha(`guest:${auth.guestId}`)).slice(0, 12);
  const guest: Identity = {
    key: `guest:${auth.guestId}`,
    publicId: `g_${guestHash}`,
    name: sanitizeName(auth.guestName, `Guest-${parseInt(guestHash.slice(0, 4), 16) % 10000}`),
    guest: true,
    userId: null,
    avatarUrl: isAvatarUrl(auth.guestAvatar) ? auth.guestAvatar : null,
    ratings: {},
  };
  if (!auth.token) return { identity: guest };
  const claims = await verifyToken(env, auth.token);
  if (!claims) return { identity: guest, error: 'Your session expired — playing as a guest. Log in again for ranked.' };
  const profile = await loadProfile(env, claims.sub);
  return {
    identity: {
      key: `user:${claims.sub}`,
      publicId: claims.sub,
      name: profile?.username ?? sanitizeName(claims.email?.split('@')[0], 'Player'),
      guest: false,
      userId: claims.sub,
      avatarUrl: isAvatarUrl(profile?.avatarUrl) ? profile!.avatarUrl : null,
      ratings: profile?.ratings ?? {},
    },
  };
}
