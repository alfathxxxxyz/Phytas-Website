const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID || '1028722282';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUP_ID}`);

    if (!response.ok) {
      throw new Error(`Roblox API ${response.status}`);
    }

    const data = await response.json();
    const memberCount = Number(data.memberCount);

    if (!Number.isFinite(memberCount)) {
      throw new Error('Roblox member count missing');
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({
      memberCount,
      groupId: ROBLOX_GROUP_ID,
      groupName: data.name || null,
      source: 'roblox-group',
    });
  } catch (error) {
    res.status(502).json({
      error: 'Unable to load Roblox community stats',
    });
  }
};
