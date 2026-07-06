# HTTP QUERY Method POC — Windows PowerShell Test Script
# RFC 10008 — Standardised June 2026
#
# HOW TO USE:
# 1. Open a terminal, run: node server.js
# 2. Open a SECOND terminal, run: .\test.ps1

$BASE = "http://localhost:3000"
$DIVIDER = "─" * 60

$payload = @{
    filter = @{
        category = @("Electronics")
        price    = @{ min = 500; max = 3000 }
        inStock  = $true
    }
    sort = @{ field = "rating"; order = "desc" }
} | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host $DIVIDER
Write-Host "  HTTP QUERY Method POC — RFC 10008"
Write-Host $DIVIDER

# ── 1. OLD WAY: GET ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "1. OLD WAY: GET /products"
Write-Host "   Simple fetch — works for basic queries only"
Write-Host ""
try {
    $r = Invoke-WebRequest -Uri "$BASE/products" -Method GET
    Write-Host "   Status: $($r.StatusCode)"
    Write-Host "   Cache-Control: $($r.Headers['Cache-Control'] ?? '(none)')"
    $r.Content | ConvertFrom-Json | Select-Object -ExpandProperty _note | Write-Host
} catch {
    Write-Host "   Error: $_"
}

Write-Host ""
Write-Host $DIVIDER

# ── 2. OLD HACK: POST /products/search ───────────────────────────────────────
Write-Host ""
Write-Host "2. OLD HACK: POST /products/search"
Write-Host "   Read-only search abusing POST — the most common real-world workaround"
Write-Host "   Problem: Not cacheable. Not idempotent."
Write-Host ""
try {
    $r = Invoke-WebRequest -Uri "$BASE/products/search" `
         -Method POST `
         -ContentType "application/json" `
         -Body $payload
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Status       : $($r.StatusCode)"
    Write-Host "   Cache-Control: $($r.Headers['Cache-Control'] ?? '(none — CDN will NOT cache this)')"
    Write-Host "   Note         : $($json._note)"
    Write-Host "   Results      : $($json.count) product(s) found"
    $json.data | ForEach-Object {
        Write-Host "     - $($_.name) | $$($_.price) | Rating: $($_.rating)"
    }
} catch {
    Write-Host "   Error: $_"
}

Write-Host ""
Write-Host $DIVIDER

# ── 3. NEW WAY: QUERY /products (RFC 10008) ───────────────────────────────────
Write-Host ""
Write-Host "3. NEW WAY: QUERY /products  (RFC 10008)"
Write-Host "   Safe + idempotent like GET. Body support like POST."
Write-Host "   CDNs can now cache this correctly."
Write-Host ""
try {
    $r = Invoke-WebRequest -Uri "$BASE/products" `
         -Method QUERY `
         -ContentType "application/json" `
         -Body $payload
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Status       : $($r.StatusCode)"
    Write-Host "   Cache-Control: $($r.Headers['Cache-Control'] ?? '(none)')"
    Write-Host "   Accept-Query : $($r.Headers['Accept-Query'] ?? '(none)')"
    Write-Host "   Note         : $($json._note)"
    Write-Host "   Results      : $($json.count) product(s) found"
    $json.data | ForEach-Object {
        Write-Host "     - $($_.name) | $$($_.price) | Rating: $($_.rating)"
    }
} catch {
    Write-Host "   Error: $_"
    Write-Host ""
    Write-Host "   NOTE: Some older versions of Invoke-WebRequest may reject"
    Write-Host "   non-standard methods. Try curl instead (see below)."
}

Write-Host ""
Write-Host $DIVIDER
Write-Host ""
Write-Host "KEY DIFFERENCE:"
Write-Host "  POST  response → No Cache-Control (caches assume mutation)"
Write-Host "  QUERY response → Cache-Control: max-age=60 (caches know it's safe)"
Write-Host ""
Write-Host "Same filter payload. Same results. Completely different protocol semantics."
Write-Host ""

# ── Fallback: curl commands if Invoke-WebRequest fails ────────────────────────
Write-Host $DIVIDER
Write-Host "FALLBACK — If QUERY method fails above, use these curl commands:"
Write-Host "(curl ships with Windows 10/11 by default)"
Write-Host ""
Write-Host 'curl -X POST http://localhost:3000/products/search -H "Content-Type: application/json" -d "{\"filter\":{\"category\":[\"Electronics\"],\"price\":{\"min\":500,\"max\":3000},\"inStock\":true},\"sort\":{\"field\":\"price\",\"order\":\"asc\"}}"'
Write-Host ""
Write-Host 'curl -X QUERY http://localhost:3000/products -H "Content-Type: application/json" -D - -d "{\"filter\":{\"category\":[\"Electronics\"],\"price\":{\"min\":500,\"max\":3000},\"inStock\":true},\"sort\":{\"field\":\"rating\",\"order\":\"desc\"}}"'
Write-Host ""
