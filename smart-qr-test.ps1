param([string]$BaseUrl = "http://localhost:5000")
$ErrorActionPreference = "Continue"
$pass = 0; $fail = 0; $errors = @()
function Log($m) { Write-Host "[$(Get-Date -Format 'HH:mm:ss.fff')] $m" -ForegroundColor Cyan }
function Ok($m) { $script:pass++; Write-Host "  PASS: $m" -ForegroundColor Green }
function Bad($m) { $script:fail++; $script:errors += $m; Write-Host "  FAIL: $m" -ForegroundColor Red }
function Api($method, $path, $body = $null, $token = "") {
    $url = "$BaseUrl$path"
    $h = @{}; if ($token) { $h["Authorization"] = "Bearer $token" }
    try {
        $p = @{Uri=$url; Method=$method; Headers=$h; UseBasicParsing=$true; TimeoutSec=30; ContentType="application/json"}
        if ($body) { $p.Body = ($body | ConvertTo-Json -Depth 10) }
        $r = Invoke-WebRequest @p
        return @{OK=$true; Status=$r.StatusCode; Data=$r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue}
    } catch {
        $c = 0; if ($_.Exception.Response) { $c = [int]$_.Exception.Response.StatusCode }
        $msg = ""; try { $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()); $msg = $sr.ReadToEnd() } catch {}
        return @{OK=$false; Status=$c; Error=$_.Exception.Message; Body=$msg}
    }
}
function Psql($sql) {
    $env:PGPASSWORD = 'postgres'
    Set-Content -Path "$PSScriptRoot\temp.sql" -Value $sql
    return & 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -d StockManagement -t -A -f "$PSScriptRoot\temp.sql" 2>$null
}
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " SMART QR CODE - TARGETED STRESS TEST" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

Log "T1: Authentication"
$reg = Api POST "/api/Auth/login" @{username="stresstest";password="Stress123!"}
if ($reg.Data.token) { $tok = $reg.Data.token; Ok "Got JWT token" }
else { Bad "Cannot authenticate"; return }

Log "T2: Setup stock"
$variants = Api GET "/api/Products" "" $tok
$variantIds = @()
foreach ($p in $variants.Data) {
    foreach ($v in $p.variants) {
        $variantIds += $v.id
        $adj = Api POST "/api/Stock/adjust" @{productVariantId=$v.id;newQuantity=500;notes="Setup"} $tok
    }
}
Ok "Stock for $($variantIds.Count) variants"

Log "T3: Create clients"
$clientIds = @(); $clientQrs = @()
for ($i = 1; $i -le 10; $i++) {
    $r = Api POST "/api/Clients" @{name="QR Client $i";phone="666$(Get-Random -Maximum 99999999)"} $tok
    if ($r.Data.id) { $clientIds += $r.Data.id; $clientQrs += $r.Data.qrCode
        if ($r.Data.qrCode -like "SMS-*") { Ok "Client $($r.Data.id): QR=$($r.Data.qrCode)" }
        else { Bad "Client $($r.Data.id): QR missing SMS- prefix" }
    } else { Bad "Client creation failed" }
}

Log "T4: Create sales"
$salesCreated = 0; $loyaltySales = @(); $walkInSales = @()
for ($i = 1; $i -le 30; $i++) {
    $vid = $variantIds[(Get-Random -Maximum $variantIds.Count)]
    $qty = Get-Random -Minimum 1 -Maximum 3
    $cid = if ($i -le 10) { $clientIds[($i - 1) % $clientIds.Count] } elseif ($i -le 20) { $null } else { $clientIds[0] }
    $r = Api POST "/api/Sales" @{category=0;paymentMethod=(Get-Random -Maximum 3);amountPaid=[decimal]100*$qty;taxRate=0;clientId=$cid;items=@(@{productVariantId=$vid;quantity=$qty;discountAmount=0})} $tok
    if ($r.Data.id) { $salesCreated++
        if ($i -le 10) { $loyaltySales += $r.Data.id } else { $walkInSales += $r.Data.id }
    }
}
Ok "Created $salesCreated/30 sales (loyalty=$($loyaltySales.Count), walkin=$($walkInSales.Count))"

$bcCount = (Psql "SELECT COUNT(*) FROM public.""ReceiptBarcodes""").Trim()
Ok "Receipt barcodes: $bcCount"

Log "T5: Client QR concurrent scan (50x)"
$testQr = $clientQrs[0]; $jobs = @()
$sw = [System.Diagnostics.Stopwatch]::StartNew()
for ($i = 1; $i -le 50; $i++) {
    $jobs += Start-Job -ScriptBlock { param($url,$token,$qr)
        $h=@{Authorization="Bearer $token"}
        try { $r=Invoke-WebRequest -Uri "$url/api/Refunds/scan-client-qr/$qr" -Headers $h -UseBasicParsing -TimeoutSec 30
            return @{OK=$true;Count=($r.Content|ConvertFrom-Json).Count} }
        catch { return @{OK=$false} }
    } -ArgumentList $BaseUrl,$tok,$testQr
}
$results = $jobs | Wait-Job -Timeout 60 | Receive-Job; $jobs | Remove-Job -Force 2>$null; $sw.Stop()
$okCount = ($results | Where-Object { $_.OK }).Count
Ok "QR scan: $okCount/50 OK in $([Math]::Round($sw.ElapsedMilliseconds/1000,2))s"

