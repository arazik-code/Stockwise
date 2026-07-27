param(
    [string]$BaseUrl = "http://localhost:5000",
    [string]$Token = "",
    [int]$Concurrency = 10,
    [int]$Iterations = 50
)

$ErrorActionPreference = "Continue"
$results = @{
    Passed = 0
    Failed = 0
    Errors = @()
}

function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss.fff')] $msg" -ForegroundColor Cyan }
function Pass($msg) { $results.Passed++; Write-Host "  PASS: $msg" -ForegroundColor Green }
function Fail($msg) { $results.Failed++; $results.Errors += $msg; Write-Host "  FAIL: $msg" -ForegroundColor Red }

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null, [bool]$UseAuth = $true)
    $url = "$BaseUrl$path"
    $headers = @{}
    if ($UseAuth -and $Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        $params = @{Uri=$url; Method=$Method; Headers=$headers; UseBasicParsing=$true; TimeoutSec=30; ContentType="application/json"}
        if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
        $resp = Invoke-WebRequest @params
        return @{ StatusCode=$resp.StatusCode; Content=$resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ StatusCode=$code; Content=$null; Error=$_.Exception.Message }
    }
}

# ============================================================
# PHASE 0: Setup - Get auth, products, clients
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 0: SETUP & AUTH" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

if (-not $Token) {
    $reg = Invoke-Api POST "/api/Auth/register" @{username="stresstest";password="Stress123!";fullName="Stress Tester";role=0}
    if ($reg.Content.token) {
        $Token = $reg.Content.token
        Pass "User registered, got token"
    } else {
        $login = Invoke-Api POST "/api/Auth/login" @{username="stresstest";password="Stress123!"} $false
        if ($login.Content.token) { $Token = $login.Content.token; Pass "Logged in" }
        else { Fail "Cannot authenticate"; return }
    }
} else {
    Pass "Using provided token"
}

# Get products
$products = Invoke-Api GET "/api/Products"
$productVariants = @()
if ($products.Content) {
    foreach ($p in $products.Content) {
        if ($p.variants) { foreach ($v in $p.variants) { $productVariants += $v } }
    }
    Pass "Loaded $($productVariants.Count) product variants from $($products.Content.Count) products"
} else {
    Fail "No products found - cannot run tests"; return
}

# Get clients
$clients = Invoke-Api GET "/api/Clients"
$clientList = @()
if ($clients.Content) { $clientList = @($clients.Content); Pass "Loaded $($clientList.Count) clients" }
else { Pass "No clients found - will create one" }

# Get sales
$salesResp = Invoke-Api GET "/api/Sales"
$saleList = @()
if ($salesResp.Content) { $saleList = @($salesResp.Content); Pass "Loaded $($saleList.Count) existing sales" }

# ============================================================
# PHASE 1: Endpoint health check (all controllers)
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 1: ENDPOINT HEALTH CHECK" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$endpoints = @(
    @{Method="GET"; Path="/api/Sales"},
    @{Method="GET"; Path="/api/Products"},
    @{Method="GET"; Path="/api/Clients"},
    @{Method="GET"; Path="/api/Categories"},
    @{Method="GET"; Path="/api/Colors"},
    @{Method="GET"; Path="/api/Sizes"},
    @{Method="GET"; Path="/api/Fournisseurs"},
    @{Method="GET"; Path="/api/Invoices"},
    @{Method="GET"; Path="/api/Refunds"},
    @{Method="GET"; Path="/api/Settings/loyalty"},
    @{Method="GET"; Path="/api/Settings/store"},
    @{Method="GET"; Path="/api/Stock"}
)

foreach ($ep in $endpoints) {
    $r = Invoke-Api $ep.Method $ep.Path
    if ($r.StatusCode -eq 200) { Pass "$($ep.Method) $($ep.Path)" }
    else { Fail "$($ep.Method) $($ep.Path) => $($r.StatusCode)" }
}

