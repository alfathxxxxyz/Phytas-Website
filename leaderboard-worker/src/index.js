// ============================================================
//  PYTHAS Leaderboard + Registration — Cloudflare Worker
//
//  Endpoints:
//    POST /api/roblox/player-stats        (header: x-roblox-secret; body may include map)
//    POST /api/register                   (public, Turnstile-protected)
//    GET  /api/leaderboard/summit?map=    -> top 100 by summit desc (per map)
//    GET  /api/leaderboard/speedrun?map=  -> top 100 by best_time_ms asc (per map)
//    GET  /api/roblox/avatars?userIds=    -> proxied Roblox headshots
//    GET  /api/roblox/game-icons?placeIds=-> proxied Roblox game icons
//    GET  /api/roblox/users?userIds=      -> resolve Roblox usernames/display names
//    GET  /api/admin/refresh-names        -> backfill placeholder names
//    map = "aztec" (default) or "agora"
//
//  Env (set as Wrangler secrets / vars, never commit real values):
//    SUPABASE_URL
//    SUPABASE_SERVICE_ROLE_KEY        (secret)
//    ROBLOX_SYNC_SECRET               (secret)
//    TURNSTILE_SECRET_KEY             (secret) — Cloudflare Turnstile siteverify key
//    ALLOWED_ORIGINS                  (var)    — comma-separated origins allowed via CORS
//                                                e.g. "https://pythas.gg,https://www.pythas.gg"
//                                                If unset, CORS falls back to "*" (NOT recommended).
// ============================================================

// ---- Validation / abuse limits ----
const LIMITS = {
  USERNAME_MAX: 50,
  DISPLAY_NAME_MAX: 80,
  DISCORD_MAX: 50,
  NOTES_MAX: 300,
  EVENT_TITLE_MAX: 120,
  EVENT_ID_MAX: 60,
  EVENT_TYPE_MAX: 40,
  // Sane upper bounds so a compromised/buggy client can't write absurd values
  SUMMIT_MAX: 1_000_000,
  BEST_TIME_MS_MAX: 86_400_000, // 24h in ms
};

const ALLOWED_DEVICES = new Set(['PC', 'Mobile', 'Mixed']);

// ---- Best-effort, in-memory rate limiting ----
// NOTE: Workers run as distributed isolates with no shared memory, so this only
// throttles bursts hitting the same isolate. For hard guarantees use Cloudflare
// Rate Limiting Rules (dashboard) or a KV/Durable Object counter. This is a
// cheap first line of defense that costs nothing.
const rateBuckets = new Map(); // key -> { start: number, count: number }

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 };
    rateBuckets.set(key, entry);
  }
  entry.count++;
  // Opportunistic cleanup to bound memory
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.start >= windowMs) rateBuckets.delete(k);
    }
  }
  return entry.count <= limit;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// ---- Constant-time string comparison (avoids secret timing leaks) ----
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Length mismatch can't be equal; still scan to avoid early-exit on content.
  if (ab.length !== bb.length) {
    let dummy = 0;
    for (let i = 0; i < ab.length; i++) dummy |= ab[i];
    return false;
  }
  let result = 0;
  for (let i = 0; i < ab.length; i++) result |= ab[i] ^ bb[i];
  return result === 0;
}

