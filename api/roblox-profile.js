// /api/roblox-profile.js
// Vercel Serverless Function — Fetches Roblox user profile data + Phytas stats
//
// Query params:
//   ?userId=12345       — lookup by Roblox user ID
//   ?username=SomeUser  — lookup by Roblox username (resolved to ID first)
//
// Returns combined JSON with: user info, avatar URLs, social stats, groups, phytas stats

const LEADERBOARD_WORKER = process.env.LEADERBOARD_WORKER_URL || 'https://pythas-leaderboard.alfathpr18.workers.dev';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let userId = req.query.userId ? Number(req.query.userId) : null;
    const username = req.query.username ? String(req.query.username).trim() : null;

    // Resolve username to userId if needed
    if (!userId && username) {
      userId = await resolveUsername(username);
      if (!userId) {
        return res.status(404).json({ error: 'User not found', username });
      }
    }

    if (!userId || !Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Provide a valid userId or username' });
    }

    // Fetch all data in parallel
    const [userInfo, avatarData, socialStats, groups, phytasStats] = await Promise.all([
      fetchUserInfo(userId),
      fetchAvatars(userId),
      fetchSocialStats(userId),
      fetchGroups(userId),
      fetchPhytasStats(userId),
    ]);

    if (!userInfo) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    // Calculate account age
    const createdDate = new Date(userInfo.created);
    const now = new Date();
    const accountAgeDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    const accountAgeYears = Math.floor(accountAgeDays / 365.25);

    // Determine badges
    const badges = generateBadges(accountAgeYears, accountAgeDays, socialStats, phytasStats);

    // Build response
    const profile = {
      ok: true,
      user: {
        id: userInfo.id,
        name: userInfo.name,
        displayName: userInfo.displayName,
        description: userInfo.description || null,
        created: userInfo.created,
        isBanned: userInfo.isBanned || false,
      },
      accountAge: {
        days: accountAgeDays,
        years: accountAgeYears,
        tier: getAgeTier(accountAgeYears),
        createdDate: createdDate.toISOString(),
      },
      avatar: avatarData,
      social: socialStats,
      groups: groups,
      phytas: phytasStats,
      badges: badges,
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(profile);
  } catch (error) {
    console.error('[roblox-profile] Error:', error);
    return res.status(502).json({ error: 'Unable to fetch profile data' });
  }
};

// ---- Resolve username to userId ----
async function resolveUsername(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Fetch user info ----
async function fetchUserInfo(userId) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- Fetch avatar thumbnails ----
async function fetchAvatars(userId) {
  try {
    const [headshot, fullBody, bust] = await Promise.all([
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
    ]);

    const extract = async (response) => {
      if (!response.ok) return null;
      const data = await response.json();
      return data.data && data.data[0] ? data.data[0].imageUrl : null;
    };

    return {
      headshot: await extract(headshot),
      fullBody: await extract(fullBody),
      bust: await extract(bust),
    };
  } catch {
    return { headshot: null, fullBody: null, bust: null };
  }
}

// ---- Fetch social stats ----
async function fetchSocialStats(userId) {
  const defaults = { friends: 0, followers: 0, following: 0 };
  try {
    const [friendsRes, followersRes, followingRes] = await Promise.all([
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
    ]);

    const parse = async (response) => {
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    };

    return {
      friends: await parse(friendsRes),
      followers: await parse(followersRes),
      following: await parse(followingRes),
    };
  } catch {
    return defaults;
  }
}

// ---- Fetch groups ----
async function fetchGroups(userId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!res.ok) return [];
    const data = await res.json();
    // Return top 5 groups
    return (data.data || []).slice(0, 5).map(entry => ({
      id: entry.group.id,
      name: entry.group.name,
      memberCount: entry.group.memberCount,
      role: entry.role ? entry.role.name : null,
    }));
  } catch {
    return [];
  }
}

