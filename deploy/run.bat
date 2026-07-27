@echo off
REM =====================================================
REM  STOCK MANAGEMENT SYSTEM - DAILY RUN
REM =====================================================
REM  Use this after running setup.bat once.
REM  Just double-click to start the system.
REM =====================================================

echo.
echo  Starting Stock Management System...
echo  URL: http://localhost:5000
echo  Press Ctrl+C to stop
echo.

cd /d "%~dp0..\publish"
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://localhost:5000

REM Open browser automatically
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

REM Start the server
dotnet SMS.API.dll
