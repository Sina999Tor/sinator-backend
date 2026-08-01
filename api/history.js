const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');
const { applyCors } = require('../lib/cors');

// Sorted set 'history:movies' / 'history:episodes' / 'history:shows': score = watched_at (ms),
// member = JSON string { id, type, season?, episode?, watched_at }
// Member obsahuje watched_at, takže je vždy unikátní i při rewatch.
//
// 'shows' = celý seriál označený jako shlédnutý (bez rozpadu na epizody).
// 'episodes' = konkrétní zhlédnutá epizoda (má season+episode).
// 'movies' = film.

function resolveHistoryKey(type, season, episode) {
  if (type === 'episode' || type === 'episodes') return 'episodes';
  if (season != null && episode != null) return 'episodes';
  if (type === 'show' || type === 'shows' || type === 'tv') return 'shows';
  return 'movies';
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const type = ['episodes', 'shows'].includes(req.query.type) ? req.query.type : 'movies';
    const idFilter = req.query.id != null ? String(req.query.id) : null;

    // Cílený dotaz na konkrétní položku (bez stránkování celé historie) —
    // používá appka, když jen potřebuje zjistit stav jednoho filmu/seriálu.
    if (idFilter) {
      const all = await redis.zrange(`history:${type}`, 0, -1, { rev: true });
      const items = (all || [])
        .map(v => (typeof v === 'string' ? JSON.parse(v) : v))
        .filter(o => String(o.id) === idFilter);
      return res.status(200).json(items);
    }

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
    const key = resolveHistoryKey(type, season, episode);
    const ts = watched_at ? new Date(watched_at).getTime() : Date.now();
    const entry = { id, type: key, season: season ?? null, episode: episode ?? null, watched_at: ts };
    await redis.zadd(`history:${key}`, { score: ts, member: JSON.stringify(entry) });
    return res.status(200).json(entry);
  }

  if (req.method === 'DELETE') {
    const { id, type, season, episode, watched_at } = req.body || {};
    if (!id || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const key = resolveHistoryKey(type, season, episode);
    const all = await redis.zrange(`history:${key}`, 0, -1);
    const toRemove = (all || []).filter(m => {
      try {
        const o = typeof m === 'string' ? JSON.parse(m) : m;
        if (String(o.id) !== String(id)) return false;
        if (watched_at != null) return Number(o.watched_at) === Number(watched_at);
        if (key === 'episodes' && (season != null || episode != null)) {
          return String(o.season) === String(season) && String(o.episode) === String(episode);
        }
        return true;
      } catch (e) { return false; }
    });
    if (toRemove.length) await redis.zrem(`history:${key}`, ...toRemove);
    return res.status(200).json({ ok: true, removed: toRemove.length });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
