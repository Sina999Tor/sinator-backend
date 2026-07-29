const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');
const { applyCors } = require('../lib/cors');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metoda není podporována.' });
  }

  try {
    const { kind, items, name, listId: existingListId } = req.body || {};
    if (!kind) return res.status(400).json({ error: 'Chybí kind.' });

    if (kind === 'watchlist') {
      if (!Array.isArray(items) || !items.length) return res.status(200).json({ ok: true, count: 0 });
      const fields = {};
      for (const it of items) {
        fields[`${it.type}:${it.id}`] = JSON.stringify({ id: it.id, type: it.type, title: it.title || null, year: it.year || null, poster_path: it.poster_path || null, added_at: it.added_at || Date.now() });
      }
      await redis.hset('watchlist', fields);
      return res.status(200).json({ ok: true, count: items.length });
    }

    if (kind === 'ratings-movies' || kind === 'ratings-shows') {
      if (!Array.isArray(items) || !items.length) return res.status(200).json({ ok: true, count: 0 });
      const key = kind === 'ratings-shows' ? 'ratings:shows' : 'ratings:movies';
      const fields = {};
      for (const it of items) {
        fields[String(it.id)] = JSON.stringify({ id: it.id, rating: it.rating, rated_at: it.rated_at || Date.now() });
      }
      await redis.hset(key, fields);
      return res.status(200).json({ ok: true, count: items.length });
    }

    if (kind === 'history-movies' || kind === 'history-episodes' || kind === 'history-shows') {
      if (!Array.isArray(items) || !items.length) return res.status(200).json({ ok: true, count: 0 });
      const key = kind === 'history-episodes' ? 'history:episodes' : (kind === 'history-shows' ? 'history:shows' : 'history:movies');
      const pipeline = redis.pipeline();
      for (const it of items) {
        const ts = it.watched_at || Date.now();
        const entry = { id: it.id, type: kind === 'history-episodes' ? 'episodes' : (kind === 'history-shows' ? 'shows' : 'movies'), season: it.season ?? null, episode: it.episode ?? null, watched_at: ts };
        pipeline.zadd(key, { score: ts, member: JSON.stringify(entry) });
      }
      await pipeline.exec();
      return res.status(200).json({ ok: true, count: items.length });
    }

    if (kind === 'progress-movies' || kind === 'progress-shows') {
      if (!Array.isArray(items) || !items.length) return res.status(200).json({ ok: true, count: 0 });
      const key = kind === 'progress-shows' ? 'progress:shows' : 'progress:movies';
      const fields = {};
      for (const it of items) {
        const field = kind === 'progress-shows' ? `${it.id}:${it.season}:${it.episode}` : String(it.id);
        fields[field] = JSON.stringify({ id: it.id, season: it.season ?? null, episode: it.episode ?? null, progress: it.progress, paused_at: it.paused_at || Date.now() });
      }
      await redis.hset(key, fields);
      return res.status(200).json({ ok: true, count: items.length });
    }

    if (kind === 'list') {
      if (!name) return res.status(400).json({ error: 'Chybí name.' });
      let listId = existingListId;
      if (!listId) {
        listId = genId();
        await redis.hset('lists:index', { [listId]: JSON.stringify({ id: listId, name, created_at: Date.now(), item_count: 0 }) });
      }
      if (Array.isArray(items) && items.length) {
        const fields = {};
        for (const it of items) {
          fields[`${it.type}:${it.id}`] = JSON.stringify({ id: it.id, type: it.type, added_at: Date.now() });
        }
        await redis.hset(`list:${listId}:items`, fields);
        const count = Object.keys(await redis.hgetall(`list:${listId}:items`) || {}).length;
        const raw = await redis.hget('lists:index', listId);
        if (raw) {
          const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
          list.item_count = count;
          await redis.hset('lists:index', { [listId]: JSON.stringify(list) });
        }
      }
      return res.status(200).json({ ok: true, listId });
    }

    return res.status(400).json({ error: 'Neznámý kind: ' + kind });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
