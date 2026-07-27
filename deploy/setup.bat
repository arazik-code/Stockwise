@echo off
REM =====================================================
REM  STOCK MANAGEMENT SYSTEM - ONE CLICK SETUP
REM =====================================================
REM  Run this ONCE on your new computer.
REM  It will install everything automatically.
REM =====================================================

setlocal enabledelayedexpansion
color 0A

echo.
echo  ==========================================
echo   STOCK MANAGEMENT SYSTEM - SETUP
echo   One-Click Installation
echo  ==========================================
echo.

REM =====================================================
REM  STEP 1: Check .NET Runtime
REM =====================================================
echo  [1/6] Checking .NET Runtime...

dotnet --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] .NET 10 is NOT installed!
    echo.
    echo  Download from: https://dotnet.microsoft.com/download/dotnet/10.0
    echo  Choose: .NET Runtime (not SDK)
    echo.
    start https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('dotnet --version') do set DOTNET_VERSION=%%i
echo  [OK] .NET !DOTNET_VERSION! found
echo.

REM =====================================================
REM  STEP 2: Check PostgreSQL
REM =====================================================
echo  [2/6] Checking PostgreSQL...

netstat -an | findstr ":5432" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] PostgreSQL is NOT running on port 5432!
    echo.
    echo  Make sure PostgreSQL is installed and running.
    echo  Download from: https://www.postgresql.org/download/windows/
    echo.
    pause
    exit /b 1
)

echo  [OK] PostgreSQL is running on port 5432
echo.

REM =====================================================
REM  STEP 3: Test Database Connection
REM =====================================================
echo  [3/6] Testing database connection...

if not defined DB_PASSWORD (
    echo  [ERROR] DB_PASSWORD is not set!
    echo  Copy deploy\.env.example to deploy\.env and fill in your values,
    echo  then re-run this script from a shell that has loaded it.
    pause
    exit /b 1
)
set PGPASSWORD=%DB_PASSWORD%
psql -U postgres -h localhost -p 5432 -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Cannot connect to PostgreSQL!
    echo  Check DB_PASSWORD in deploy\.env
    echo.
    pause
    exit /b 1
)

echo  [OK] Database connection successful
echo.

REM =====================================================
REM  STEP 4: Create Database
REM =====================================================
echo  [4/6] Setting up database...

psql -U postgres -h localhost -p 5432 -c "SELECT 1 FROM pg_database WHERE datname='StockManagement'" -t | findstr /r "1" >nul 2>&1
if errorlevel 1 (
    echo  Creating database 'StockManagement'...
    psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE StockManagement;"
    if errorlevel 1 (
        echo  [ERROR] Failed to create database!
        pause
        exit /b 1
    )
    echo  [OK] Database created
) else (
    echo  [OK] Database 'StockManagement' already exists
)
echo.

REM =====================================================
REM  STEP 5: Build Application
REM =====================================================
echo  [5/6] Building application (this may take a minute)...

cd /d "%~dp0.."

dotnet restore src/SMS.API/SMS.API.csproj >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Package restore failed!
    pause
    exit /b 1
)

dotnet publish src/SMS.API/SMS.API.csproj -c Release -o ./publish --self-contained false >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Build failed!
    pause
    exit /b 1
)

echo  [OK] Application built successfully
echo.

REM =====================================================
REM  STEP 6: Configure Application
REM =====================================================
echo  [6/6] Configuring application...

REM Create production config
(
echo {
echo   "ConnectionStrings": {
echo     "Default": "Host=localhost;Database=StockManagement;Username=postgres;Password=%DB_PASSWORD%"
echo   },
echo   "Store": {
echo     "Name": "FLEX SHOES",
echo     "Phone": "",
echo     "Address": ""
echo   },
echo   "Tax": {
echo     "Rate": 0
echo   },
echo   "Jwt": {
echo     "SecretKey": "%JWT_SECRET%",
echo     "Issuer": "StockManagementSystem",
echo     "Audience": "StockManagementSystem",
echo     "ExpirationMinutes": 480
echo   },
echo   "Printer": {
echo     "ConnectionType": "TCP",
echo     "IpAddress": "192.168.1.100",
echo     "Port": 9100,
echo     "WindowsShareName": "TSC TTP-247",
echo     "CupsQueueName": "TSC-TTP-247"
echo   },
echo   "Loyalty": {
echo     "NewClientRate": 5,
echo     "AncientClientRate": 8,
echo     "PointsForRedemption": 10,
echo     "DhPerRedemption": 1.00,
echo     "WelcomePoints": 50,
echo     "Enabled": true
echo   },
echo   "Logging": {
echo     "LogLevel": {
echo       "Default": "Warning",
echo       "Microsoft.AspNetCore": "Warning",
echo       "Microsoft.EntityFrameworkCore": "Warning"
echo     }
echo   },
echo   "AllowedHosts": "*"
echo }
) > "%~dp0..\publish\appsettings.Production.json"

echo  [OK] Configuration saved
echo.

REM =====================================================
REM  SETUP COMPLETE - START APPLICATION
REM =====================================================
echo  ==========================================
echo   SETUP COMPLETE!
echo  ==========================================
echo.
echo  Starting Stock Management System...
echo  Press Ctrl+C to stop the server
echo.

cd /d "%~dp0..\publish"
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://localhost:5000

REM Open browser after 3 seconds
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

REM Start the API
dotnet SMS.API.dll