// ---- CORS ----
function allowedOrigins(env) {
  return ((env && env.ALLOWED_ORIGINS) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-roblox-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const list = allowedOrigins(env);
  const origin = request && request.headers ? request.headers.get('Origin') : null;
  if (list.length === 0) {
    // Not configured yet: stay backward-compatible. Set ALLOWED_ORIGINS to lock down.
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && list.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // If an allowlist is set and the origin isn't on it, we simply omit the header
  // so browsers block the cross-origin read.
  return headers;
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

// ---- Input helpers ----
function cleanStr(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function boundedInt(value, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return { ok: false };
  if (n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

// Normalize a map value ("agora"/"Mount Agora"/...) to a known map name.
// Defaults to Mount Aztec.
function normalizeMap(raw) {
  const v = (raw == null ? '' : String(raw)).trim().toLowerCase();
  if (v === 'agora' || v === 'mount agora' || v === 'mount-agora') return 'Mount Agora';
  return 'Mount Aztec';
}

// Normalize the ?map= query param to a known map name.
function getMap(request) {
  return normalizeMap(new URL(request.url).searchParams.get('map'));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (pathname === '/api/roblox/player-stats' && method === 'POST') {
        return await handlePlayerStats(request, env);
      }
      if (pathname === '/api/register' && method === 'POST') {
        return await handleRegister(request, env);
      }
      if (pathname === '/api/leaderboard/summit' && method === 'GET') {
        return await handleLeaderboard(env, 'summit', getMap(request), request);
      }
      if (pathname === '/api/leaderboard/speedrun' && method === 'GET') {
        return await handleLeaderboard(env, 'speedrun', getMap(request), request);
      }
      if (pathname === '/api/roblox/avatars' && method === 'GET') {
        return await handleRobloxAvatars(request, env);
      }
      if (pathname === '/api/roblox/game-icons' && method === 'GET') {
        return await handleRobloxGameIcons(request, env);
      }
      if (pathname === '/api/roblox/users' && method === 'GET') {
        return await handleRobloxUsers(request, env);
      }
      if (pathname === '/api/admin/refresh-names' && method === 'GET') {
        return await handleRefreshNames(env, request);
      }
      if (pathname === '/' || pathname === '/health') {
        return json({ ok: true, service: 'pythas-leaderboard' }, 200, request, env);
      }
      return json({ error: 'Not found' }, 404, request, env);
    } catch (err) {
      // Log the real cause server-side; never leak internals to the client.
      console.error('[worker] unhandled error:', err);
      return json({ error: 'Internal error' }, 500, request, env);
    }
  },
};

// ---- POST /api/roblox/player-stats ----
async function handlePlayerStats(request, env) {
  // Light rate limit per IP (the secret is the real gate; this curbs brute force)
  if (!rateLimit(`stats:${clientIp(request)}`, 120, 60_000)) {
    return json({ error: 'Too many requests' }, 429, request, env);
  }

  // Auth: shared secret sent by the Roblox game server (constant-time compare)
  const secret = request.headers.get('x-roblox-secret') || '';
  if (!env.ROBLOX_SYNC_SECRET || !timingSafeEqual(secret, env.ROBLOX_SYNC_SECRET)) {
    return json({ error: 'Unauthorized' }, 401, request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, request, env);
  }

  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0 || userId > Number.MAX_SAFE_INTEGER) {
    return json({ error: 'userId is required and must be a positive number' }, 400, request, env);
  }

  const username = cleanStr(body.username, LIMITS.USERNAME_MAX);
  const displayName = cleanStr(body.displayName, LIMITS.DISPLAY_NAME_MAX);
  const eventType = cleanStr(body.eventType, LIMITS.EVENT_TYPE_MAX);
  const map = normalizeMap(body.map); // "Mount Aztec" (default) or "Mount Agora"

  let summit = null;
  if (body.summit != null) {
    const r = boundedInt(body.summit, 0, LIMITS.SUMMIT_MAX);
    if (!r.ok) return json({ error: 'summit out of range' }, 400, request, env);
    summit = r.value;
  }

  let bestTimeMs = null;
  if (body.bestTimeMs != null) {
    const r = boundedInt(body.bestTimeMs, 0, LIMITS.BEST_TIME_MS_MAX);
    if (!r.ok) return json({ error: 'bestTimeMs out of range' }, 400, request, env);
    bestTimeMs = r.value;
  }

  // Atomic upsert via PostgREST RPC (handles "summit latest" + "best time only if smaller")
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/upsert_player_stats`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_username: username,
      p_display_name: displayName,
      p_summit: summit,
      p_best_time_ms: bestTimeMs,
      p_map: map,
    }),
  });

  if (!res.ok) {
    console.error('[worker] supabase upsert failed:', res.status, await safeText(res));
    return json({ error: 'Upstream error' }, 502, request, env);
  }

  return json({ ok: true, userId, map, eventType }, 200, request, env);
}

// ---- POST /api/register (public, Turnstile-protected) ----
async function handleRegister(request, env) {
  const ip = clientIp(request);

  // Hard-ish per-IP throttle for the public endpoint
  if (!rateLimit(`reg:${ip}`, 5, 60_000)) {
    return json({ error: 'Too many requests. Please slow down.' }, 429, request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, request, env);
  }

  // Honeypot: real users never fill this. Pretend success to not tip off bots.
  if (body.website) {
    return json({ ok: true }, 200, request, env);
  }

  // Turnstile verification (server-side). Skipped only if not configured yet.
  if (env.TURNSTILE_SECRET_KEY) {
    const token = cleanStr(body.turnstileToken, 4096);
    if (!token) {
      return json({ error: 'Captcha required' }, 400, request, env);
    }
    const ok = await verifyTurnstile(token, ip, env);
    if (!ok) {
      return json({ error: 'Captcha verification failed' }, 403, request, env);
    }
  }

  // Validate fields
  const roblox = cleanStr(body.roblox_username, LIMITS.USERNAME_MAX);
  const discord = cleanStr(body.discord_username, LIMITS.DISCORD_MAX);
  const device = cleanStr(body.device, 16);
  const map = cleanStr(body.map, 60);
  const notes = cleanStr(body.notes, LIMITS.NOTES_MAX);
  const eventId = cleanStr(body.event_id, LIMITS.EVENT_ID_MAX);
  const eventTitle = cleanStr(body.event_title, LIMITS.EVENT_TITLE_MAX);

  if (!roblox || !discord || !device) {
    return json({ error: 'Missing required fields' }, 400, request, env);
  }
  if (!ALLOWED_DEVICES.has(device)) {
    return json({ error: 'Invalid device' }, 400, request, env);
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/registrations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event_id: eventId,
      event_title: eventTitle,
      roblox_username: roblox,
      discord_username: discord,
      device,
      map,
      notes,
    }),
  });

  if (!res.ok) {
    console.error('[worker] registration insert failed:', res.status, await safeText(res));
    return json({ error: 'Could not save registration' }, 502, request, env);
  }

  return json({ ok: true }, 200, request, env);
}

async function verifyTurnstile(token, ip, env) {
  try {
    const form = new URLSearchParams();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    if (ip && ip !== 'unknown') form.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      console.error('[worker] turnstile siteverify HTTP error:', res.status);
      return false;
    }
    const data = await res.json();
    if (!data.success) {
      console.error('[worker] turnstile rejected:', data['error-codes']);
    }
    return data.success === true;
  } catch (err) {
    console.error('[worker] turnstile verify exception:', err);
    return false;
  }
}

// ---- GET /api/leaderboard/:type ----
async function handleLeaderboard(env, type, map, request) {
  const select = 'user_id,username,display_name,summit,best_time_ms,updated_at';
  const mapFilter = `map=eq.${encodeURIComponent(map)}`;
  const query =
    type === 'summit'
      ? `select=${select}&${mapFilter}&summit=gt.0&order=summit.desc&limit=100`
      : `select=${select}&${mapFilter}&best_time_ms=not.is.null&order=best_time_ms.asc&limit=100`;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/players?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    console.error('[worker] supabase query failed:', res.status, await safeText(res));
    return json({ error: 'Upstream error' }, 502, request, env);
  }

  let players = await res.json();

  // Auto-fill real Roblox names for rows that still have placeholder usernames
  // (e.g. "User_123"). Resolved names are saved back to Supabase so this only
  // needs to happen once per player.
  players = await fillRealNames(env, players);

  return json({ ok: true, type, map, count: players.length, players }, 200, request, env);
}

// Returns true if a stored name is missing or a placeholder like "User_123".
function isPlaceholderName(name) {
  return !name || /^user[_ ]?\d+$/i.test(String(name));
}

// Look up real Roblox names for placeholder rows, persist them to Supabase,
// and return the players array with names patched in.
async function fillRealNames(env, players) {
  const needs = players.filter(
    p => p.user_id > 0 && isPlaceholderName(p.display_name) && isPlaceholderName(p.username)
  );
  if (needs.length === 0) return players;

  const ids = needs.map(p => p.user_id).slice(0, 100);
  const resolved = await fetchRobloxUsers(ids); // { id: {name, displayName} }
  if (!resolved || Object.keys(resolved).length === 0) return players;

  // Patch in-memory for an immediate response
  players.forEach(p => {
    const r = resolved[p.user_id];
    if (r) {
      p.username = r.name || p.username;
      p.display_name = r.displayName || r.name || p.display_name;
    }
  });

  // Persist to Supabase via RPC (updates names across all maps for these users,
  // without touching summit/best_time). Fire and forget; ignore failures.
  try {
    const rows = Object.keys(resolved).map(id => ({
      user_id: Number(id),
      username: resolved[id].name,
      display_name: resolved[id].displayName || resolved[id].name,
    }));
    await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/upsert_player_names`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p: rows }),
    });
  } catch (_) { /* best effort */ }

  return players;
}

