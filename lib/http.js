const crypto = require('crypto');

// Pošle už hotový JSON řetězec s ETagem. Když klient pošle If-None-Match se stejným
// ETagem, vrátí se 304 bez těla (šetří Fast Origin Transfer). `private` = nikdy
// se nesdílí přes CDN (odpověď závisí na x-api-key). Krátké max-age drží data
// v prohlížeči; appka po každém zápisu cache obchází (cache: 'reload').
function sendJsonString(req, res, json, extraHeaders = {}) {
  const etag = '"' + crypto.createHash('md5').update(json).digest('base64url') + '"';
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
  res.setHeader('Vary', 'x-api-key');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, X-Pagination-Item-Count, X-Pagination-Page-Count');
  for (const k of Object.keys(extraHeaders)) res.setHeader(k, extraHeaders[k]);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).send(json);
}

module.exports = { sendJsonString };
