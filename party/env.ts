/** Server configuration, read from PartyKit room env (set with `partykit env add` or partykit.json vars). */
export interface ServerEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Legacy HS256 JWT secret; when absent, tokens are verified against the project's JWKS. */
  SUPABASE_JWT_SECRET?: string;
  /** Shared secret for matchmaker → game room calls. */
  PARTY_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

export function readEnv(raw: Record<string, unknown>): ServerEnv {
  const pick = (k: keyof ServerEnv) => (typeof raw[k] === 'string' && raw[k] ? (raw[k] as string) : undefined);
  return {
    SUPABASE_URL: pick('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: pick('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_JWT_SECRET: pick('SUPABASE_JWT_SECRET'),
    PARTY_SECRET: pick('PARTY_SECRET'),
    ALLOWED_ORIGINS: pick('ALLOWED_ORIGINS'),
  };
}

export function partySecret(env: ServerEnv): string {
  return env.PARTY_SECRET ?? 'dev-only-party-secret';
}

export function supabaseConfigured(env: ServerEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
