# HTTP QUERY Method — POC
### RFC 10008 — Standardised June 2026

A practical demonstration of the new HTTP QUERY method alongside the two workarounds developers used before it existed.

---

## The Problem

Every API developer eventually hits this wall.

You need a search endpoint with complex filters — nested conditions, price ranges, multiple categories, sorting, pagination. You have two bad options:

**Option 1: Stuff it in GET**
```
GET /products?category=Electronics&category=Accessories&price_min=500&price_max=3000&inStock=true&minRating=4.0&sort=rating&order=desc&page=1&limit=5
```
Works for simple filters. Breaks fast. URLs hit character limits. Nested objects become unreadable.

**Option 2: Abuse POST**
```http
POST /products/search
Content-Type: application/json

{ "filter": { "category": [...], "price": {...} }, "sort": {...} }
```
Carries a body — great. But POST signals "this might change state". CDNs won't cache it. Retry logic is unsafe. Semantically wrong.

**Option 3: QUERY (RFC 10008)**
```http
QUERY /products
Content-Type: application/json

{ "filter": { "category": [...], "price": {...} }, "sort": {...} }
```
Safe and idempotent like GET. Body support like POST. CDNs can cache it correctly.

---

## Run It

```bash
# Start server (no dependencies — pure Node.js)
node server.js

# In another terminal, run all three approaches
chmod +x test.sh
./test.sh
```

---

## What You'll See

| Approach | Method | URL | Cacheable | Body | Idempotent |
|---|---|---|---|---|---|
| Simple fetch | GET | /products | ✅ | ❌ | ✅ |
| Old hack | POST | /products/search | ❌ | ✅ | ❌ |
| RFC 10008 | QUERY | /products | ✅ | ✅ | ✅ |

---

## Current Support (July 2026)

| Environment | Status |
|---|---|
| Node.js (http module) | ✅ Native — parses QUERY like any custom method |
| Express.js | ✅ via `app.use()` middleware (no native `app.query()` yet) |
| curl | ✅ `-X QUERY` works |
| .NET 10 | ✅ First-class support |
| Spring (Java) | 🟡 PR open, not merged yet |
| OpenAPI 3.2 | ✅ Can document it |
| Browsers (fetch) | 🟡 Works but triggers CORS preflight |
| CDN caching | 🟡 Cloudflare/Akamai (co-authored RFC) — support arriving |

---

## The Honest Take

Don't rush to production with QUERY today. Some proxies and corporate firewalls with method allowlists will reject it. A sensible rollout:

1. Keep your existing POST /search endpoint running
2. Add QUERY /products alongside it
3. Advertise support via `Accept-Query` response header
4. Let clients migrate as their tooling catches up

---

*Built as a companion to a LinkedIn post by Suvendu Giri — suvendugiri.com*