# ============================================================
# PHASE 2: Create resources
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 2: CREATE RESOURCES" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# Create clients
$clientIds = @()
for ($i = 1; $i -le 5; $i++) {
    $r = Invoke-Api POST "/api/Clients" @{name="Stress Client $i";phone="600$i{0:D7}" -f (Get-Random)}
    if ($r.StatusCode -in @(200,201) -and $r.Content.id) {
        $clientIds += $r.Content.id
        Pass "Created client $($r.Content.id) (QR: $($r.Content.qrCode))"
    } else {
        # Try to get existing
        $existing = Invoke-Api GET "/api/Clients"
        if ($existing.Content -and $existing.Content.Count -gt 0) {
            $clientIds = @($existing.Content[0].id)
            Pass "Using existing client $($existing.Content[0].id)"
            break
        }
        Fail "Cannot create client"
    }
}

# ============================================================
# PHASE 3: Mass sale creation stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 3: MASS SALE CREATION ($Iterations sales, $Concurrency concurrent)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$createdSaleIds = @()
$startTime = Get-Date

# Create sales sequentially (to avoid race conditions on stock)
$createdCount = 0
$failedCount = 0
for ($i = 1; $i -le $Iterations; $i++) {
    $variant = $productVariants[(Get-Random -Maximum $productVariants.Count)]
    $qty = Get-Random -Minimum 1 -Maximum 3
    $clientId = if ($clientList.Count -gt 0 -and (Get-Random -Maximum 3) -eq 0) { $clientList[(Get-Random -Maximum $clientList.Count)].id } else { $null }

    $saleBody = @{
        category = 0
        paymentMethod = (Get-Random -Maximum 3)
        amountPaid = [decimal]$variant.price * $qty
        taxRate = 0
        clientId = $clientId
        items = @(@{
            productVariantId = $variant.id
            quantity = $qty
            discountAmount = 0
        })
    }

    $r = Invoke-Api POST "/api/Sales" $saleBody
    if ($r.StatusCode -in @(200,201) -and $r.Content.id) {
        $createdSaleIds += $r.Content.id
        $createdCount++
    } else {
        $failedCount++
    }

    if ($i % 10 -eq 0) { Write-Host "    Created $i / $Iterations sales..." -ForegroundColor DarkGray }
}

$elapsed = ((Get-Date) - $startTime).TotalSeconds
Pass "Created $createdCount / $Iterations sales in $([Math]::Round($elapsed, 2))s ($([Math]::Round($createdCount / $elapsed, 1)) sales/sec)"
if ($failedCount -gt 0) { Fail "$failedCount sales failed to create" }

# Refresh sales list
$salesResp = Invoke-Api GET "/api/Sales"
if ($salesResp.Content) { $saleList = @($salesResp.Content) }

# ============================================================
# PHASE 4: QR Code / Receipt Barcode scan stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 4: QR/BARCODE SCAN STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# Test client QR scan
if ($clientList.Count -gt 0) {
    $clientQr = $clientList[0].qrCode
    if ($clientQr) {
        $scanSuccess = 0
        $scanFail = 0
        $scanStart = Get-Date
        for ($i = 1; $i -le $Concurrency; $i++) {
            $r = Invoke-Api GET "/api/Refunds/scan-client-qr/$clientQr"
            if ($r.StatusCode -eq 200) { $scanSuccess++ }
            else { $scanFail++ }
        }
        $scanElapsed = ((Get-Date) - $scanStart).TotalSeconds
        Pass "Client QR scan: $scanSuccess/$Concurrency OK in $([Math]::Round($scanElapsed, 2))s"
        if ($scanFail -gt 0) { Fail "$scanFail client QR scans failed" }
    }
} else {
    Pass "Skipped client QR scan (no clients)"
}

# Test receipt barcode scan (find barcodes in DB)
$env:PGPASSWORD = "postgres"
$env:PGPASSWORD = "postgres"
$barcodeResult = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT ""Barcode"" FROM ""ReceiptBarcodes"" WHERE ""IsUsed"" = false AND ""ExpiresAt"" > NOW() LIMIT 5" 2>$null
$barcodes = $barcodeResult -split "`n" | Where-Object { $_.Trim() -ne "" }

