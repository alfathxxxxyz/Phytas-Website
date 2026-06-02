const fs = require('fs');
const path = require('path');

const SITE_TIMEZONE = process.env.SITE_TIMEZONE || 'Asia/Jakarta';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bwflcobcbtwtorucmsbr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_APGfpDH22piJVGpdz4WkQw_Vh2EITwO';

function getTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function isOngoingEvent(event, todayKey) {
  if (!event || event.status === 'finished') return false;

  const startDate = event.startDate || event.date;
  const endDate = event.endDate || event.startDate || event.date;
  if (!startDate || !endDate) return false;

  return startDate <= todayKey && todayKey <= endDate;
}

function normalizeEvent(raw) {
  return {
    id: raw.id,
    title: raw.title,
    game: raw.game,
    startDate: raw.startDate || raw.start_date || raw.date,
    endDate: raw.endDate || raw.end_date || raw.startDate || raw.start_date || raw.date,
    date: raw.date,
    time: raw.time,
    timezone: raw.timezone,
    status: raw.status,
    published: raw.published ?? true,
  };
}

async function loadEvents() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/events?select=*&published=eq.true&order=sort_order.asc`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) return data.map(normalizeEvent);
    }
  } catch (error) {}

  const eventsPath = path.join(process.cwd(), 'data', 'events.json');
  return JSON.parse(fs.readFileSync(eventsPath, 'utf8')).map(normalizeEvent);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const events = await loadEvents();
    const today = getTodayKey();
    const ongoingEvents = events
      .filter(event => isOngoingEvent(event, today))
      .map(event => ({
        id: event.id,
        title: event.title,
        game: event.game,
        startDate: event.startDate || event.date,
        endDate: event.endDate || event.startDate || event.date,
        date: event.date,
        time: event.time,
        timezone: event.timezone,
        status: event.status,
      }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      today,
      timezone: SITE_TIMEZONE,
      events: ongoingEvents,
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load ongoing events' });
  }
};
