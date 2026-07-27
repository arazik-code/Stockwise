@echo off
REM =====================================================
REM  DATABASE BACKUP - Run daily
REM =====================================================

set BACKUP_DIR=C:\Backups\StockManagement
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if not defined DB_PASSWORD (
    echo [ERROR] DB_PASSWORD is not set! Load deploy\.env first ^(see tools\backup-db.ps1 for the scheduled-task version^).
    exit /b 1
)

echo Backing up database...
set PGPASSWORD=%DB_PASSWORD%
pg_dump -U postgres -h localhost -p 5432 StockManagement > "%BACKUP_DIR%\backup_%TIMESTAMP%.sql"

echo Done! Backup saved to: %BACKUP_DIR%\backup_%TIMESTAMP%.sql
timeout /t 5
