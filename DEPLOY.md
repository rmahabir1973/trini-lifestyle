# Deploy the Trinidad & Tobago 2026 app to Railway + your own domain

This folder is ready to deploy as-is. It's a tiny Node static server (`server.js`, no
dependencies) that serves the app in `public/` on the port Railway gives it.

```
Trinidad-Trip-Railway/
├── public/            ← the app (index.html, manifest, sw.js, icons)
├── server.js          ← tiny web server (listens on $PORT)
├── package.json       ← tells Railway to run "npm start"
└── .gitignore
```

---

## Step 1 — Deploy to Railway

Pick ONE of the two paths.

### Path A — Railway CLI (fastest, no GitHub needed)
1. Install the CLI (needs Node installed on your computer):
   ```bash
   npm install -g @railway/cli
   ```
2. Log in:
   ```bash
   railway login
   ```
3. From inside this folder:
   ```bash
   cd Trinidad-Trip-Railway
   railway init          # create a new project (give it a name)
   railway up            # uploads & builds the app
   ```
4. Give it a public URL to test:
   ```bash
   railway domain
   ```
   This prints a free URL like `https://trinidad-trip-production.up.railway.app`.
   Open it — the app should load. 🎉

### Path B — GitHub (nice if you want auto-deploys on every change)
1. Create a new GitHub repo and push this folder's contents to it.
2. In Railway: **New Project → Deploy from GitHub repo →** pick the repo.
3. Railway auto-detects Node, runs `npm start`, and deploys.
4. In the service, go to **Settings → Networking → Generate Domain** for a test URL.

> Railway auto-detects everything from `package.json`. You do **not** need to set a
> start command or a port — `server.js` already reads Railway's `PORT`.

---

## Step 2 — Buy a cheap domain (~$1–2)

Cheapest first-year TLDs are usually `.xyz`, `.click`, or `.site`. Good registrars:
- **Porkbun** (porkbun.com) — often ~$1–2/yr for `.xyz`
- **Namecheap** or **Cloudflare Registrar**

Buy something like `mahabirtrip.xyz`. (You'll use a **subdomain** of it below, which
avoids DNS headaches — see the note.)

---

## Step 3 — Point the domain at Railway

1. In Railway: open your service → **Settings → Networking → Custom Domain → + Add**.
2. Type the domain you want to use. **Use a subdomain**, e.g. `trip.mahabirtrip.xyz`
   (recommended — see note below).
3. Railway shows a **CNAME target** like `abcd1234.up.railway.app`. Copy it.
4. Go to your registrar's **DNS settings** and add a record:
   | Type  | Name / Host | Value / Target                  |
   |-------|-------------|---------------------------------|
   | CNAME | `trip`      | `abcd1234.up.railway.app` (from Railway) |
5. Save. Wait a few minutes (sometimes up to an hour) for DNS to propagate.
   Railway automatically issues a free HTTPS certificate once it sees the record.
6. Visit `https://trip.mahabirtrip.xyz` — done. ✅

> **Why a subdomain?** A root/apex domain (`mahabirtrip.xyz` with no `trip.` in front)
> can't always take a CNAME. If you specifically want the bare domain, use a registrar
> that supports **CNAME flattening / ALIAS / ANAME** records (Cloudflare and Porkbun do),
> or just add a redirect from the root to your `trip.` subdomain. The subdomain route is
> the least fussy.

---

## Step 4 — Put it on everyone's phones

Open your new domain on each phone and add it to the home screen:
- **iPhone (Safari):** Share button → **Add to Home Screen** → Add
- **Android (Chrome):** ⋮ menu → **Install app** / Add to Home screen

It installs as "🌴 Trini '26", opens full-screen, and works offline.

---

## Updating the app later
- **CLI:** make your edit in `public/`, then run `railway up` again.
- **GitHub:** commit and push — Railway redeploys automatically.

## A note on cost
Railway's Hobby plan is about **$5/month** and includes usage credit. This app is
featherweight (a static server), so it sits comfortably inside that. The only *extra*
cost is the ~$1–2/year domain.

## Data note
Each person's checkmarks and notes are saved in **their own phone's browser**, not on the
server. Hosting just makes the app reachable — it doesn't sync data between phones. Use the
**Backup / Restore** buttons in the app to copy data from one device to another.
