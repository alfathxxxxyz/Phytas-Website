// ============================================================
//  PYTHAS Leaderboard — Cloudflare Worker
//
//  Endpoints:
//    POST /api/roblox/player-stats        (header: x-roblox-secret; body may include map)
//    GET  /api/leaderboard/summit?map=    -> top 100 by summit desc (per map)
//    GET  /api/leaderboard/speedrun?map=  -> top 100 by best_time_ms asc (per map)
//    map = "aztec" (default) or "agora"
//
//  Env (set as Wrangler secrets, never commit real values):
//    SUPABASE_URL
//    SUPABASE_SERVICE_ROLE_KEY
//    ROBLOX_SYNC_SECRET
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-roblox-secret',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

// Normalize the ?map= query param to a known map name. Defaults to Mount Aztec.
function getMap(request) {
  const raw = (new URL(request.url).searchParams.get('map') || '').trim().toLowerCase();
  if (raw === 'agora' || raw === 'mount agora' || raw === 'mount-agora') return 'Mount Agora';
  return 'Mount Aztec';
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (pathname === '/api/roblox/player-stats' && method === 'POST') {
        return await handlePlayerStats(request, env);
      }
      if (pathname === '/api/leaderboard/summit' && method === 'GET') {
        return await handleLeaderboard(env, 'summit', getMap(request));
      }
      if (pathname === '/api/leaderboard/speedrun' && method === 'GET') {
        return await handleLeaderboard(env, 'speedrun', getMap(request));
      }
      if (pathname === '/api/roblox/avatars' && method === 'GET') {
        return await handleRobloxAvatars(request);
      }
      if (pathname === '/api/roblox/game-icons' && method === 'GET') {
        return await handleRobloxGameIcons(request);
      }
      if (pathname === '/api/roblox/users' && method === 'GET') {
        return await handleRobloxUsers(request);
      }
      if (pathname === '/api/admin/refresh-names' && method === 'GET') {
        return await handleRefreshNames(env);
      }
      if (pathname === '/' || pathname === '/health') {
        return json({ ok: true, service: 'pythas-leaderboard' });
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: 'Internal error', detail: String((err && err.message) || err) }, 500);
    }
  },
};

// ---- POST /api/roblox/player-stats ----
async function handlePlayerStats(request, env) {
  // Auth: shared secret sent by the Roblox game server
  const secret = request.headers.get('x-roblox-secret');
  if (!secret || secret !== env.ROBLOX_SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return json({ error: 'userId is required and must be a positive number' }, 400);
  }

  const username = body.username != null ? String(body.username) : null;
  const displayName = body.displayName != null ? String(body.displayName) : null;
  const summit = body.summit != null ? Math.trunc(Number(body.summit)) : null;
  const bestTimeMs = body.bestTimeMs != null ? Math.trunc(Number(body.bestTimeMs)) : null;
  const eventType = body.eventType != null ? String(body.eventType) : null;
  // Map: accept "Mount Agora"/"agora" etc; default to Mount Aztec
  const rawMap = (body.map != null ? String(body.map) : '').trim().toLowerCase();
  const map = (rawMap === 'agora' || rawMap === 'mount agora' || rawMap === 'mount-agora')
    ? 'Mount Agora'
    : 'Mount Aztec';

  if (summit != null && !Number.isFinite(summit)) {
    return json({ error: 'summit must be a number' }, 400);
  }
  if (bestTimeMs != null && (!Number.isFinite(bestTimeMs) || bestTimeMs < 0)) {
    return json({ error: 'bestTimeMs must be a non-negative number' }, 400);
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
    const detail = await res.text();
    return json({ error: 'Supabase upsert failed', status: res.status, detail }, 502);
  }

  return json({ ok: true, userId, map, eventType });
}

// ---- GET /api/leaderboard/:type ----
async function handleLeaderboard(env, type, map) {
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
    const detail = await res.text();
    return json({ error: 'Supabase query failed', status: res.status, detail }, 502);
  }

  let players = await res.json();

  // Auto-fill real Roblox names for rows that still have placeholder usernames
  // (e.g. "User_123"). Resolved names are saved back to Supabase so this only
  // needs to happen once per player.
  players = await fillRealNames(env, players);

  return json({ ok: true, type, map, count: players.length, players });
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
async function handleRobloxAvatars(request) {
  const { searchParams } = new URL(request.url);
  const userIds = (searchParams.get('userIds') || '').replace(/[^0-9,]/g, '');
  if (!userIds) return json({ ok: true, data: [] });
  const size = (searchParams.get('size') || '150x150').replace(/[^0-9x]/g, '');
  const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=${size}&format=Png&isCircular=true`;
  return await proxyJson(url);
}

// ---- GET /api/roblox/game-icons?placeIds=1,2 ----
async function handleRobloxGameIcons(request) {
  const { searchParams } = new URL(request.url);
  const placeIds = (searchParams.get('placeIds') || '').replace(/[^0-9,]/g, '');
  if (!placeIds) return json({ ok: true, data: [] });
  const size = (searchParams.get('size') || '512x512').replace(/[^0-9x]/g, '');
  const url = `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeIds}&size=${size}&format=Png&isCircular=false&returnPolicy=PlaceHolder`;
  return await proxyJson(url);
}

// ---- GET /api/roblox/users?userIds=1,2,3 ----
// Resolves real Roblox usernames + display names (server-side POST, no CORS).
async function handleRobloxUsers(request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('userIds') || '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .slice(0, 200);
  if (ids.length === 0) return json({ ok: true, data: [] });
  const map = await fetchRobloxUsers(ids);
  if (!map) return json({ ok: false, data: [] }, 200);
  // Return in the same shape as the Roblox API for compatibility
  const data = Object.keys(map).map(id => ({
    id: Number(id),
    name: map[id].name,
    displayName: map[id].displayName,
  }));
  return json({ ok: true, data }, 200);
}

// ---- GET /api/admin/refresh-names ----
// Finds ALL rows that still have placeholder usernames (across every map),
// resolves their real Roblox names in batches, and saves them to Supabase.
// Handy to clean up stragglers that hit a rate limit on first load.
async function handleRefreshNames(env) {
  // Fetch distinct placeholder user_ids
  const url = `${env.SUPABASE_URL}/rest/v1/players?select=user_id,username,display_name&or=(username.like.User_*,username.is.null)&limit=1000`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    return json({ ok: false, error: 'query failed', status: res.status, detail: await res.text() }, 502);
  }
  const rows = await res.json();
  const ids = [...new Set(
    rows.filter(r => isPlaceholderName(r.username) && isPlaceholderName(r.display_name) && r.user_id > 0)
        .map(r => r.user_id)
  )];
  if (ids.length === 0) return json({ ok: true, resolved: 0, remaining: 0, message: 'All names already resolved.' });

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

  return json({ ok: true, requested: ids.length, resolved: resolvedCount, remaining: ids.length - resolvedCount });
}

// Fetch a Roblox thumbnails URL from the server side and return its JSON with CORS.
async function proxyJson(url) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      return json({ ok: false, data: [], status: res.status }, 200);
    }
    const data = await res.json();
    return json(data, 200);
  } catch (err) {
    return json({ ok: false, data: [], detail: String((err && err.message) || err) }, 200);
  }
}