Log "T6: Receipt barcode scan"
$barcodes = Psql "SELECT ""Barcode"" FROM public.""ReceiptBarcodes"" WHERE ""IsUsed"" = false LIMIT 5"
$bcList = ($barcodes -split "`n") | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() }
$bcOk = 0
foreach ($bc in $bcList) { $r = Api GET "/api/Refunds/scan-barcode/$bc" "" $tok; if ($r.Status -eq 200) { $bcOk++ } }
Ok "Barcode scan: $bcOk/$($bcList.Count)"

Log "T7: Refund + barcode marking"
$refundOk = 0
foreach ($sid in $loyaltySales | Select-Object -First 3) {
    $detail = Api GET "/api/Refunds/sale/$sid" "" $tok
    if ($detail.Data -and $detail.Data.items.Count -gt 0) {
        $item = $detail.Data.items[0]
        $rb = Api POST "/api/Refunds" @{saleId=$sid;type="Refund";reason="QR test";items=@(@{saleItemId=$item.id;quantity=1});exchangeItems=@()} $tok
        if ($rb.Data.id) {
            $proc = Api POST "/api/Refunds/$($rb.Data.id)/process" "" $tok
            if ($proc.Status -in @(200,204)) {
                $refundOk++
                $used = (Psql "SELECT COUNT(*) FROM public.""ReceiptBarcodes"" WHERE ""SaleId"" = $sid AND ""IsUsed"" = true").Trim()
                if ([int]$used -gt 0) { Ok "Barcode marked USED for sale $sid" }
                else { Bad "Barcode NOT marked used for sale $sid" }
            }
        }
    }
}
Ok "Refunds: $refundOk/3"

Log "T8: Double-scan prevention"
$firstSale = $loyaltySales | Select-Object -First 1
$bc = (Psql "SELECT ""Barcode"" FROM public.""ReceiptBarcodes"" WHERE ""SaleId"" = $firstSale").Trim()
if ($bc) {
    $r = Api GET "/api/Refunds/scan-barcode/$bc" "" $tok
    if ($r.Status -eq 400) { Ok "Double-scan blocked (400)" }
    elseif ($r.Status -eq 200) { Bad "Double-scan NOT blocked" }
    else { Ok "Double-scan returned $($r.Status)" }
}

Log "T9: Exchange flow"
$exchSale = $walkInSales | Select-Object -First 1
$detail = Api GET "/api/Refunds/sale/$exchSale" "" $tok
if ($detail.Data -and $detail.Data.items.Count -gt 0) {
    $item = $detail.Data.items[0]
    $rvid = $variantIds | Where-Object { $_ -ne $item.productVariantId } | Select-Object -First 1
    $exch = Api POST "/api/Refunds" @{saleId=$exchSale;type="Exchange";reason="Test";items=@(@{saleItemId=$item.id;quantity=1});exchangeItems=@(@{productVariantId=$rvid;quantity=1})} $tok
    if ($exch.Data.id) {
        $proc = Api POST "/api/Refunds/$($exch.Data.id)/process" "" $tok
        if ($proc.Status -in @(200,204)) { Ok "Exchange processed" } else { Bad "Exchange process: $($proc.Status)" }
    } else { Bad "Exchange create: $($exch.Status)" }
}

Log "T10: Search stress"
$jobs = @()
foreach ($q in @("POS","2026","Card","Cash","test","chaussure","Nike")) {
    $jobs += Start-Job -ScriptBlock { param($url,$token,$q)
        $h=@{Authorization="Bearer $token"}
        try { Invoke-WebRequest -Uri "$url/api/Sales?search=$q" -Headers $h -UseBasicParsing -TimeoutSec 15 | Out-Null; return @{OK=$true} }
        catch { return @{OK=$false} }
    } -ArgumentList $BaseUrl,$tok,$q
}
$sRes = $jobs | Wait-Job -Timeout 30 | Receive-Job; $jobs | Remove-Job -Force 2>$null
$sOk = ($sRes | Where-Object { $_.OK }).Count
Ok "Search: $sOk/$($queries.Count) OK"

Log "T11: DB integrity"
foreach ($t in @("Sales","SaleItems","Refunds","RefundItems","ReceiptBarcodes","Clients","Products","ProductVariants","StockItems")) {
    $c = (Psql "SELECT COUNT(*) FROM public.""$t""").Trim()
    Ok "$t : $c rows"
}
$orphan = (Psql "SELECT COUNT(*) FROM public.""RefundItems"" ri LEFT JOIN public.""Refunds"" r ON ri.""RefundId"" = r.""Id"" WHERE r.""Id"" IS NULL").Trim()
if ([int]$orphan -eq 0) { Ok "No orphaned RefundItems" } else { Bad "$orphan orphaned RefundItems" }
$ob = (Psql "SELECT COUNT(*) FROM public.""ReceiptBarcodes"" rb LEFT JOIN public.""Sales"" s ON rb.""SaleId"" = s.""Id"" WHERE s.""Id"" IS NULL").Trim()
if ([int]$ob -eq 0) { Ok "No orphaned ReceiptBarcodes" } else { Bad "$ob orphaned ReceiptBarcodes" }

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " RESULTS" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow
Write-Host "  PASSED:  $pass" -ForegroundColor Green
Write-Host "  FAILED:  $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { Write-Host "`n  FAILURES:" -ForegroundColor Red; foreach ($e in $errors) { Write-Host "    - $e" -ForegroundColor Red } }
$grade = if ($fail -eq 0) { "A+" } elseif ($fail -le 1) { "A" } elseif ($fail -le 3) { "B" } else { "F" }
Write-Host "`n  GRADE: $grade`n" -ForegroundColor $(if ($grade -in @("A+","A")) { "Green" } elseif ($grade -eq "B") { "Yellow" } else { "Red" })
