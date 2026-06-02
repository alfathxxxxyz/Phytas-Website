const fs = require('fs');
const path = require('path');

const SITE_TIMEZONE = process.env.SITE_TIMEZONE || 'Asia/Jakarta';

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

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const eventsPath = path.join(process.cwd(), 'data', 'events.json');
    const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
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
