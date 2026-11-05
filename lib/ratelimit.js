// Jednoduchý rate limiter v paměti instance (bez Redis → žádné další příkazy ani latence).
// Fluid compute drží instance při životě a obsluhuje na nich víc požadavků, takže limit
// funguje jako ochrana proti zacyklenému klientovi / botovi, který by jinak vyčerpal Active CPU.
// Není to přesný globální limit (každá instance počítá zvlášť), ale na pojistku stačí.
const buckets = new Map();
let lastSweep = 0;

function clientId(req) {
  const xf = req.headers['x-forwarded-for'];
  const ip = (typeof xf === 'string' ? xf.split(',')[0].trim() : '') || (req.socket && req.socket.remoteAddress) || '?';
  return ip + '|' + String(req.headers['x-api-key'] || '').slice(0, 8);
}

// Vrací true, pokud je klient přes limit (odpověď 429 už je odeslaná → handler má skončit).
function rateLimit(req, res, { limit = 150, windowMs = 10000, name = 'api' } = {}) {
  const now = Date.now();
  if (now - lastSweep > 60000 || buckets.size > 5000) { // úklid starých záznamů
    lastSweep = now;
    for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    if (buckets.size > 5000) buckets.clear();
  }
  const key = name + '|' + clientId(req);
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  if (b.count > limit) {
    const retry = Math.max(1, Math.ceil((b.reset - now) / 1000));
    res.setHeader('Retry-After', String(retry));
    res.status(429).json({ error: 'Příliš mnoho požadavků, zkus to za chvíli.', retry_after: retry });
    return true;
  }
  return false;
}

module.exports = { rateLimit };
