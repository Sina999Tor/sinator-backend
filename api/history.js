const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');

// Sorted set 'history:movies' / 'history:episodes': score = watched_at (ms),
// member = JSON string { id, type, season?, episode?, watched_at }
// Member obsahuje watched_at, takže je vždy unikátní i při rewatch.

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const type = req.query.type === 'episodes' ? 'episodes' : 'movies';
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const total = await redis.zcard(`history:${type}`);
    const raw = await redis.zrange(`history:${type}`, start, end, { rev: true });
    const items = (raw || []).map(v => (typeof v === 'string' ? JSON.parse(v) : v));

    res.setHeader('X-Pagination-Item-Count', String(total));
    res.setHeader('X-Pagination-Page-Count', String(Math.max(1, Math.ceil(total / limit))));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { id, type, season, episode, watched_at } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const key = type === 'episode' || type === 'episodes' ? 'episodes' : 'movies';
    const ts = watched_at ? new Date(watched_at).getTime() : Date.now();
    const entry = { id, type: key, season: season ?? null, episode: episode ?? null, watched_at: ts };
    await redis.zadd(`history:${key}`, { score: ts, member: JSON.stringify(entry) });
    return res.status(200).json(entry);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