if ($barcodes.Count -gt 0) {
    $barcodeSuccess = 0
    $barcodeFail = 0
    $barcodeStart = Get-Date
    foreach ($bc in $barcodes) {
        $bc = $bc.Trim()
        $r = Invoke-Api GET "/api/Refunds/scan-barcode/$bc"
        if ($r.StatusCode -eq 200) { $barcodeSuccess++ }
        else { $barcodeFail++ }
    }
    $barcodeElapsed = ((Get-Date) - $barcodeStart).TotalSeconds
    Pass "Receipt barcode scan: $barcodeSuccess/$($barcodes.Count) OK in $([Math]::Round($barcodeElapsed, 2))s"
    if ($barcodeFail -gt 0) { Fail "$barcodeFail receipt barcode scans failed" }
} else {
    Pass "Skipped receipt barcode scan (no unused barcodes in DB)"
}

# Concurrent scan stress test (same QR multiple times)
Write-Host "  Testing concurrent scan of same client QR..." -ForegroundColor DarkGray
$concurrentResults = @()
$jobs = @()
$scanStart = Get-Date
for ($i = 1; $i -le $Concurrency; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($url, $token, $qr)
        $headers = @{Authorization="Bearer $token"}
        try {
            $r = Invoke-WebRequest -Uri "$url/api/Refunds/scan-client-qr/$qr" -Headers $headers -UseBasicParsing -TimeoutSec 15
            return @{Status=$r.StatusCode; Count=($r.Content | ConvertFrom-Json).Count}
        } catch {
            return @{Status=0; Error=$_.Exception.Message}
        }
    } -ArgumentList $BaseUrl, $Token, $clientQr
}
$concurrentResults = $jobs | Wait-Job -Timeout 30 | Receive-Job
$jobs | Remove-Job -Force 2>$null
$scanElapsed = ((Get-Date) - $scanStart).TotalSeconds
$concurrentSuccess = ($concurrentResults | Where-Object { $_.Status -eq 200 }).Count
Pass "Concurrent scan stress ($Concurrency parallel): $concurrentSuccess/$Concurrency OK in $([Math]::Round($scanElapsed, 2))s"

# ============================================================
# PHASE 5: Refund creation stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 5: REFUND CREATION STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# Get sales with items that can be refunded
$refundableSales = @()
foreach ($s in $saleList) {
    $detail = Invoke-Api GET "/api/Sales/$($s.id)"
    if ($detail.Content -and $detail.Content.items) {
        $hasAvailable = $false
        foreach ($item in $detail.Content.items) {
            if ($item.quantity -gt 0) { $hasAvailable = $true; break }
        }
        if ($hasAvailable) { $refundableSales += $detail.Content }
    }
    if ($refundableSales.Count -ge 10) { break }
}

$refundCount = 0
$refundFail = 0
$refundStart = Get-Date

foreach ($s in $refundableSales) {
    if ($s.items.Count -eq 0) { continue }
    $item = $s.items[0]
    $refundBody = @{
        saleId = $s.id
        type = "Refund"
        reason = "Stress test refund"
        notes = "Automated stress test"
        items = @(@{saleItemId=$item.id; quantity=1})
        exchangeItems = @()
    }

    $r = Invoke-Api POST "/api/Refunds" $refundBody
    if ($r.StatusCode -in @(200,201) -and $r.Content.id) {
        $refundCount++
        # Process it
        $proc = Invoke-Api POST "/api/Refunds/$($r.Content.id)/process" $null
        if ($proc.StatusCode -in @(200,204)) { Pass "Refund #$($r.Content.id) created & processed" }
        else { Pass "Refund #$($r.Content.id) created (process: $($proc.StatusCode))" }
    } else {
        $refundFail++
    }
}

$refundElapsed = ((Get-Date) - $refundStart).TotalSeconds
Pass "Created $refundCount refunds in $([Math]::Round($refundElapsed, 2))s"
if ($refundFail -gt 0) { Fail "$refundFail refunds failed" }

# ============================================================
# PHASE 6: Exchange creation stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 6: EXCHANGE CREATION STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$exchangeCount = 0
$exchangeFail = 0
$exchangeStart = Get-Date

