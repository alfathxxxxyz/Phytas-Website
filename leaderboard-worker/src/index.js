// ============================================================
//  PYTHAS Leaderboard — Cloudflare Worker
//
//  Endpoints:
//    POST /api/roblox/player-stats   (header: x-roblox-secret)
//    GET  /api/leaderboard/summit    -> top 100 by summit desc
//    GET  /api/leaderboard/speedrun  -> top 100 by best_time_ms asc (not null)
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
        return await handleLeaderboard(env, 'summit');
      }
      if (pathname === '/api/leaderboard/speedrun' && method === 'GET') {
        return await handleLeaderboard(env, 'speedrun');
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
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Supabase upsert failed', status: res.status, detail }, 502);
  }

  return json({ ok: true, userId, eventType });
}

// ---- GET /api/leaderboard/:type ----
async function handleLeaderboard(env, type) {
  const select = 'user_id,username,display_name,summit,best_time_ms,updated_at';
  const query =
    type === 'summit'
      ? `select=${select}&order=summit.desc&limit=100`
      : `select=${select}&best_time_ms=not.is.null&order=best_time_ms.asc&limit=100`;

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

  const players = await res.json();
  return json({ ok: true, type, count: players.length, players });
}
