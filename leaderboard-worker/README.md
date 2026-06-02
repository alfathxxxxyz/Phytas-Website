# PYTHAS Leaderboard — Cloudflare Worker + Supabase

Backend for the Roblox leaderboard. The Roblox game pushes player stats to this
Worker, the Worker stores them in Supabase, and the website reads the leaderboards.

```
Roblox game  --POST /api/roblox/player-stats-->  Worker  --upsert-->  Supabase
Website      --GET  /api/leaderboard/summit ---->  Worker  --select-->  Supabase
Website      --GET  /api/leaderboard/speedrun -->  Worker  --select-->  Supabase
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/roblox/player-stats` | header `x-roblox-secret` | Upsert one player's stats (body may include `map`) |
| POST | `/api/register` | Cloudflare Turnstile token | Save an event registration (anti-spam) |
| GET | `/api/leaderboard/summit?map=aztec\|agora` | none | Top 100 by `summit` (desc) for that map |
| GET | `/api/leaderboard/speedrun?map=aztec\|agora` | none | Top 100 by `best_time_ms` (asc, non-null) for that map |

> `map` defaults to **aztec** if omitted. Valid values: `aztec`, `agora`.

**POST `/api/roblox/player-stats` body**
```json
{
  "userId": 123456789,
  "username": "xRacer_Pro",
  "displayName": "xRacer",
  "summit": 42,
  "bestTimeMs": 83470,
  "eventType": "speedrun"
}
```
Rules: wrong/missing secret → `401`. The secret is compared in constant time.
`summit` is stored as the latest value. `best_time_ms` is only updated when the
new value is smaller, or when it's still null. Inputs are length/range validated.

**POST `/api/register` body**
```json
{
  "roblox_username": "xRacer_Pro",
  "discord_username": "@xracer",
  "device": "PC",
  "map": "Mount Agora",
  "notes": "optional",
  "event_id": "evt-001",
  "event_title": "LIMPUL 3 SUMMIT",
  "turnstileToken": "<token from the Turnstile widget>",
  "website": ""
}
```
Rules: the `turnstileToken` is verified server-side with Cloudflare's siteverify API
(skipped only if `TURNSTILE_SECRET_KEY` is unset). `website` is a honeypot — if filled,
the request is silently accepted but discarded. Per-IP rate limited. `device` must be
one of `PC` / `Mobile` / `Mixed`. The row is inserted with the service role.

---

## Setup (do this once)

### 1. Database (Supabase)
Open Supabase → **SQL Editor** → **New query** → paste the contents of
[`migrations/0001_init.sql`](migrations/0001_init.sql) → **Run**.

