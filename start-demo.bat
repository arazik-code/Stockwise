@echo off
setlocal EnableExtensions
title StockWise Demo Launcher
color 0A
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================================
echo   STOCKWISE - DEMO WITH SAMPLE CATALOG
echo ============================================================
echo.

where dotnet >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\StockManagementDemo\dotnet\dotnet.exe" (
    set "DOTNET_ROOT=%LOCALAPPDATA%\StockManagementDemo\dotnet"
    set "PATH=%LOCALAPPDATA%\StockManagementDemo\dotnet;%PATH%"
  ) else (
    echo ERROR: .NET SDK is not installed or could not be found.
    echo Install the .NET 10 SDK from https://dotnet.microsoft.com/download
    goto :fail
  )
)
dotnet --list-sdks | findstr /B "10." >nul
if errorlevel 1 (
  echo ERROR: .NET 10 SDK was not found.
  echo Install the .NET 10 SDK from https://dotnet.microsoft.com/download
  goto :fail
)
where node >nul 2>&1
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else (
    echo ERROR: Node.js is not installed or could not be found.
    echo Install Node.js 18 or later from https://nodejs.org
    goto :fail
  )
)
call :check_command node "Install Node.js 18 or later from https://nodejs.org"
if errorlevel 1 goto :fail

set "LOCAL_PG_STARTED=0"
echo [1/4] Checking local PostgreSQL option...
where docker >nul 2>&1
if errorlevel 1 goto postgres_external
docker info >nul 2>&1
if errorlevel 1 goto postgres_external
echo Starting the persistent local PostgreSQL database on port 5433...
docker compose up -d postgres
if errorlevel 1 goto :fail
set "LOCAL_PG_STARTED=1"
set "PG_ATTEMPTS=0"
:wait_pg
docker compose exec -T postgres pg_isready -U postgres >nul 2>&1
if not errorlevel 1 goto postgres_ready
set /a PG_ATTEMPTS+=1
if %PG_ATTEMPTS% GEQ 30 (
  echo ERROR: PostgreSQL did not become ready within 60 seconds.
  goto :fail
)
timeout /t 2 /nobreak >nul
goto wait_pg
:postgres_external
echo Docker is unavailable. The API will use the database configured in appsettings or .NET User Secrets.
:postgres_ready

echo [2/4] Starting API with DemoData:Enabled=true...
start "StockWise Demo API" /D "%ROOT%src\SMS.API" cmd /k "title StockWise Demo API ^& set ASPNETCORE_ENVIRONMENT=Development ^& set DemoData__Enabled=true ^& dotnet run"
echo Waiting for API readiness...
call :wait_for_api
if errorlevel 1 goto :fail

echo [3/4] Preparing frontend...
if not exist "%ROOT%src\SMS.React\node_modules\vite" (
  where npm >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Frontend packages are missing and npm could not be found.
    echo Install Node.js with npm, then rerun this launcher.
    goto :fail
  )
  pushd "%ROOT%src\SMS.React"
  call npm install
  if errorlevel 1 (
    popd
    echo ERROR: Frontend dependency installation failed.
    goto :fail
  )
  popd
)

echo [4/4] Starting React frontend...
start "StockWise Demo Frontend" /D "%ROOT%src\SMS.React" cmd /k "title StockWise Demo Frontend ^& call node_modules\.bin\vite.cmd --host 0.0.0.0"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo StockWise is running at http://localhost:5173
echo API health: http://localhost:5001/api/health
echo Demo catalog generation is enabled (only on an empty product catalog).
echo The local PostgreSQL database keeps its data between launches.
echo.
echo Press any key to stop the API and frontend.
pause >nul
taskkill /FI "WINDOWTITLE eq StockWise Demo API" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq StockWise Demo Frontend" /T /F >nul 2>&1
if "%LOCAL_PG_STARTED%"=="1" docker compose stop postgres
exit /b 0

:wait_for_api
set "API_ATTEMPTS=0"
:wait_api
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:5001/api/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 exit /b 0
set /a API_ATTEMPTS+=1
if %API_ATTEMPTS% GEQ 40 (
  echo ERROR: API did not become ready. Check the StockWise Demo API window and database configuration.
  exit /b 1
)
goto wait_api

:check_command
where %~1 >nul 2>&1
if not errorlevel 1 exit /b 0
echo ERROR: Required command %~1 is not available.
echo %~2
exit /b 1

:fail
echo.
echo Startup failed. Review the message above. Any started services may be closed manually.
pause
exit /b 1
