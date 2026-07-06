# http-query-poc

A small POC I built alongside a LinkedIn post about RFC 10008 — the new HTTP QUERY method standardised in June 2026.

No npm install. No dependencies. Just Node.js.

---

## Why I built this

Every API I've worked on eventually grows a `POST /search` endpoint. Not because POST is the right choice — but because GET can't carry a body, and complex filters stop fitting in a URL pretty fast.

RFC 10008 fixes this properly. QUERY is safe and idempotent like GET, but carries a body like POST. CDNs can now cache it correctly.

I wanted to see it work, so I built this.

---

## The three approaches, side by side

**GET** — fine for simple queries, breaks with anything complex
```
GET /products?category=Electronics&price_min=500&price_max=3000&inStock=true
```

**POST /search** — what most teams end up doing, but semantically wrong
```
POST /products/search
{ "filter": { "category": [...], "price": {...} } }
```
CDNs treat POST as a potential mutation. No caching. Retry logic gets complicated.

**QUERY** — RFC 10008, June 2026
```
QUERY /products
{ "filter": { "category": [...], "price": {...} } }
```
Same body as POST. Safe and idempotent like GET. Cache-Control header works correctly.

---

## Run it

```bash
node server.js
```

**Mac/Linux — test with:**
```bash
chmod +x test.sh && ./test.sh
```

**Windows — test with:**
```powershell
# Create filter file first
[System.IO.File]::WriteAllText("$PWD\filter.json", '{"filter":{"category":["Electronics"],"price":{"min":500,"max":3000},"inStock":true},"sort":{"field":"rating","order":"desc"}}')

# POST (old hack) — notice no Cache-Control in response
curl.exe -X POST http://localhost:3000/products/search -H "Content-Type: application/json" --data-binary "@filter.json"

# QUERY (RFC 10008) — notice Cache-Control: max-age=60 in response headers
curl.exe -X QUERY http://localhost:3000/products -H "Content-Type: application/json" -D - --data-binary "@filter.json"
```

The `-D -` flag prints response headers — that's where you'll see the difference.

---

## What to look for

POST response — no Cache-Control:
```
Content-Type: application/json
Accept-Query: application/json
```

QUERY response — cacheable:
```
Content-Type: application/json
Accept-Query: application/json
Cache-Control: max-age=60, private
```

Same filter. Same result. Different protocol semantics.

---

## Support as of July 2026

| | Status |
|---|---|
| Node.js | Native — parses QUERY without any config |
| curl | Works with `-X QUERY` |
| .NET 10 | First-class support |
| Spring (Java) | PR open, not merged yet |
| OpenAPI 3.2 | Can document it |
| Browsers | Works, but triggers CORS preflight |
| CDNs | Cloudflare and Akamai co-authored the RFC — support coming |

---

## Should you use this in production?

Not yet, unless you're adding it alongside an existing POST endpoint. Some proxies and corporate firewalls with method allowlists will reject unfamiliar HTTP methods. Sensible approach:

- Keep `POST /search` running
- Add `QUERY /products` alongside it
- Advertise support via the `Accept-Query` response header
- Let clients migrate as tooling catches up

---

Built by [Suvendu Giri](https://suvendugiri.com) — Fractional CTO
