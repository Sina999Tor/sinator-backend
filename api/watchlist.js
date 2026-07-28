const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');

// Hash 'watchlist': field = "movie:603" nebo "tv:1399" -> JSON string
// { id, type, title, year, poster_path, added_at }

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const all = await redis.hgetall('watchlist');
    const items = Object.values(all || {}).map(v => (typeof v === 'string' ? JSON.parse(v) : v));
    items.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { id, type, title, year, poster_path } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const field = `${type}:${id}`;
    const entry = { id, type, title: title || null, year: year || null, poster_path: poster_path || null, added_at: Date.now() };
    await redis.hset('watchlist', { [field]: JSON.stringify(entry) });
    return res.status(200).json(entry);
  }

  if (req.method === 'DELETE') {
    const { id, type } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    await redis.hdel('watchlist', `${type}:${id}`);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
