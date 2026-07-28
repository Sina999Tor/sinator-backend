const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  try {
    // Lehký round-trip na Redis, ať víme, že spojení skutečně žije.
    await redis.set('__health_probe__', Date.now());
    const val = await redis.get('__health_probe__');
    return res.status(200).json({ ok: true, redis: val ? 'connected' : 'unknown', time: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
