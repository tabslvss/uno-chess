# Make online play work on Vercel

Your site **https://uno-chess.vercel.app** is only the website.  
**Vercel cannot run the game server** (Socket.io needs a always-on Node app).

You need **one free API host** + one setting on Vercel.

---

## Best free option: [Render](https://render.com) (recommended)

| | |
|---|---|
| **Cost** | Free tier |
| **Catch** | Sleeps after ~15 min with no players; first request takes ~30–60 s to wake up |
| **Good for** | Friends testing, small games |

Other free-ish options: **Fly.io**, **Koyeb** (same idea — separate Node server).  
Avoid trying to put Socket.io on Vercel serverless — it will not work.

---

## Step-by-step (about 10 minutes)

### 1. GitHub (done)

Repo: **https://github.com/tabslvss/uno-chess**

### 2. Deploy the game API on Render

**Option A — CLI (recommended)**

From `D:\Projects\UnoChess`:

```powershell
.\scripts\setup-render.ps1
```

This installs the [Render CLI](https://github.com/render-oss/cli), logs you in, creates **unochess-api** from the repo, reads Supabase keys from `.env`, and sets `VITE_SERVER_URL` on Vercel.

**Option B — one-click Blueprint**

1. Open: https://render.com/deploy?repo=https://github.com/tabslvss/uno-chess  
2. Connect GitHub and approve the blueprint.
3. When prompted, set **only** these secrets (`ALLOWED_ORIGINS` is already in `render.yaml`):

   | Variable | Value |
   |----------|--------|
   | `SUPABASE_URL` | Same as in your `.env` file |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API → `service_role` |

4. Wait until status is **Live**, then test: `https://unochess-api.onrender.com/health` → `{"ok":true}`.

### 3. Tell Vercel where the API is

In PowerShell (replace with your Render URL):

```powershell
cd D:\Projects\UnoChess
echo https://unochess-api.onrender.com | npx vercel env add VITE_SERVER_URL production
npx vercel deploy --prod --yes
```

No trailing slash on the URL.

### 4. Supabase auth (one-time)

Supabase Dashboard → **Authentication** → **URL configuration**:

- **Site URL:** `https://uno-chess.vercel.app`
- **Redirect URLs:** add `https://uno-chess.vercel.app`

---

## Play locally (no Render needed)

```powershell
cd D:\Projects\UnoChess
npm run dev
```

Open http://localhost:5173 — do **not** open the Vercel URL for local testing of rooms.

---

## Checklist

- [ ] Render service **Live**, `/health` returns `ok`
- [ ] `VITE_SERVER_URL` set on Vercel to Render URL
- [ ] Redeployed Vercel after adding env var
- [ ] Supabase Site URL includes `https://uno-chess.vercel.app`

After that, **Play a Friend** and **Ranked Match** on the live site should work (allow up to 1 minute on first connect if Render was sleeping).
