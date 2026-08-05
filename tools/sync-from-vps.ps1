<#
.SYNOPSIS
    Nightly catalog sync: pulls a snapshot from the VPS (GET /api/sync/snapshot) and applies it
    to the local-fallback API (POST /api/sync/apply). Registered as a Windows Scheduled Task
    (see register-sync-task.ps1).

.NOTES
    Reads RemoteApiUrl from desktop-config.json (the same file the desktop shell itself reads for
    failover) and the shared Sync:ApiKey from the local API's appsettings.json - if either is
    missing/empty, there's nothing configured to sync from yet, and this exits quietly rather
    than erroring, since that's the expected state before a VPS exists.
#>

param(
    [string]$AppSettingsPath = "C:\Users\HP\Documents\StockManagmentSystem\StockManagmentSystem\publish\desktop\api\appsettings.json",
    [string]$DesktopConfigPath = "C:\Users\HP\Documents\StockManagmentSystem\StockManagmentSystem\publish\desktop\desktop-config.json",
    [string]$LocalApiUrl = "http://localhost:5001"
)

$ErrorActionPreference = "Stop"

function Get-SyncApiKey {
    if (-not (Test-Path $AppSettingsPath)) {
        throw "appsettings.json not found at $AppSettingsPath"
    }
    $json = Get-Content $AppSettingsPath -Raw | ConvertFrom-Json
    return $json.Sync.ApiKey
}

function Get-RemoteApiUrl {
    if (-not (Test-Path $DesktopConfigPath)) { return $null }
    $json = Get-Content $DesktopConfigPath -Raw | ConvertFrom-Json
    return $json.RemoteApiUrl
}

$syncApiKey = Get-SyncApiKey
$remoteUrl = Get-RemoteApiUrl

if ([string]::IsNullOrWhiteSpace($remoteUrl)) {
    Write-Output "No RemoteApiUrl configured yet (desktop-config.json) - nothing to sync from. Skipping."
    exit 0
}
if ([string]::IsNullOrWhiteSpace($syncApiKey)) {
    Write-Output "No Sync:ApiKey configured yet (appsettings.json) - skipping sync."
    exit 0
}

$headers = @{ "X-Sync-Api-Key" = $syncApiKey }

Write-Output "Pulling snapshot from $remoteUrl ..."
$snapshot = Invoke-RestMethod -Uri "$remoteUrl/api/sync/snapshot" -Headers $headers -Method Get -TimeoutSec 120

$body = $snapshot | ConvertTo-Json -Depth 10 -Compress

Write-Output "Applying snapshot to local API ($LocalApiUrl) ..."
$result = Invoke-RestMethod -Uri "$LocalApiUrl/api/sync/apply" -Headers $headers -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300

Write-Output "Sync complete:"
$result | ConvertTo-Json

if ($result.stockItemsSkippedDueToLocalActivity -gt 0) {
    Write-Output ""
    Write-Output "NOTE: $($result.stockItemsSkippedDueToLocalActivity) stock item(s) were left untouched because local activity happened since the last sync - review these manually."
}
if ($result.clientsSkippedLoyaltyFieldsDueToLocalActivity -gt 0) {
    Write-Output "NOTE: $($result.clientsSkippedLoyaltyFieldsDueToLocalActivity) client(s) had loyalty fields left untouched for the same reason."
}
