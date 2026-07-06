const http = require('http');

const products = [
  { id: 1, name: 'Wireless Mouse',      category: 'Electronics', price: 499,  inStock: true,  rating: 4.5 },
  { id: 2, name: 'Mechanical Keyboard', category: 'Electronics', price: 2999, inStock: true,  rating: 4.8 },
  { id: 3, name: 'USB-C Hub',           category: 'Electronics', price: 1299, inStock: false, rating: 4.2 },
  { id: 4, name: 'Desk Lamp',           category: 'Furniture',   price: 799,  inStock: true,  rating: 3.9 },
  { id: 5, name: 'Monitor Stand',       category: 'Furniture',   price: 1499, inStock: true,  rating: 4.6 },
  { id: 6, name: 'Webcam HD',           category: 'Electronics', price: 3499, inStock: true,  rating: 4.3 },
  { id: 7, name: 'Laptop Sleeve',       category: 'Accessories', price: 599,  inStock: true,  rating: 4.1 },
  { id: 8, name: 'Ergonomic Chair',     category: 'Furniture',   price: 8999, inStock: false, rating: 4.7 },
];

function applyFilters(data, filters, sort) {
  filters = filters || {};
  sort = sort || {};
  var r = data.slice();

  if (filters.category) {
    var cats = Array.isArray(filters.category) ? filters.category : [filters.category];
    r = r.filter(function(p) { return cats.indexOf(p.category) !== -1; });
  }
  if (filters.price) {
    if (filters.price.min !== undefined) r = r.filter(function(p) { return p.price >= filters.price.min; });
    if (filters.price.max !== undefined) r = r.filter(function(p) { return p.price <= filters.price.max; });
  }
  if (filters.inStock !== undefined) {
    r = r.filter(function(p) { return p.inStock === filters.inStock; });
  }
  if (filters.minRating !== undefined) {
    r = r.filter(function(p) { return p.rating >= filters.minRating; });
  }
  if (sort.field) {
    var field = sort.field;
    var dir = sort.order === 'desc' ? -1 : 1;
    r.sort(function(a, b) { return a[field] > b[field] ? dir : -dir; });
  }
  return r;
}

function parseBody(req) {
  return new Promise(function(resolve) {
    var raw = '';
    req.on('data', function(chunk) { raw += chunk; });
    req.on('end', function() {
      // Strip BOM if present
      raw = raw.replace(/^\uFEFF/, '').trim();
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch(e) {
        console.error('JSON parse error:', e.message);
        console.error('Raw body was:', JSON.stringify(raw));
        resolve({});
      }
    });
  });
}

function send(res, status, body, extraHeaders) {
  var headers = {
    'Content-Type': 'application/json',
    'Accept-Query': 'application/json'
  };
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k]; });
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body, null, 2));
}

var server = http.createServer(function(req, res) {
  parseBody(req).then(function(body) {
    var method = req.method.toUpperCase();
    var url = req.url;
    console.log('\n--> ' + method + ' ' + url);

    // OLD HACK: POST /products/search
    if (method === 'POST' && url === '/products/search') {
      var result = applyFilters(products, body.filter, body.sort);
      console.log('    OLD HACK: no Cache-Control sent');
      return send(res, 200, {
        _method: 'POST',
        _note: 'OLD HACK - Not cacheable. No Cache-Control header.',
        count: result.length,
        data: result
      });
    }

    // NEW WAY: QUERY /products (RFC 10008)
    if (method === 'QUERY' && url === '/products') {
      var result = applyFilters(products, body.filter, body.sort);
      console.log('    RFC 10008: Cache-Control: max-age=60 sent');
      return send(res, 200, {
        _method: 'QUERY',
        _note: 'RFC 10008 - Safe, idempotent, cacheable.',
        count: result.length,
        data: result
      }, { 'Cache-Control': 'max-age=60, private' });
    }

    // Simple GET
    if (method === 'GET' && url === '/products') {
      return send(res, 200, {
        _method: 'GET',
        _note: 'Simple fetch - works for basic queries only',
        count: products.length,
        data: products
      });
    }

    // Root
    if (method === 'GET' && url === '/') {
      return send(res, 200, {
        message: 'HTTP QUERY POC - RFC 10008',
        routes: {
          'GET   /products':        'Simple fetch',
          'POST  /products/search': 'OLD HACK - read-only search abusing POST',
          'QUERY /products':        'NEW WAY - RFC 10008'
        }
      });
    }

    send(res, 404, { error: 'Not found' });
  });
});

process.on('uncaughtException', function(e) {
  console.error('Uncaught error:', e.message);
});

server.listen(3000, function() {
  console.log('HTTP QUERY POC running on http://localhost:3000');
  console.log('Press Ctrl+C to stop\n');
  console.log('Routes:');
  console.log('  GET   http://localhost:3000/products');
  console.log('  POST  http://localhost:3000/products/search');
  console.log('  QUERY http://localhost:3000/products');
});