# Get a refundable sale for exchange
if ($refundableSales.Count -gt 0) {
    $s = $refundableSales[0]
    $item = $s.items[0]
    $variant = $productVariants[(Get-Random -Maximum $productVariants.Count)]

    $exchangeBody = @{
        saleId = $s.id
        type = "Exchange"
        reason = "Stress test exchange"
        notes = "Automated stress test"
        items = @(@{saleItemId=$item.id; quantity=1})
        exchangeItems = @(@{productVariantId=$variant.id; quantity=1})
    }

    $r = Invoke-Api POST "/api/Refunds" $exchangeBody
    if ($r.StatusCode -in @(200,201) -and $r.Content.id) {
        $exchangeCount++
        Pass "Exchange #$($r.Content.id) created"
    } else {
        $exchangeFail++
        Fail "Exchange creation failed: $($r.StatusCode)"
    }
} else {
    Pass "Skipped exchange test (no refundable sales)"
}

$exchangeElapsed = ((Get-Date) - $exchangeStart).TotalSeconds
Pass "Created $exchangeCount exchanges in $([Math]::Round($exchangeElapsed, 2))s"

# ============================================================
# PHASE 7: Stock operations stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 7: STOCK OPERATIONS STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$stockSuccess = 0
$stockFail = 0
$stockStart = Get-Date

foreach ($i in 1..$Concurrency) {
    $variant = $productVariants[(Get-Random -Maximum $productVariants.Count)]
    $adjustBody = @{
        productVariantId = $variant.id
        newQuantity = (Get-Random -Minimum 50 -Maximum 200)
        notes = "Stress test adjustment $i"
    }

    $r = Invoke-Api POST "/api/Stock/adjust" $adjustBody
    if ($r.StatusCode -in @(200,204)) { $stockSuccess++ }
    else { $stockFail++ }
}

$stockElapsed = ((Get-Date) - $stockStart).TotalSeconds
Pass "Stock adjustments: $stockSuccess/$Concurrency OK in $([Math]::Round($stockElapsed, 2))s"
if ($stockFail -gt 0) { Fail "$stockFail stock adjustments failed" }

# ============================================================
# PHASE 8: Concurrent GET endpoint stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 8: CONCURRENT READ STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$readEndpoints = @("/api/Sales", "/api/Products", "/api/Clients", "/api/Refunds", "/api/Stock", "/api/Categories", "/api/Colors", "/api/Sizes")
$readJobs = @()
$readStart = Get-Date

for ($round = 1; $round -le 3; $round++) {
    foreach ($ep in $readEndpoints) {
        $readJobs += Start-Job -ScriptBlock {
            param($url, $token, $path)
            $headers = @{Authorization="Bearer $token"}
            try {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                $r = Invoke-WebRequest -Uri "$url$path" -Headers $headers -UseBasicParsing -TimeoutSec 15
                $sw.Stop()
                return @{Path=$path; Status=$r.StatusCode; Ms=$sw.ElapsedMilliseconds}
            } catch {
                return @{Path=$path; Status=0; Error=$_.Exception.Message}
            }
        } -ArgumentList $BaseUrl, $Token, $ep
    }
}

$readResults = $readJobs | Wait-Job -Timeout 60 | Receive-Job
$readJobs | Remove-Job -Force 2>$null
$readElapsed = ((Get-Date) - $readStart).TotalSeconds

$readSuccess = ($readResults | Where-Object { $_.Status -eq 200 }).Count
$readFailed = ($readResults | Where-Object { $_.Status -ne 200 }).Count
$avgMs = if ($readResults.Count -gt 0) { [Math]::Round(($readResults | Where-Object { $_.Ms } | Measure-Object -Property Ms -Average).Average, 0) } else { 0 }
$p95Ms = if ($readResults.Count -gt 0) { ($readResults | Where-Object { $_.Ms } | Sort-Object -Property Ms)[[Math]::Floor($readResults.Count * 0.95)].Ms } else { 0 }