// ---- Fetch Phytas stats from leaderboard worker ----
async function fetchPhytasStats(userId) {
  try {
    // Query both maps for summit and speedrun
    const [summitAztec, summitAgora, speedrunAztec, speedrunAgora] = await Promise.all([
      fetchLeaderboard('summit', 'aztec'),
      fetchLeaderboard('summit', 'agora'),
      fetchLeaderboard('speedrun', 'aztec'),
      fetchLeaderboard('speedrun', 'agora'),
    ]);

    // Find player in each leaderboard
    const findPlayer = (players, uid) => {
      const idx = players.findIndex(p => p.user_id === uid);
      if (idx === -1) return null;
      return { ...players[idx], rank: idx + 1 };
    };

    const aztecSummit = findPlayer(summitAztec, userId);
    const agoraSummit = findPlayer(summitAgora, userId);
    const aztecSpeedrun = findPlayer(speedrunAztec, userId);
    const agoraSpeedrun = findPlayer(speedrunAgora, userId);

    const hasData = aztecSummit || agoraSummit || aztecSpeedrun || agoraSpeedrun;

    if (!hasData) return null;

    return {
      hasData: true,
      aztec: {
        summit: aztecSummit ? { score: aztecSummit.summit, rank: aztecSummit.rank } : null,
        speedrun: aztecSpeedrun ? { time_ms: aztecSpeedrun.best_time_ms, rank: aztecSpeedrun.rank } : null,
      },
      agora: {
        summit: agoraSummit ? { score: agoraSummit.summit, rank: agoraSummit.rank } : null,
        speedrun: agoraSpeedrun ? { time_ms: agoraSpeedrun.best_time_ms, rank: agoraSpeedrun.rank } : null,
      },
    };
  } catch {
    return null;
  }
}

async function fetchLeaderboard(type, map) {
  try {
    const res = await fetch(`${LEADERBOARD_WORKER}/api/leaderboard/${type}?map=${map}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.players || [];
  } catch {
    return [];
  }
}

// ---- Badge generation ----
function generateBadges(ageYears, ageDays, social, phytas) {
  const badges = [];

  // Account age badges
  if (ageYears >= 10) badges.push({ id: 'og_legend', label: 'OG Legend', icon: '👑', description: '10+ years on Roblox' });
  else if (ageYears >= 5) badges.push({ id: 'og', label: 'OG Player', icon: '🏆', description: '5+ years on Roblox' });
  else if (ageYears >= 3) badges.push({ id: 'veteran', label: 'Veteran', icon: '⭐', description: '3+ years on Roblox' });
  else if (ageYears >= 1) badges.push({ id: 'regular', label: 'Regular', icon: '🎮', description: '1+ year on Roblox' });
  else badges.push({ id: 'rookie', label: 'Rookie', icon: '🌱', description: 'Less than 1 year on Roblox' });

  // Social badges
  if (social.followers >= 10000) badges.push({ id: 'famous', label: 'Famous', icon: '🌟', description: '10K+ followers' });
  else if (social.followers >= 1000) badges.push({ id: 'popular', label: 'Popular', icon: '✨', description: '1K+ followers' });

  if (social.friends >= 200) badges.push({ id: 'social_butterfly', label: 'Social Butterfly', icon: '🦋', description: '200 friends (max!)' });
  else if (social.friends >= 100) badges.push({ id: 'friendly', label: 'Friendly', icon: '👥', description: '100+ friends' });

  // Phytas badges
  if (phytas && phytas.hasData) {
    badges.push({ id: 'pythas_racer', label: 'Pythas Racer', icon: '🏎️', description: 'Active Pythas player' });

    const bestSummitRank = Math.min(
      phytas.aztec?.summit?.rank || Infinity,
      phytas.agora?.summit?.rank || Infinity
    );
    const bestSpeedrunRank = Math.min(
      phytas.aztec?.speedrun?.rank || Infinity,
      phytas.agora?.speedrun?.rank || Infinity
    );
    const bestRank = Math.min(bestSummitRank, bestSpeedrunRank);

    if (bestRank <= 3) badges.push({ id: 'podium', label: 'Podium Finisher', icon: '🥇', description: 'Top 3 in leaderboards' });
    else if (bestRank <= 10) badges.push({ id: 'top10', label: 'Top 10', icon: '🔥', description: 'Top 10 in leaderboards' });
    else if (bestRank <= 50) badges.push({ id: 'top50', label: 'Contender', icon: '💪', description: 'Top 50 in leaderboards' });
  }

  return badges;
}

// ---- Account age tier ----
function getAgeTier(years) {
  if (years >= 10) return 'Legend';
  if (years >= 5) return 'OG';
  if (years >= 3) return 'Veteran';
  if (years >= 1) return 'Regular';
  return 'Rookie';
}
