const redis = require('../lib/redis');
const checkAuth = require('../lib/auth');
const applyCors = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    try {
      // Načtení všech seznamů z indexu v Redisu
      const rawLists = await redis.hgetall('lists:index');
      if (!rawLists) {
        return res.status(200).json([]);
      }

      const lists = Object.entries(rawLists).map(([id, val]) => {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        return {
          id: id,
          name: parsed.name || id
        };
      });

      return res.status(200).json(lists);
    } catch (err) {
      return res.status(500).json({ error: 'Chyba při načítání seznamů z Redisu' });
    }
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ error: 'Metoda není podporována.' });
};
