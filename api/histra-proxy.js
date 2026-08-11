
// api/histra-proxy.js
// -------------------------------------------------------------------------
// Proxy endpoint pro histra.net API, aby šlo volat z prohlížeče (Histra API
// nemá CORS hlavičky pro volání z webu — je dělané pro appky jako Kodi/Jellyfin).
// Tenhle soubor běží na TVÉM sinator-backend (Vercel), takže žádné CORS
// omezení neplatí a Histra token se nikdy neposílá přes cizí server.
//
// Nasazení:
//   1. Zkopíruj tento soubor do svého repa sinator-backend jako api/histra-proxy.js
//      (stejná složka jako ostatní api/*.js endpointy, např. check-source.js)
//   2. Deploy (git push, Vercel to nasadí samo)
//   3. Hotovo — index.html už na tento endpoint volá automaticky.
//
// Autentizace: stejná jako u zbytku tvého backendu (x-api-key = API_SECRET
// env proměnná). Histra token appka posílá zvlášť v hlavičce x-histra-token.
// -------------------------------------------------------------------------

export default async function handler(req, res) {
    // CORS pro tvou vlastní doménu (Vercel to servíruje ze stejné domény jako
    // zbytek backendu, ale pro jistotu při lokálním vývoji povolíme *)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-histra-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // Stejná autentizace jako zbytek backendu
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_SECRET) {
        return res.status(401).json({ error: 'Neplatný nebo chybějící x-api-key.' });
    }

    const histraToken = req.headers['x-histra-token'];
    if (!histraToken) {
        return res.status(400).json({ error: 'Chybí x-histra-token hlavička.' });
    }

    const path = req.query.path;
    if (!path || typeof path !== 'string' || !path.startsWith('/api/v1/')) {
        return res.status(400).json({ error: 'Chybí nebo neplatný parametr ?path= (musí začínat /api/v1/).' });
    }

    // Jen GET a POST/DELETE by šly rozšířit později, zatím appka volá jen GET
    // na Histra (auth/me, catalog/lookup, tracking/history, watchlist, lists).
    try {
        const upstream = await fetch(`https://histra.net${path}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${histraToken}` }
        });
        const text = await upstream.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        return res.status(upstream.status).json(data);
    } catch (e) {
        return res.status(502).json({ error: 'Nepodařilo se spojit s histra.net: ' + (e && e.message ? e.message : String(e)) });
    }
}