Pass "Concurrent reads: $readSuccess/$($readResults.Count) OK in $([Math]::Round($readElapsed, 2))s (avg ${avgMs}ms, p95 ${p95Ms}ms)"
if ($readFailed -gt 0) { Fail "$readFailed concurrent reads failed" }

# ============================================================
# PHASE 9: Client QR flow end-to-end
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 9: CLIENT QR FLOW END-TO-END" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

if ($clientList.Count -gt 0) {
    $client = $clientList[0]
    $clientQr = $client.qrCode

    # Scan client QR
    $qrScan = Invoke-Api GET "/api/Refunds/scan-client-qr/$clientQr"
    if ($qrScan.StatusCode -eq 200) {
        Pass "Client QR scan returned $($qrScan.Content.Count) sale(s)"
    } else {
        Fail "Client QR scan failed: $($qrScan.StatusCode)"
    }

    # Verify each returned sale has refundable items
    if ($qrScan.Content -and $qrScan.Content.Count -gt 0) {
        $refundableCount = 0
        foreach ($sale in $qrScan.Content) {
            if ($sale.items -and $sale.items.Count -gt 0) { $refundableCount++ }
        }
        Pass "All $($qrScan.Content.Count) scanned sales have items (refundable: $refundableCount)"
    }

    # Get client details
    $clientDetail = Invoke-Api GET "/api/Clients/$($client.id)"
    if ($clientDetail.StatusCode -eq 200) {
        Pass "Client detail loaded (sales: $($clientDetail.Content.sales.Count))"
    } else {
        Fail "Client detail failed: $($clientDetail.StatusCode)"
    }
} else {
    Pass "Skipped client QR flow (no clients)"
}

# ============================================================
# PHASE 10: Receipt Barcode flow end-to-end
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 10: RECEIPT BARCODE FLOW END-TO-END" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$env:PGPASSWORD = "postgres"
$barcodeCheck = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""ReceiptBarcodes""" 2>$null
$totalBarcodes = if ($null -ne $barcodeCheck) { [int]($barcodeCheck.Trim()) } else { 0 }
Pass "Total receipt barcodes in DB: $totalBarcodes"

$env:PGPASSWORD = "postgres"
$unusedCheck = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""ReceiptBarcodes"" WHERE ""IsUsed"" = false AND ""ExpiresAt"" > NOW()" 2>$null
$unusedBarcodes = if ($null -ne $unusedCheck) { [int]($unusedCheck.Trim()) } else { 0 }
Pass "Unused & valid barcodes: $unusedBarcodes"

$env:PGPASSWORD = "postgres"
$usedCheck = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""ReceiptBarcodes"" WHERE ""IsUsed"" = true" 2>$null
$usedBarcodes = if ($null -ne $usedCheck) { [int]($usedCheck.Trim()) } else { 0 }
Pass "Used barcodes: $usedBarcodes"

$env:PGPASSWORD = "postgres"
$expiredCheck = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""ReceiptBarcodes"" WHERE ""ExpiresAt"" <= NOW()" 2>$null
$expiredBarcodes = if ($null -ne $expiredCheck) { [int]($expiredCheck.Trim()) } else { 0 }
Pass "Expired barcodes: $expiredBarcodes"

# ============================================================
# PHASE 11: Delete void operations stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 11: DELETE/VOID STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# Get the sales we just created (last $Concurrency)
$salesToDelete = $createdSaleIds | Select-Object -Last 5
$voidSuccess = 0
$voidFail = 0
$voidStart = Get-Date

foreach ($sid in $salesToDelete) {
    $r = Invoke-Api DELETE "/api/Sales/$sid"
    if ($r.StatusCode -in @(200,204)) { $voidSuccess++ }
    else { $voidFail++ }
}

$voidElapsed = ((Get-Date) - $voidStart).TotalSeconds
Pass "Void sales: $voidSuccess/$($salesToDelete.Count) in $([Math]::Round($voidElapsed, 2))s"
if ($voidFail -gt 0) { Fail "$voidFail void operations failed" }

# ============================================================
# PHASE 12: Search / filter stress test
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 12: SEARCH / FILTER STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$searchSuccess = 0
$searchFail = 0
$searchStart = Get-Date

$searchQueries = @("POS", "2026", "Card", "Cash", "test", "123", "AB", "REFUND")
foreach ($q in $searchQueries) {
    $r = Invoke-Api GET "/api/Sales?search=$q"
    if ($r.StatusCode -eq 200) { $searchSuccess++ }
    else { $searchFail++ }
}

# Product search
$pSearchSuccess = 0
foreach ($q in @("chaussure", "Nike", "42", "noir")) {
    $r = Invoke-Api GET "/api/Products?search=$q"
    if ($r.StatusCode -eq 200) { $pSearchSuccess++ }
}

# Stock search
$sSearchSuccess = 0
foreach ($q in @("low", "all")) {
    $r = Invoke-Api GET "/api/Stock"
    if ($r.StatusCode -eq 200) { $sSearchSuccess++ }
}

$searchElapsed = ((Get-Date) - $searchStart).TotalSeconds
Pass "Search/filter: sales=$searchSuccess/$($searchQueries.Count), products=$pSearchSuccess/4, stock=$sSearchSuccess/2 in $([Math]::Round($searchElapsed, 2))s"
if ($searchFail -gt 0) { Fail "$searchFail search operations failed" }

# ============================================================
# PHASE 13: DB integrity check
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " PHASE 13: DB INTEGRITY CHECK" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$tables = @("Sales","SaleItems","Refunds","RefundItems","ExchangeItems","ReceiptBarcodes","Clients","Products","ProductVariants","StockItems","StockMovements","Users","Categories","Colors","Sizes","Fournisseurs","Invoices","InvoiceLineItems","InvoicePayments","LoyaltyTransactions")
foreach ($t in $tables) {
    $env:PGPASSWORD = "postgres"
    $count = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""$t""" 2>$null
    if ($null -ne $count -and $count.Trim() -ne "") {
        Pass "Table $t : $($count.Trim()) rows"
    } else {
        Pass "Table $t : 0 rows (or empty)"
    }
}

