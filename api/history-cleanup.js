const { redis } = require('../lib/redis');
const { checkAuth } = require('../lib/auth');
const { applyCors } = require('../lib/cors');

// Jednorázový úklid duplicit v historii sledování. Pro každou unikátní
// položku (u filmů/seriálů podle id, u epizod podle id+season+episode)
// ponechá jen JEDEN záznam — ten s nejnovějším watched_at — a všechny
// ostatní smaže. Dřívější opakované importy stejného Trakt exportu totiž
// mohly vytvořit spoustu umělých "rewatch" záznamů se stejným datem,
// jen s jiným časem importu.
//
// POST /api/history-cleanup  body: { type: 'movies' | 'episodes' | 'shows' | 'all' }

async function cleanupBucket(type) {
  const key = `history:${type}`;
  const all = await redis.zrange(key, 0, -1);
  const parsed = (all || []).map(m => {
    try { return { raw: m, obj: typeof m === 'string' ? JSON.parse(m) : m }; }
    catch (e) { return null; }
  }).filter(Boolean);

  const bestByKey = new Map(); // dedup klíč -> { raw, obj }
  for (const item of parsed) {
    const o = item.obj;
    const dedupKey = type === 'episodes'
      ? `${o.id}:${o.season ?? ''}:${o.episode ?? ''}`
      : `${o.id}`;
    const existing = bestByKey.get(dedupKey);
    if (!existing || Number(o.watched_at) > Number(existing.obj.watched_at)) {
      bestByKey.set(dedupKey, item);
    }
  }

  const keepRaws = new Set(Array.from(bestByKey.values()).map(it => it.raw));
  const toRemove = parsed.filter(it => !keepRaws.has(it.raw)).map(it => it.raw);

  if (toRemove.length) {
    // zrem má limit na počet argumentů v jednom volání — bezpečně po dávkách.
    const BATCH = 500;
    for (let i = 0; i < toRemove.length; i += BATCH) {
      await redis.zrem(key, ...toRemove.slice(i, i + BATCH));
    }
  }

  return { before: parsed.length, after: bestByKey.size, removed: toRemove.length };
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metoda není podporována.' });
  }

  try {
    const { type } = req.body || {};
    const types = type === 'all' || !type ? ['movies', 'episodes', 'shows'] : [type];
    const results = {};
    for (const t of types) {
      if (!['movies', 'episodes', 'shows'].includes(t)) continue;
      results[t] = await cleanupBucket(t);
    }
    return res.status(200).json({ ok: true, results });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
