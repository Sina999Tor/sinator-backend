// sinator-backend/api/histra-proxy.js
// CORS proxy pro Histra.net: GET/POST/DELETE /api/histra-proxy?path=/api/v1/...
// Hlavičky: x-api-key (API_SECRET), x-histra-token (osobní token z histra.net)
const crypto = require('crypto');

const HISTRA_BASE = 'https://histra.net';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-histra-token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function keyOk(given) {
  const secret = process.env.API_SECRET || '';
  if (!secret || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!keyOk(req.headers['x-api-key'])) {
    return res.status(401).json({ error: 'Neplatný nebo chybějící x-api-key.' });
  }

  const token = req.headers['x-histra-token'];
  if (!token) return res.status(400).json({ error: 'Chybí x-histra-token.' });

  const path = String((req.query && req.query.path) || '');
  if (!path.startsWith('/api/v1/')) {
    return res.status(400).json({ error: 'Neplatný parametr path (musí začínat /api/v1/).' });
  }

  const method = req.method;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let body;
  if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined && req.body !== null && req.body !== '') {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    headers['Content-Type'] = 'application/json';
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 13000);
  try {
    const r = await fetch(HISTRA_BASE + path, { method, headers, body, signal: ctrl.signal });
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    const timeout = e && e.name === 'AbortError';
    return res.status(timeout ? 504 : 502).json({ error: timeout ? 'Histra neodpověděla včas.' : 'Histra nedostupná: ' + (e && e.message) });
  } finally {
    clearTimeout(timer);
  }
};
