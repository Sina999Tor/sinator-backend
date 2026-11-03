// Tenký wrapper nad Upstash Redis REST klientem.
// Nová Vercel×Upstash Marketplace integrace pojmenovává proměnné jako
// KV_REST_API_URL / KV_REST_API_TOKEN (ne starší UPSTASH_REDIS_REST_URL/TOKEN).
// Zkusíme obojí, ať to funguje bez ohledu na to, jak integraci pojmenovala.
const { Redis } = require('@upstash/redis');

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = new Redis({ url, token });

// „Raw“ klient: vrací hodnoty jako řetězce (bez automatického JSON.parse).
// Hot GET endpointy (history, ratings, progress) jen slepí už hotové JSON řetězce
// do pole — ušetří se parse + stringify tisíců záznamů = hlavní zdroj Active CPU.
const redisRaw = new Redis({ url, token, automaticDeserialization: false });

module.exports = { redis, redisRaw };
