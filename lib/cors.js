// Povolí appce na jiné doméně (např. projekt-sinatorsearch.vercel.app)
// volat tenhle backend. Bez těchto hlaviček prohlížeč fetch rovnou
// zablokuje s "Failed to fetch" (CORS), ještě než appka uvidí odpověď.
function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, If-None-Match');
  // Prohlížeč si preflight (OPTIONS) zapamatuje — bez toho se každý GET/POST volal 2× (= 2 invokace).
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // preflight vyřízen, handler má skončit
  }
  return false;
}

module.exports = { applyCors };
