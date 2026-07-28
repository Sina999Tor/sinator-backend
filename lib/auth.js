// Jednoduché ověření jedním tajným klíčem — appka ho posílá v hlavičce
// 'x-api-key'. Žádné OAuth, žádné uživatelské účty (backend je jen pro tebe).
function checkAuth(req, res) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_SECRET) {
    res.status(401).json({ error: 'Neplatný nebo chybějící x-api-key.' });
    return false;
  }
  return true;
}

module.exports = { checkAuth };
