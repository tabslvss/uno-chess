import type * as Party from 'partykit/server';
import type { ServerEnv } from './env.ts';

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];

export function cors(req: Party.Request, env: ServerEnv, res: Response): Response {
  const allowed = [...DEFAULT_ORIGINS, ...(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim())].filter(Boolean);
  const origin = req.headers.get('Origin');
  const headers = new Headers(res.headers);
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers });
}

export function json(req: Party.Request, env: ServerEnv, body: unknown, status = 200): Response {
  return cors(req, env, Response.json(body, { status }));
}
