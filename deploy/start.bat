@echo off
REM =====================================================
REM Stock Management System - Production Startup
REM =====================================================
REM This script builds and runs the system in production mode.
REM Run this script after installing PostgreSQL and .NET 10.
REM =====================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo  Stock Management System - Starting...
echo ========================================
echo.

REM Check if .NET is installed
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET 10 is not installed.
    echo Please download from: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)

REM Check if PostgreSQL is running
netstat -an | findstr ":5432" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PostgreSQL is not running on port 5432.
    echo Please start PostgreSQL service.
    pause
    exit /b 1
)

echo [1/4] Restoring packages...
dotnet restore src/SMS.API/SMS.API.csproj
if errorlevel 1 (
    echo [ERROR] Package restore failed.
    pause
    exit /b 1
)

echo [2/4] Building application...
dotnet publish src/SMS.API/SMS.API.csproj -c Release -o ./publish --self-contained false
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo [3/4] Applying database migrations...
cd publish
dotnet SMS.API.dll --migrate-only 2>nul
cd ..

echo [4/4] Starting API server...
echo.
echo ========================================
echo  Server starting on http://localhost:5000
echo  Press Ctrl+C to stop
echo ========================================
echo.

cd publish
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://localhost:5000
dotnet SMS.API.dll

pause
