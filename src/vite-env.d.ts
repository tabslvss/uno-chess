/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** PartyKit host, e.g. unochess.<user>.partykit.dev (no protocol). Empty = same origin (dev proxy). */
  readonly VITE_PARTYKIT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
