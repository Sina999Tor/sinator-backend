const { redis } = require('./redis');

// Sekundární index historie: set `hidx:<type>:<id>` obsahuje stejné JSON členy
// jako sorted set `history:<type>`. Díky tomu dotaz na jedno id (a mazání)
// nemusí číst a parsovat celou historii — cena je úměrná počtu záznamů toho id.
// Index se při prvním použití sám dobuduje z existující historie (jednorázově).

const idxKey = (type, id) => `hidx:${type}:${String(id)}`;
const readyKey = (type) => `hidx:ready:${type}`;
const toObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const toMember = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

const readyCache = new Set(); // per-instance, ať se flag nečte z Redis při každém requestu

async function ensureIndex(type) {
  if (readyCache.has(type)) return;
  if (await redis.get(readyKey(type))) { readyCache.add(type); return; }

  const all = await redis.zrange(`history:${type}`, 0, -1);
  const byId = new Map();
  for (const m of all || []) {
    try {
      const k = String(toObj(m).id);
      if (!byId.has(k)) byId.set(k, []);
      byId.get(k).push(toMember(m));
    } catch (e) { /* poškozený záznam přeskoč */ }
  }
  const entries = Array.from(byId.entries());
  const CHUNK = 300;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const p = redis.pipeline();
    for (const [id, members] of entries.slice(i, i + CHUNK)) p.sadd(idxKey(type, id), ...members);
    await p.exec();
  }
  await redis.set(readyKey(type), '1');
  readyCache.add(type);
}

async function getById(type, id) {
  await ensureIndex(type);
  const raw = await redis.smembers(idxKey(type, id));
  return (raw || [])
    .map((v) => { try { return toObj(v); } catch (e) { return null; } })
    .filter(Boolean)
    .sort((a, b) => Number(b.watched_at) - Number(a.watched_at));
}

async function getMembersById(type, id) {
  await ensureIndex(type);
  return (await redis.smembers(idxKey(type, id))) || [];
}

// Zápis do sorted setu + indexu v jednom round-tripu.
async function addEntry(type, entry) {
  const member = JSON.stringify(entry);
  const p = redis.pipeline();
  p.zadd(`history:${type}`, { score: entry.watched_at, member });
  p.sadd(idxKey(type, entry.id), member);
  await p.exec();
}

async function removeMembers(type, id, members) {
  if (!members.length) return;
  const p = redis.pipeline();
  p.zrem(`history:${type}`, ...members);
  p.srem(idxKey(type, id), ...members);
  await p.exec();
}

module.exports = { idxKey, ensureIndex, getById, getMembersById, addEntry, removeMembers, toObj };
