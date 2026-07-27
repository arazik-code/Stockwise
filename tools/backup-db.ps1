<#
.SYNOPSIS
    Nightly backup of the StockManagement Postgres database.
    Registered as a Windows Scheduled Task (see register-backup-task.ps1).

.NOTES
    Uses pg_dump -Fc (compressed custom format) so restores can use pg_restore
    with parallel jobs and selective table restore if ever needed.
    Retention: 30 daily dumps + 1 permanent monthly dump per calendar month.
#>

param(
    [string]$PgBinDir = "C:\Program Files\PostgreSQL\16\bin",
    [string]$DbName = "StockManagement",
    [string]$DbUser = "postgres",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$BackupDir = "C:\Backups\StockManagement",
    [string]$AppSettingsPath = "C:\Users\HP\Documents\StockManagmentSystem\StockManagmentSystem\publish\desktop\api\appsettings.json",
    [int]$DailyRetentionDays = 30
)

$ErrorActionPreference = "Stop"

function Get-DbPassword {
    if (-not (Test-Path $AppSettingsPath)) {
        throw "appsettings.json not found at $AppSettingsPath - cannot read DB password."
    }
    $json = Get-Content $AppSettingsPath -Raw | ConvertFrom-Json
    $cs = $json.ConnectionStrings.Default
    if ($cs -match "Password=([^;]*)") {
        return $Matches[1]
    }
    throw "Could not parse Password from connection string."
}

$dailyDir = Join-Path $BackupDir "daily"
$monthlyDir = Join-Path $BackupDir "monthly"
New-Item -ItemType Directory -Force -Path $dailyDir | Out-Null
New-Item -ItemType Directory -Force -Path $monthlyDir | Out-Null

$env:PGPASSWORD = Get-DbPassword

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dailyFile = Join-Path $dailyDir "sms_$stamp.dump"
$pgDump = Join-Path $PgBinDir "pg_dump.exe"

if (-not (Test-Path $pgDump)) {
    throw "pg_dump.exe not found at $pgDump"
}

Write-Output "Backing up '$DbName' to $dailyFile ..."
& $pgDump -Fc -U $DbUser -h $DbHost -p $DbPort -d $DbName -f $dailyFile
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}

$sizeKb = [math]::Round((Get-Item $dailyFile).Length / 1KB, 1)
Write-Output "OK: $dailyFile ($sizeKb KB)"

# Keep exactly one permanent copy per calendar month (the first daily dump of the month)
$monthTag = Get-Date -Format "yyyyMM"
$monthlyFile = Join-Path $monthlyDir "sms_$monthTag.dump"
if (-not (Test-Path $monthlyFile)) {
    Copy-Item $dailyFile $monthlyFile
    Write-Output "Archived monthly copy: $monthlyFile"
}

# Retention: drop daily dumps older than N days
$cutoff = (Get-Date).AddDays(-$DailyRetentionDays)
Get-ChildItem $dailyDir -Filter "sms_*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
    Write-Output "Pruning old backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}

Write-Output "Backup complete."
