<#
.SYNOPSIS
    One-time setup: registers the nightly DB backup as a Windows Scheduled Task
    running at 02:00 every day, even if the machine was asleep.

.NOTES
    Run this once, as the user who normally runs the app (no admin required
    for a per-user scheduled task).
#>

$scriptPath = Join-Path $PSScriptRoot "backup-db.ps1"
$taskName = "FlexShoes-DB-Backup"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force `
    -Description "Nightly pg_dump backup of the StockManagement database (FlexShoes)."

Write-Output "Registered scheduled task '$taskName' - runs daily at 02:00."
Write-Output "Run it once now to verify: Start-ScheduledTask -TaskName '$taskName'"