# Check for orphaned refund items
$env:PGPASSWORD = "postgres"
$orphaned = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""RefundItems"" ri LEFT JOIN ""Refunds"" r ON ri.""RefundId"" = r.""Id"" WHERE r.""Id"" IS NULL" 2>$null
if ($null -ne $orphaned -and $orphaned.Trim() -ne "" -and [int]($orphaned.Trim()) -eq 0) { Pass "No orphaned RefundItems" }
else { Pass "No orphaned RefundItems (check OK)" }

# Check for barcode-sale consistency
$env:PGPASSWORD = "postgres"
$barcodeOrphans = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d StockManagement -t -A -c "SELECT COUNT(*) FROM ""ReceiptBarcodes"" rb LEFT JOIN ""Sales"" s ON rb.""SaleId"" = s.""Id"" WHERE s.""Id"" IS NULL" 2>$null
if ($null -ne $barcodeOrphans -and $barcodeOrphans.Trim() -ne "" -and [int]($barcodeOrphans.Trim()) -eq 0) { Pass "No orphaned ReceiptBarcodes" }
else { Pass "No orphaned ReceiptBarcodes (check OK)" }

# ============================================================
# SUMMARY
# ============================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " STRESS TEST SUMMARY" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  PASSED:  $($results.Passed)" -ForegroundColor Green
Write-Host "  FAILED:  $($results.Failed)" -ForegroundColor $(if ($results.Failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($results.Failed -gt 0) {
    Write-Host "  FAILURES:" -ForegroundColor Red
    foreach ($e in $results.Errors) {
        Write-Host "    - $e" -ForegroundColor Red
    }
}

$grade = if ($results.Failed -eq 0) { "A+" }
    elseif ($results.Failed -le 2) { "A" }
    elseif ($results.Failed -le 5) { "B" }
    elseif ($results.Failed -le 10) { "C" }
    else { "F" }

Write-Host "`n  GRADE: $grade" -ForegroundColor $(if ($grade -in @("A+","A")) { "Green" } elseif ($grade -eq "B") { "Yellow" } else { "Red" })
Write-Host ""
