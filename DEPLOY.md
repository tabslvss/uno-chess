# Deploy UNO Chess

## Local play (no hosting)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — **both** the website and game server must run (`npm run dev` starts both).

---

## Production (two services)

| Part | Host | Why |
|------|------|-----|
| Website (React) | **Vercel** | Static Vite build |
| Game server (Socket.io) | **Render** | Vercel cannot run persistent WebSockets |

### 1. Deploy API on Render

1. Push this repo to GitHub.
2. https://dashboard.render.com → **New** → **Blueprint** → connect repo (`render.yaml`).
3. Set environment variables on the `unochess-api` service:
   - `SUPABASE_URL` — same as in `.env`
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard (secret)
   - `ALLOWED_ORIGINS` — your Vercel URL, e.g. `https://uno-chess.vercel.app`
4. After deploy, copy the service URL, e.g. `https://unochess-api.onrender.com`

### 2. Deploy website on Vercel

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel env add VITE_SERVER_URL
# VITE_SERVER_URL = Render URL from step 1 (no trailing slash)
npx vercel deploy --prod
```

Or import the GitHub repo in the Vercel dashboard and set the same three `VITE_*` variables.

### 3. Supabase

In Supabase → Authentication → URL configuration, add your Vercel site URL to **Site URL** and **Redirect URLs**.

---

## Scripts

- `npm run dev` — local web + API
- `npm run build` — production frontend build
- `npm run start:server` — API only (used by Render)
