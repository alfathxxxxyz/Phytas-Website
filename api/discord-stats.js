const DISCORD_INVITE_CODE = process.env.DISCORD_INVITE_CODE || 'sqfbJYMDhW';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true`,
      {
        headers: {
          'User-Agent': 'PYTHAS Website Discord Stats (https://phytas-website.vercel.app)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Discord API ${response.status}`);
    }

    const data = await response.json();
    const memberCount = Number(data.approximate_member_count);
    const onlineCount = Number(data.approximate_presence_count);

    if (!Number.isFinite(memberCount)) {
      throw new Error('Discord member count missing');
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({
      memberCount,
      onlineCount: Number.isFinite(onlineCount) ? onlineCount : null,
      inviteCode: DISCORD_INVITE_CODE,
      source: 'discord-invite',
    });
  } catch (error) {
    res.status(502).json({
      error: 'Unable to load Discord stats',
    });
  }
};