// Calls the Roblox users API with several retries on 429 (rate limit) and
// transient errors, using increasing backoff so partial batches don't get lost.
async function fetchRobloxUsers(ids) {
  const body = JSON.stringify({ userIds: ids, excludeBannedUsers: false });
  const backoffs = [400, 900, 1800]; // ms between attempts
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch('https://users.roblox.com/v1/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body,
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < backoffs.length) {
          await new Promise(r => setTimeout(r, backoffs[attempt]));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      const map = {};
      (data.data || []).forEach(u => {
        if (u && u.id) map[u.id] = { name: u.name, displayName: u.displayName || u.name };
      });
      return map;
    } catch (_) {
      if (attempt < backoffs.length) {
        await new Promise(r => setTimeout(r, backoffs[attempt]));
        continue;
      }
    }
  }
  return null;
}

// ---- GET /api/roblox/avatars?userIds=1,2,3 ----
// Proxies Roblox thumbnails so the browser doesn't hit CORS issues.
async function handleRobloxAvatars(request, env) {
  const { searchParams } = new URL(request.url);
  const userIds = (searchParams.get('userIds') || '').replace(/[^0-9,]/g, '');
  if (!userIds) return json({ ok: true, data: [] }, 200, request, env);
  const size = (searchParams.get('size') || '150x150').replace(/[^0-9x]/g, '');
  const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=${size}&format=Png&isCircular=true`;
  return await proxyJson(url, request, env);
}

// ---- GET /api/roblox/game-icons?placeIds=1,2 ----
async function handleRobloxGameIcons(request, env) {
  const { searchParams } = new URL(request.url);
  const placeIds = (searchParams.get('placeIds') || '').replace(/[^0-9,]/g, '');
  if (!placeIds) return json({ ok: true, data: [] }, 200, request, env);
  const size = (searchParams.get('size') || '512x512').replace(/[^0-9x]/g, '');
  const url = `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeIds}&size=${size}&format=Png&isCircular=false&returnPolicy=PlaceHolder`;
  return await proxyJson(url, request, env);
}

// ---- GET /api/roblox/users?userIds=1,2,3 ----
// Resolves real Roblox usernames + display names (server-side POST, no CORS).
async function handleRobloxUsers(request, env) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('userIds') || '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .slice(0, 200);
  if (ids.length === 0) return json({ ok: true, data: [] }, 200, request, env);
  const map = await fetchRobloxUsers(ids);
  if (!map) return json({ ok: false, data: [] }, 200, request, env);
  // Return in the same shape as the Roblox API for compatibility
  const data = Object.keys(map).map(id => ({
    id: Number(id),
    name: map[id].name,
    displayName: map[id].displayName,
  }));
  return json({ ok: true, data }, 200, request, env);
}

// ---- GET /api/admin/refresh-names ----
// Finds ALL rows that still have placeholder usernames (across every map),
// resolves their real Roblox names in batches, and saves them to Supabase.
// Handy to clean up stragglers that hit a rate limit on first load.
async function handleRefreshNames(env, request) {
  // Fetch distinct placeholder user_ids
  const url = `${env.SUPABASE_URL}/rest/v1/players?select=user_id,username,display_name&or=(username.like.User_*,username.is.null)&limit=1000`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('[worker] refresh-names query failed:', res.status, await safeText(res));
    return json({ ok: false, error: 'query failed' }, 502, request, env);
  }
  const rows = await res.json();
  const ids = [...new Set(
    rows.filter(r => isPlaceholderName(r.username) && isPlaceholderName(r.display_name) && r.user_id > 0)
        .map(r => r.user_id)
  )];
  if (ids.length === 0) return json({ ok: true, resolved: 0, remaining: 0, message: 'All names already resolved.' }, 200, request, env);

  let resolvedCount = 0;
  // Process in batches of 100 with a small pause to respect rate limits
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const map = await fetchRobloxUsers(batch);
    if (map && Object.keys(map).length > 0) {
      const payload = Object.keys(map).map(id => ({
        user_id: Number(id),
        username: map[id].name,
        display_name: map[id].displayName || map[id].name,
      }));
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/upsert_player_names`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ p: payload }),
        });
        resolvedCount += payload.length;
      } catch (_) { /* best effort */ }
    }
    if (i + 100 < ids.length) await new Promise(r => setTimeout(r, 700));
  }

  return json({ ok: true, requested: ids.length, resolved: resolvedCount, remaining: ids.length - resolvedCount }, 200, request, env);
}

// Fetch a Roblox thumbnails URL from the server side and return its JSON with CORS.
async function proxyJson(url, request, env) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      return json({ ok: false, data: [], status: res.status }, 200, request, env);
    }
    const data = await res.json();
    return json(data, 200, request, env);
  } catch (err) {
    console.error('[worker] proxyJson error:', err);
    return json({ ok: false, data: [] }, 200, request, env);
  }
}

// Read a response body as text without throwing (for logging only).
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '<unreadable>';
  }
}
