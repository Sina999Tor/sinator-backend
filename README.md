# sinator-backend

Vlastní, jednoduchý náhradník za Trakt API — jen pro tebe, bez cizích výpadků.
Postavený na Vercel serverless funkcích + Upstash Redis (free tier stačí).

## Co to umí

| Endpoint | Metody | K čemu |
|---|---|---|
| `/api/watchlist` | GET, POST, DELETE | Watchlist filmů/seriálů |
| `/api/lists` | GET, POST | Seznam vlastních seznamů |
| `/api/lists/:id` | DELETE, PATCH | Smazat / přejmenovat seznam |
| `/api/lists/:id/items` | GET, POST, DELETE | Položky v konkrétním seznamu |
| `/api/ratings?type=movies\|shows` | GET, POST, DELETE | Hodnocení |
| `/api/history?type=movies\|episodes&page=&limit=` | GET, POST | Historie sledování (s časem) |
| `/api/progress?type=movies\|shows` | GET, POST, DELETE | Rozkoukanost |

Všechny endpointy (kromě GET s query parametry) čekají JSON tělo a hlavičku:
```
x-api-key: <tvůj API_SECRET>
```

## Nasazení (5 minut)

1. **Vytvoř nový GitHub repo** (např. `sinator-backend`) a nahraj do něj tenhle obsah.
2. Na [vercel.com](https://vercel.com) → **Add New Project** → vyber ten repo → Deploy.
   (Není potřeba žádná build konfigurace, Vercel pozná Node.js API routes automaticky.)
3. V projektu na Vercelu: **Storage** → **Browse Marketplace** → **Upstash** → **Redis** →
   vytvoř databázi a připoj ji k projektu. Vercel sám doplní `UPSTASH_REDIS_REST_URL`
   a `UPSTASH_REDIS_REST_TOKEN` do Environment Variables.
4. V **Settings → Environment Variables** přidej ještě `API_SECRET` — libovolný dlouhý
   náhodný řetězec (v terminálu: `openssl rand -hex 32`, nebo si ho jen vymysli).
5. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy), ať se nové env proměnné načtou.
6. Appka teď volá `https://sinator-backend.vercel.app/api/...` místo `api.trakt.tv`.

## Jak na to napojit appku (Sinator)

V appce stačí místo volání na `TRAKT_BASE` volat na tvou novou doménu a přidat
hlavičku `x-api-key` místo `Authorization: Bearer`. Např. místo:

```js
fetch(`${TRAKT_BASE}/sync/watchlist`, { headers: getTraktHeaders() })
```

by bylo:

```js
const MY_BASE = 'https://sinator-backend.vercel.app/api';
const MY_KEY = 'tvůj-API_SECRET';
fetch(`${MY_BASE}/watchlist`, { headers: { 'x-api-key': MY_KEY } })
```

Datové tvary (JSON) jsou schválně podobné Traktu (`rating`, `rated_at`, `progress`,
`paused_at`, `watched_at`), takže úpravy v appce budou většinou jen o přepsání URL
a hlaviček — ne o přepisování logiky, co appka s daty dělá.

## Příklady požadavků

**Přidat film do watchlistu:**
```
POST /api/watchlist
{ "id": 603, "type": "movie", "title": "Matrix", "year": 1999 }
```

**Ohodnotit seriál 9/10:**
```
POST /api/ratings
{ "id": 1399, "type": "shows", "rating": 9 }
```

**Zaznamenat zhlédnutí epizody:**
```
POST /api/history
{ "id": 1399, "type": "episodes", "season": 1, "episode": 3 }
```

**Uložit rozkoukanost filmu na 42 %:**
```
POST /api/progress
{ "id": 603, "type": "movie", "progress": 42 }
```

## Poznámky

- Žádné OAuth ani uživatelské účty — backend je jen pro tebe, chrání ho jediný klíč.
- Pokud budeš chtít appku používat z víc zařízení současně, funguje to bez problému —
  všechna zařízení jen sdílí stejný `API_SECRET` a stejnou Redis databázi.
- Historie používá Redis sorted set, takže stránkování (`page`/`limit`) je rychlé
  i při tisících záznamů.
- Chceš-li si data zálohovat, stačí občas stáhnout obsah přes Upstash konzoli
  (mají webové rozhraní na procházení klíčů) — je to čitelný JSON.