### 2. Get your env values
- `SUPABASE_URL` — Supabase → Project Settings → Data API (e.g. `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → **API Keys** → `service_role` **secret**
  ⚠️ This key bypasses all security. Keep it secret. It only lives in the Worker, never in the website.
- `ROBLOX_SYNC_SECRET` — make a long random string yourself, e.g.
  `openssl rand -hex 32`
- `TURNSTILE_SECRET_KEY` — Cloudflare dashboard → **Turnstile** → create a widget → copy the **Secret Key**.
  The matching **Site Key** (public) goes in the website's `supabase-config.js` (`TURNSTILE_SITE_KEY`).
- `ALLOWED_ORIGINS` (non-secret) — comma-separated origins allowed to call the Worker from a browser,
  e.g. `https://pythas.gg,https://www.pythas.gg,https://phytas-website.vercel.app,https://*.vercel.app,http://localhost:*`.
  Set in `wrangler.toml` under `[vars]`. If the website shows `Failed to fetch`
  even though the Worker URL works in `curl`, the page origin is probably missing
  from this list.

### 3. Install & log in to Wrangler
```bash
cd leaderboard-worker
npm install
npx wrangler login
```

### 4. Set the secrets (production)
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ROBLOX_SYNC_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
`ALLOWED_ORIGINS` is non-secret and lives in `wrangler.toml` (`[vars]`), so it
doesn't need `wrangler secret put`. Deploy the Worker after changing it.

### 5. Deploy
```bash
npx wrangler deploy
```
Wrangler prints your Worker URL, e.g. `https://pythas-leaderboard.<your-subdomain>.workers.dev`.

> **Local testing:** copy `.dev.vars.example` to `.dev.vars`, fill it in, then `npx wrangler dev`.

---

## Test with curl

Replace `WORKER` with your deployed URL (or `http://localhost:8787` for `wrangler dev`).

```bash
# 1) Push a player (should return {"ok":true,...})
curl -X POST "WORKER/api/roblox/player-stats" \
  -H "content-type: application/json" \
  -H "x-roblox-secret: YOUR_ROBLOX_SYNC_SECRET" \
  -d '{"userId":123456789,"username":"xRacer_Pro","displayName":"xRacer","summit":42,"bestTimeMs":83470,"eventType":"speedrun"}'

# 2) Wrong secret -> should return 401
curl -i -X POST "WORKER/api/roblox/player-stats" \
  -H "content-type: application/json" \
  -H "x-roblox-secret: WRONG" \
  -d '{"userId":1,"summit":1}'

# 3) Send a faster time -> best_time_ms updates; a slower time -> stays
curl -X POST "WORKER/api/roblox/player-stats" \
  -H "content-type: application/json" \
  -H "x-roblox-secret: YOUR_ROBLOX_SYNC_SECRET" \
  -d '{"userId":123456789,"username":"xRacer_Pro","bestTimeMs":80000}'

# 4) Read leaderboards
curl "WORKER/api/leaderboard/summit"
curl "WORKER/api/leaderboard/speedrun"
```

---

## Roblox side (Lua)

Enable **HTTP Requests** in Studio: Game Settings → Security → *Allow HTTP Requests*.
Put this in a **ServerScriptService** script and call `syncPlayer(...)` when a player
reaches the summit or sets a time.

```lua
local HttpService = game:GetService("HttpService")

local ENDPOINT = "https://pythas-leaderboard.YOUR-SUBDOMAIN.workers.dev/api/roblox/player-stats"
-- Best practice: store this in the Creator Dashboard "Secrets" instead of hardcoding.
local SYNC_SECRET = "YOUR_ROBLOX_SYNC_SECRET"

local function syncPlayer(player, summit, bestTimeMs, eventType)
    local payload = {
        userId = player.UserId,
        username = player.Name,
        displayName = player.DisplayName,
        summit = summit,
        bestTimeMs = bestTimeMs,   -- pass nil if no run time
        eventType = eventType,     -- e.g. "summit" or "speedrun"
    }
    local ok, err = pcall(function()
        HttpService:RequestAsync({
            Url = ENDPOINT,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-roblox-secret"] = SYNC_SECRET,
            },
            Body = HttpService:JSONEncode(payload),
        })
    end)
    if not ok then
        warn("[leaderboard] sync failed: " .. tostring(err))
    end
end
```

---

## Notes
- **CORS** is locked to `ALLOWED_ORIGINS` when set; otherwise it falls back to `*`
  (open). Set `ALLOWED_ORIGINS` in production so only your site can read the endpoints
  from a browser. (Roblox `HttpService` is server-to-server and isn't affected by CORS.)
- The `players` table has RLS enabled with no policies, so it can't be read/written
  with the public anon key — only the Worker (service role) can touch it.
- **Registrations** go through `/api/register`, which verifies a Cloudflare Turnstile
  token server-side and rate-limits per IP. With this in place you can tighten the
  `registrations` RLS so the public anon key can no longer insert directly — see
  `SETUP-SUPABASE.md` ("Lock down registrations to the Worker").
- The Worker returns **generic error messages**; real causes are logged server-side
  (view with `npx wrangler tail`).
- Never commit `.dev.vars` or the service role key.
