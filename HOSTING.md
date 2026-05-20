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

### 1. Put the code on GitHub

In PowerShell, from `D:\Projects\UnoChess`:

```powershell
git init
git add .
git commit -m "UNO Chess"
```

Create a new repo on https://github.com/new (name it `uno-chess`), then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/uno-chess.git
git branch -M main
git push -u origin main
```

### 2. Deploy the game API on Render

1. Go to https://dashboard.render.com and sign up (free).
2. Click **New +** → **Blueprint**.
3. Connect GitHub and select your `uno-chess` repo.
4. Render reads `render.yaml` and creates **unochess-api**.
5. When prompted, set these **secret** variables:

   | Variable | Value |
   |----------|--------|
   | `SUPABASE_URL` | Same as in your `.env` file |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API → `service_role` |
   | `ALLOWED_ORIGINS` | `https://uno-chess.vercel.app` |

6. Click **Apply** and wait until status is **Live**.
7. Copy your API URL, e.g. `https://unochess-api.onrender.com`  
   Test in browser: `https://unochess-api.onrender.com/health` → should show `{"ok":true}`.

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
