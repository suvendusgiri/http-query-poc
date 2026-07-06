/**
 * HTTP QUERY Method — POC
 * RFC 10008 — Standardised June 2026
 * 
 * Run: node server.js
 * Then test with curl commands in test.sh
 * 
 * Scenario: Product search API with complex filters
 * Before: POST /products/search (the old hack)
 * After:  QUERY /products       (the right way)
 */

const http = require('http');

// ─── Sample Data ──────────────────────────────────────────────────────────────
const products = [
  { id: 1, name: 'Wireless Mouse',     category: 'Electronics', price: 499,  inStock: true,  rating: 4.5 },
  { id: 2, name: 'Mechanical Keyboard',category: 'Electronics', price: 2999, inStock: true,  rating: 4.8 },
  { id: 3, name: 'USB-C Hub',          category: 'Electronics', price: 1299, inStock: false, rating: 4.2 },
  { id: 4, name: 'Desk Lamp',          category: 'Furniture',   price: 799,  inStock: true,  rating: 3.9 },
  { id: 5, name: 'Monitor Stand',      category: 'Furniture',   price: 1499, inStock: true,  rating: 4.6 },
  { id: 6, name: 'Webcam HD',          category: 'Electronics', price: 3499, inStock: true,  rating: 4.3 },
  { id: 7, name: 'Laptop Sleeve',      category: 'Accessories', price: 599,  inStock: true,  rating: 4.1 },
  { id: 8, name: 'Ergonomic Chair',    category: 'Furniture',   price: 8999, inStock: false, rating: 4.7 },
];

// ─── Filter Engine (shared by both endpoints) ─────────────────────────────────
function applyFilters(data, filters = {}, sort = {}, pagination = {}) {
  let result = [...data];

  // Filter by category (array support)
  if (filters.category) {
    const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
    result = result.filter(p => cats.includes(p.category));
  }

  // Filter by price range
  if (filters.price) {
    if (filters.price.min !== undefined) result = result.filter(p => p.price >= filters.price.min);
    if (filters.price.max !== undefined) result = result.filter(p => p.price <= filters.price.max);
  }

  // Filter by stock
  if (filters.inStock !== undefined) {
    result = result.filter(p => p.inStock === filters.inStock);
  }

  // Filter by minimum rating
  if (filters.minRating !== undefined) {
    result = result.filter(p => p.rating >= filters.minRating);
  }

  // Sort
  if (sort.field) {
    result.sort((a, b) => {
      const dir = sort.order === 'desc' ? -1 : 1;
      return a[sort.field] > b[sort.field] ? dir : -dir;
    });
  }

  // Pagination
  const page  = pagination.page  || 1;
  const limit = pagination.limit || 10;
  const start = (page - 1) * limit;

  return {
    data:  result.slice(start, start + limit),
    total: result.length,
    page,
    limit,
  };
}

// ─── Parse request body ────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(e); }
    });
  });
}

// ─── Send JSON response ────────────────────────────────────────────────────────
function send(res, status, body, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    // RFC 10008: servers advertise QUERY support via Accept-Query header
    'Accept-Query': 'application/json',
    ...extra,
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body, null, 2));
}

// ─── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = req.url;
  const method = req.method.toUpperCase();

  console.log(`\n→ ${method} ${url}`);

  // ── BEFORE: The old hack ───────────────────────────────────────────────────
  // POST /products/search
  // Problem: POST implies mutation. Caches & CDNs won't cache this.
  //          Retry logic is unsafe. Semantically wrong.
  if (method === 'POST' && url === '/products/search') {
    const body = await parseBody(req);
    const result = applyFilters(
      products,
      body.filter     || {},
      body.sort       || {},
      body.pagination || {}
    );
    console.log('  [OLD WAY] POST /products/search — works, but not cacheable or idempotent');
    return send(res, 200, {
      _note: 'OLD WAY: POST used for a read-only search. Not cacheable. Not idempotent.',
      ...result
    });
  }

  // ── AFTER: The right way ──────────────────────────────────────────────────
  // QUERY /products
  // Safe + idempotent (like GET) + body support (like POST)
  // CDNs and proxies can now cache this response correctly.
  if (method === 'QUERY' && url === '/products') {
    const body = await parseBody(req);
    const result = applyFilters(
      products,
      body.filter     || {},
      body.sort       || {},
      body.pagination || {}
    );
    console.log('  [NEW WAY] QUERY /products — safe, idempotent, cacheable per RFC 10008');
    return send(res, 200, {
      _note: 'NEW WAY: QUERY — safe, idempotent, cacheable. Body carries complex filters.',
      ...result
    }, {
      // Server can cache QUERY responses — this is what was impossible with POST
      'Cache-Control': 'max-age=60, private',
    });
  }

  // ── Simple GET for comparison ─────────────────────────────────────────────
  // Works fine for simple queries — but breaks with complex nested filters
  if (method === 'GET' && url.startsWith('/products')) {
    console.log('  [GET] Works for simple queries, breaks with complex filters (URL length)');
    return send(res, 200, {
      _note: 'GET works, but try adding 10+ nested filters. URL becomes unmanageable.',
      data: products,
      total: products.length,
    });
  }

  // ── Root: show available routes ───────────────────────────────────────────
  if (method === 'GET' && url === '/') {
    return send(res, 200, {
      message: 'HTTP QUERY Method POC — RFC 10008',
      routes: {
        'GET    /products':        'Simple fetch — works for basic queries',
        'POST   /products/search': 'OLD WAY — read-only search abusing POST',
        'QUERY  /products':        'NEW WAY — RFC 10008 compliant search with body',
      },
      testWith: 'See test.sh for curl commands',
    });
  }

  send(res, 404, { error: 'Not found' });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\nHTTP QUERY POC running on http://localhost:${PORT}`);
  console.log('Run test.sh to see all three approaches side by side\n');
});
