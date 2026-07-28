const { redis } = require('../../../lib/redis');
const { checkAuth } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  const { id } = req.query;

  if (req.method === 'DELETE') {
    await redis.hdel('lists:index', id);
    await redis.del(`list:${id}:items`);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const raw = await redis.hget('lists:index', id);
    if (!raw) return res.status(404).json({ error: 'Seznam nenalezen.' });
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { name } = req.body || {};
    if (name) list.name = name;
    await redis.hset('lists:index', { [id]: JSON.stringify(list) });
    return res.status(200).json(list);
  }

  res.setHeader('Allow', 'DELETE, PATCH');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
