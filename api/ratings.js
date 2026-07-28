const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');

// Hash 'ratings:movies' / 'ratings:shows': field = tmdbId -> JSON string
// { id, rating, rated_at }

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const type = req.query.type === 'shows' ? 'shows' : 'movies';
    const all = await redis.hgetall(`ratings:${type}`);
    const items = Object.values(all || {}).map(v => (typeof v === 'string' ? JSON.parse(v) : v));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { id, type, rating } = req.body || {};
    if (!id || !type || !rating) return res.status(400).json({ error: 'Chybí id, type nebo rating.' });
    const key = type === 'tv' || type === 'shows' ? 'shows' : 'movies';
    const entry = { id, rating, rated_at: Date.now() };
    await redis.hset(`ratings:${key}`, { [id]: JSON.stringify(entry) });
    return res.status(200).json(entry);
  }

  if (req.method === 'DELETE') {
    const { id, type } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const key = type === 'tv' || type === 'shows' ? 'shows' : 'movies';
    await redis.hdel(`ratings:${key}`, id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
