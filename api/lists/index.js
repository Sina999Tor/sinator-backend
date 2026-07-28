const { redis } = require('../../lib/redis');
const { checkAuth } = require('../../lib/auth');

// Hash 'lists:index': field = listId -> JSON string { id, name, created_at, item_count }
// Položky každého seznamu jsou ve vlastním hashi 'list:{listId}:items'.

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const all = await redis.hgetall('lists:index');
    const lists = Object.values(all || {}).map(v => (typeof v === 'string' ? JSON.parse(v) : v));
    lists.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    return res.status(200).json(lists);
  }

  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Chybí name.' });
    const id = genId();
    const list = { id, name, created_at: Date.now(), item_count: 0 };
    await redis.hset('lists:index', { [id]: JSON.stringify(list) });
    return res.status(200).json(list);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
