#!/bin/bash

# HTTP QUERY Method POC — Test Script
# Start server first: node server.js

BASE="http://localhost:3000"
DIVIDER="────────────────────────────────────────────────────────"

echo ""
echo "$DIVIDER"
echo "  HTTP QUERY Method POC — RFC 10008"
echo "$DIVIDER"

# ─── 1. OLD WAY: GET with query string ───────────────────────────────────────
echo ""
echo "1️  OLD WAY: GET /products?category=Electronics"
echo "   Works for simple filters. Breaks fast with complex ones."
echo "   Try adding nested price range + sort + pagination — URL becomes unreadable."
echo ""
curl -s -X GET "$BASE/products?category=Electronics" \
  | python3 -m json.tool 2>/dev/null | head -20
echo "..."

echo ""
echo "$DIVIDER"

# ─── 2. OLD HACK: POST /products/search ──────────────────────────────────────
echo ""
echo "2️  OLD HACK: POST /products/search"
echo "   The most common real-world workaround."
echo "   Problem: POST is not safe or idempotent."
echo "   CDNs and caches treat this as 'might change state' — won't cache it."
echo ""
curl -s -X POST "$BASE/products/search" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "category": ["Electronics", "Accessories"],
      "price": { "min": 500, "max": 3000 },
      "inStock": true,
      "minRating": 4.0
    },
    "sort": { "field": "price", "order": "asc" },
    "pagination": { "page": 1, "limit": 5 }
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "$DIVIDER"

# ─── 3. NEW WAY: QUERY /products (RFC 10008) ─────────────────────────────────
echo ""
echo "3️  NEW WAY: QUERY /products (RFC 10008)"
echo "   Safe + idempotent like GET. Body support like POST."
echo "   CDNs can now cache this correctly."
echo "   Notice Cache-Control header in the response."
echo ""
curl -s -X QUERY "$BASE/products" \
  -H "Content-Type: application/json" \
  -D - \
  -d '{
    "filter": {
      "category": ["Electronics", "Accessories"],
      "price": { "min": 500, "max": 3000 },
      "inStock": true,
      "minRating": 4.0
    },
    "sort": { "field": "rating", "order": "desc" },
    "pagination": { "page": 1, "limit": 5 }
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "$DIVIDER"
echo ""
echo "Key difference:"
echo "  POST response → No Cache-Control (caches treat as mutation)"
echo "  QUERY response → Cache-Control: max-age=60 (caches know it's safe)"
echo ""
echo "Same complex filter. Same result. Completely different protocol semantics."
echo ""
