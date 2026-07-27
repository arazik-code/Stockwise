@echo off
setlocal EnableDelayedExpansion

title Stock Management System - Demo Mode
color 0A

echo ============================================================
echo   STOCK MANAGEMENT SYSTEM - DEMO MODE
echo ============================================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: -----------------------------------------------------------
:: 1. Check prerequisites
:: -----------------------------------------------------------
echo [1/4] Checking prerequisites...

where dotnet >nul 2>&1
if errorlevel 1 (
    echo ERROR: dotnet SDK not found. Install .NET 8 SDK.
    pause
    exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker not found. Install Docker Desktop.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+.
    pause
    exit /b 1
)

echo    All prerequisites OK.
echo.

:: -----------------------------------------------------------
:: 2. Start PostgreSQL via Docker Compose
:: -----------------------------------------------------------
echo [2/4] Starting PostgreSQL container...

docker compose up -d postgres
if errorlevel 1 (
    echo ERROR: Failed to start PostgreSQL container.
    pause
    exit /b 1
)

echo    Waiting for PostgreSQL to be ready...
:WAIT_PG
timeout /t 2 /nobreak >nul
docker compose exec postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 goto WAIT_PG
echo    PostgreSQL is ready.
echo.

:: -----------------------------------------------------------
:: 3. Start the .NET API (auto-migrates + seeds demo data)
:: -----------------------------------------------------------
echo [3/4] Starting SMS.API (https://localhost:7001)...
echo    Swagger UI: https://localhost:7001/swagger
echo.

pushd "%ROOT%src\SMS.API"
start "SMS.API" cmd /k dotnet run
popd

echo    Waiting for API to be ready (may take 15-30 seconds on first run)...
:WAIT_API
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://localhost:7001/api/health' -SkipCertificateCheck -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto WAIT_API
echo    SMS.API is ready.
echo.

:: -----------------------------------------------------------
:: 4. Start the React frontend
:: -----------------------------------------------------------
echo [4/4] Starting SMS.React (http://localhost:5173)...
echo.

pushd "%ROOT%src\SMS.React"
start "SMS.React" cmd /k npm run dev
popd

timeout /t 8 /nobreak >nul

echo ============================================================
echo   SYSTEM IS RUNNING
echo ============================================================
echo.
echo   Frontend:  http://localhost:5173
echo   API:       https://localhost:7001
echo   Swagger:   https://localhost:7001/swagger
echo.
echo   Demo Users:
echo     admin   / admin123   (Admin)
echo     cashier / cashier123 (Cashier)
echo     manager / admin123   (Manager)
echo.
echo ============================================================
echo.

:: Open the frontend in the default browser
start "" "http://localhost:5173"

:: Keep the window open and wait for user to stop
echo Press any key to shut down all services...
pause >nul

:: -----------------------------------------------------------
:: Cleanup: stop everything
:: -----------------------------------------------------------
echo.
echo Shutting down...
taskkill /FI "WINDOWTITLE eq SMS.API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SMS.React*" /F >nul 2>&1
docker compose down
echo Done.
pause
