const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');

// Hash 'progress:movies': field = tmdbId -> JSON { id, progress, paused_at }
// Hash 'progress:shows':  field = "showId:season:episode" -> JSON { ..., progress, paused_at }

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const type = req.query.type === 'shows' ? 'shows' : 'movies';
    const all = await redis.hgetall(`progress:${type}`);
    const items = Object.values(all || {}).map(v => (typeof v === 'string' ? JSON.parse(v) : v));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { id, type, season, episode, progress } = req.body || {};
    if (!id || !type || progress == null) return res.status(400).json({ error: 'Chybí id, type nebo progress.' });
    const key = type === 'tv' || type === 'shows' ? 'shows' : 'movies';
    const field = key === 'shows' ? `${id}:${season}:${episode}` : String(id);
    if (progress >= 100) {
      // Dokoukáno — smaž rozkoukanost místo ukládání 100 %
      await redis.hdel(`progress:${key}`, field);
      return res.status(200).json({ ok: true, removed: true });
    }
    const entry = { id, season: season ?? null, episode: episode ?? null, progress, paused_at: Date.now() };
    await redis.hset(`progress:${key}`, { [field]: JSON.stringify(entry) });
    return res.status(200).json(entry);
  }

  if (req.method === 'DELETE') {
    const { id, type, season, episode } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const key = type === 'tv' || type === 'shows' ? 'shows' : 'movies';
    const field = key === 'shows' ? `${id}:${season}:${episode}` : String(id);
    await redis.hdel(`progress:${key}`, field);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
