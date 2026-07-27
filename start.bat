@echo off
setlocal EnableDelayedExpansion

title Stock Management System
color 07

echo.
echo  ============================================
echo   STOCK MANAGEMENT SYSTEM
echo  ============================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ── Prerequisites ───────────────────────────────────────────────

echo  [1/3] Checking prerequisites...

where dotnet >nul 2>&1
if errorlevel 1 (
    echo  ERROR: dotnet SDK not found. Install .NET 8+ SDK.
    goto :FAIL
)

where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found. Install Node.js 18+.
    goto :FAIL
)

echo        All prerequisites OK.
echo.

:: ── HTTPS Certificate ───────────────────────────────────────────

echo  [2/3] Trusting HTTPS certificate...
dotnet dev-certs https --trust >nul 2>&1
echo        Certificate OK.
echo.

:: ── PostgreSQL ──────────────────────────────────────────────────

echo  [3/3] Checking PostgreSQL...

powershell -NoProfile -Command ^
  "try { $c = New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres'); $c.Open(); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Cannot connect to PostgreSQL on localhost:5432.
    echo  Make sure PostgreSQL is running and accepting connections.
    goto :FAIL
)

echo        PostgreSQL is ready.
echo.

:: ── .NET API ────────────────────────────────────────────────────

echo  Starting SMS.API and SMS.React...

cd /d "%ROOT%src\SMS.API"
start "SMS.API" dotnet run

echo        Waiting for API...

:WAIT_API
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'http://localhost:5001/api/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto WAIT_API

echo        API is ready.
echo.

:: ── React Frontend ──────────────────────────────────────────────

cd /d "%ROOT%src\SMS.React"
start "SMS.React" npm run dev

timeout /t 8 /nobreak >nul

echo        Frontend is ready.
echo.

:: ── Reset working directory ─────────────────────────────────────

cd /d "%ROOT%"

:: ── Summary ─────────────────────────────────────────────────────

echo  ============================================
echo   SYSTEM IS RUNNING
echo  ============================================
echo.
echo    Frontend .... http://localhost:5173
echo    API ......... https://localhost:7001
echo    Swagger ..... https://localhost:7001/swagger
echo.
echo    Demo Accounts
echo    ─────────────────────────────────
echo    admin   / admin123    (Admin)
echo    cashier / cashier123  (Cashier)
echo    manager / admin123    (Manager)
echo.
echo  ============================================
echo.

start "" "http://localhost:5173"

echo  Press any key to shut down all services...
pause >nul

:: ── Shutdown ────────────────────────────────────────────────────

echo.
echo  Shutting down...
taskkill /FI "WINDOWTITLE eq SMS.API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SMS.React*" /F >nul 2>&1
echo  Done.
timeout /t 2 /nobreak >nul
exit /b 0

:FAIL
echo.
echo  Press any key to exit...
pause >nul
exit /b 1
