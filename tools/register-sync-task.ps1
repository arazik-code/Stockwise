<#
.SYNOPSIS
    One-time setup: registers the nightly VPS -> local-fallback catalog sync as a Windows
    Scheduled Task running at 03:30 every day (after the 02:00 DB backup), even if the machine
    was asleep.

.NOTES
    Run this once, as the user who normally runs the app (no admin required
    for a per-user scheduled task). Safe to run before a VPS exists - the sync
    script itself exits quietly with nothing to do until RemoteApiUrl is configured.
#>

$scriptPath = Join-Path $PSScriptRoot "sync-from-vps.ps1"
$taskName = "FlexShoes-VPS-Sync"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At "03:30"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force `
    -Description "Nightly catalog sync from the VPS into the local-fallback database (FlexShoes)."

Write-Output "Registered scheduled task '$taskName' - runs daily at 03:30."
Write-Output "Run it once now to verify: Start-ScheduledTask -TaskName '$taskName'"
