// Tenký wrapper nad Upstash Redis REST klientem.
// Nová Vercel×Upstash Marketplace integrace pojmenovává proměnné jako
// KV_REST_API_URL / KV_REST_API_TOKEN (ne starší UPSTASH_REDIS_REST_URL/TOKEN).
// Zkusíme obojí, ať to funguje bez ohledu na to, jak integraci pojmenovala.
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = { redis };
