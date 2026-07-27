@echo off
REM =====================================================
REM Stock Management System - Install as Windows Service
REM =====================================================
REM This installs the API as a Windows Service that starts
REM automatically with Windows. Run as Administrator.
REM =====================================================

echo.
echo ========================================
echo  Installing Stock Management System
echo  as Windows Service
echo ========================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This script must be run as Administrator.
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

set SERVICE_NAME=StockManagementAPI
set APP_PATH=%~dp0publish

echo Installing service: %SERVICE_NAME%
echo Application path: %APP_PATH%
echo.

REM Create the service
sc create "%SERVICE_NAME%" binPath= "\"%APP_PATH%\SMS.API.dll\"" start= auto DisplayName= "Stock Management API"

if errorlevel 1 (
    echo [ERROR] Service installation failed.
    pause
    exit /b 1
)

REM Set recovery options (restart on failure)
sc failure "%SERVICE_NAME%" reset= 86400 actions= restart/60000/restart/120000/restart/300000

REM Set environment variables for the service
reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%\Environment" /v ASPNETCORE_ENVIRONMENT /t REG_SZ /d Production /f
reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%\Environment" /v ASPNETCORE_URLS /t REG_SZ /d "http://localhost:5000" /f

echo.
echo [OK] Service installed successfully.
echo.
echo Starting service...
net start "%SERVICE_NAME%"

if errorlevel 1 (
    echo [WARNING] Service could not be started automatically.
    echo You can start it manually from Services.msc
)

echo.
echo ========================================
echo  Installation Complete
echo ========================================
echo.
echo Service Name: %SERVICE_NAME%
echo URL: http://localhost:5000
echo.
echo To manage the service:
echo   - Open Services.msc
echo   - Find "Stock Management API"
echo   - Right-click for options
echo.
echo To uninstall:
echo   sc delete "%SERVICE_NAME%"
echo.

pause
