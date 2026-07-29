const { redis } = require('../../../lib/redis');
const { checkAuth } = require('../../../lib/auth');
const { applyCors } = require('../../../lib/cors');

// Hash 'list:{id}:items': field = "movie:603" -> JSON string { id, type, added_at }

async function updateItemCount(listId) {
  const items = await redis.hgetall(`list:${listId}:items`);
  const count = Object.keys(items || {}).length;
  const raw = await redis.hget('lists:index', listId);
  if (raw) {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    list.item_count = count;
    await redis.hset('lists:index', { [listId]: JSON.stringify(list) });
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;
  const { id } = req.query;

  if (req.method === 'GET') {
    const all = await redis.hgetall(`list:${id}:items`);
    const items = Object.values(all || {}).map(v => (typeof v === 'string' ? JSON.parse(v) : v));
    items.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { id: itemId, type } = req.body || {};
    if (!itemId || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    const entry = { id: itemId, type, added_at: Date.now() };
    await redis.hset(`list:${id}:items`, { [`${type}:${itemId}`]: JSON.stringify(entry) });
    await updateItemCount(id);
    return res.status(200).json(entry);
  }

  if (req.method === 'DELETE') {
    const { id: itemId, type } = req.body || {};
    if (!itemId || !type) return res.status(400).json({ error: 'Chybí id nebo type.' });
    await redis.hdel(`list:${id}:items`, `${type}:${itemId}`);
    await updateItemCount(id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
