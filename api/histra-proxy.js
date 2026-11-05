// api/histra-proxy.js
// -------------------------------------------------------------------------
// Proxy endpoint pro histra.net API, aby šlo volat z prohlížeče (Histra API
// nemá CORS hlavičky pro volání z webu — je dělané pro appky jako Kodi/Jellyfin).
// Tenhle soubor běží na TVÉM sinator-backend (Vercel), takže žádné CORS
// omezení neplatí a Histra token se nikdy neposílá přes cizí server.
//
// Autentizace: stejná jako u zbytku tvého backendu (x-api-key = API_SECRET
// env proměnná). Histra token appka posílá zvlášť v hlavičce x-histra-token.
//
// Podporuje GET (čtení/sync) a POST/DELETE (zrcadlení přidání/odebrání
// položek do seznamů a watchlistu v Histře).
//
// Pojistka: volání histra.net má pevný timeout — když Histra neodpovídá, funkce
// nezůstane viset do limitu (dřív zbytečně pálila Active CPU / čas a končila timeoutem).
// -------------------------------------------------------------------------
const { checkAuth } = require('../lib/auth');
const { applyCors } = require('../lib/cors');

const UPSTREAM_TIMEOUT_MS = 12000;

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!checkAuth(req, res)) return;

  const histraToken = req.headers['x-histra-token'];
  if (!histraToken) {
    return res.status(400).json({ error: 'Chybí x-histra-token hlavička.' });
  }

  const path = req.query.path;
  if (!path || typeof path !== 'string' || !path.startsWith('/api/v1/')) {
    return res.status(400).json({ error: 'Chybí nebo neplatný parametr ?path= (musí začínat /api/v1/).' });
  }

  const method = req.method;
  if (!['GET', 'POST', 'DELETE'].includes(method)) {
    return res.status(405).json({ error: 'Metoda není povolena.' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const init = { method, signal: ctrl.signal, headers: { 'Authorization': `Bearer ${histraToken}`, 'Accept': 'application/json' } };
    if (method !== 'GET' && req.body !== undefined && req.body !== null && req.body !== '') {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    const upstream = await fetch(`https://histra.net${path}`, init);
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    return res.status(upstream.status).json(data);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      return res.status(504).json({ error: `histra.net neodpovědělo do ${UPSTREAM_TIMEOUT_MS / 1000} s.` });
    }
    return res.status(502).json({ error: 'Nepodařilo se spojit s histra.net: ' + (e && e.message ? e.message : String(e)) });
  } finally {
    clearTimeout(timer);
  }
};
