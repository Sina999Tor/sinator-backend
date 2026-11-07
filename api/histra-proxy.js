// Proxy pro Histra API — histra.net nepovoluje CORS z prohlížeče.
// Appka volá: <backend>/api/histra-proxy?path=/api/v1/...  s hlavičkami x-api-key (API_SECRET) a x-histra-token.
const HISTRA_BASE = 'https://histra.net';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-histra-token');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const secret = process.env.API_SECRET;
  if (!secret || req.headers['x-api-key'] !== secret) return res.status(401).json({ error: 'Unauthorized' });

  const token = req.headers['x-histra-token'];
  if (!token) return res.status(400).json({ error: 'Chybí x-histra-token' });

  const path = String((req.query && req.query.path) || '');
  if (!path.startsWith('/api/')) return res.status(400).json({ error: 'Neplatná cesta' });

  const method = String(req.method || 'GET').toUpperCase();
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined && req.body !== '') {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    headers['Content-Type'] = 'application/json';
  }

  try {
    const r = await fetch(HISTRA_BASE + path, init);
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Histra nedostupná: ' + (e && e.message ? e.message : e) });
  }
};
