// Povolí appce na jiné doméně (např. projekt-sinatorsearch.vercel.app)
// volat tenhle backend. Bez těchto hlaviček prohlížeč fetch rovnou
// zablokuje s "Failed to fetch" (CORS), ještě než appka uvidí odpověď.
const { rateLimit } = require('./ratelimit');

// Vrací true, když je požadavek už vyřízený (preflight OPTIONS, nebo přes rate limit) → handler má skončit.
function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-histra-token, If-None-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Retry-After, X-Pagination-Item-Count, X-Pagination-Page-Count');
  // Prohlížeč si preflight (OPTIONS) zapamatuje — bez toho se každý GET/POST volal 2× (= 2 invokace).
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // preflight vyřízen, handler má skončit
  }
  // Ochrana proti zacyklenému klientovi / botům: víc než X požadavků za 10 s z jedné adresy → 429.
  // Náročné jednorázové endpointy (import, úklid historie) mají limit přísnější.
  const heavy = /\/api\/(import|history-cleanup)/.test(req.url || '');
  if (rateLimit(req, res, heavy ? { limit: 20, name: 'heavy' } : { limit: 150, name: 'api' })) return true;
  return false;
}

module.exports = { applyCors };
