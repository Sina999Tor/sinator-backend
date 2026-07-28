// Tenký wrapper nad Upstash Redis REST klientem.
// Potřebuje env proměnné UPSTASH_REDIS_REST_URL a UPSTASH_REDIS_REST_TOKEN
// (Vercel je nastaví automaticky, pokud přidáš Upstash integraci z Marketplace).
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = { redis };
