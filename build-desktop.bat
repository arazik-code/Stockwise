@echo off
setlocal EnableDelayedExpansion

title FlexShoes Stock - Build
color 07

echo.
echo  ============================================
echo   FLEXSHOES STOCK - BUILD
echo  ============================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ── Step 1: Build React ────────────────────────────────────────

echo  [1/5] Building React frontend...

cd /d "%ROOT%src\SMS.React"
call npm run build
if errorlevel 1 (
    echo  ERROR: React build failed.
    goto :FAIL
)

echo        React build OK.
echo.

:: ── Step 2: Copy React to API wwwroot ─────────────────────────

echo  [2/5] Copying React to API wwwroot...

set "WWWROOT=%ROOT%src\SMS.API\wwwroot"
set "DIST=%ROOT%src\SMS.React\dist"

for /d %%D in ("%WWWROOT%\*") do (
    if /I not "%%~nxD"=="uploads" (
        rmdir /s /q "%%D" 2>nul
    )
)
for %%F in ("%WWWROOT%\*.*") do (
    del /q "%%F" 2>nul
)
xcopy /s /e /y /q "%DIST%\*" "%WWWROOT%\" >nul

echo        React copied to wwwroot.
echo.

:: ── Step 3: Publish API ───────────────────────────────────────

echo  [3/5] Publishing API...

set "PUBLISH_DIR=%ROOT%publish\api"

:: Clean old published wwwroot to prevent stale JS/CSS bundles
if exist "%PUBLISH_DIR%\wwwroot" rmdir /s /q "%PUBLISH_DIR%\wwwroot" 2>nul

cd /d "%ROOT%"
dotnet publish src\SMS.API\SMS.API.csproj -c Release --self-contained false -o "%PUBLISH_DIR%"
if errorlevel 1 (
    echo  ERROR: API publish failed.
    goto :FAIL
)

echo        API published.
echo.

:: ── Step 4: Publish Desktop ───────────────────────────────────

echo  [4/5] Building Desktop app...

set "DESKTOP_PUBLISH=%ROOT%publish\desktop"
cd /d "%ROOT%"
dotnet publish src\SMS.Desktop\SMS.Desktop.csproj -c Release --self-contained false -o "%DESKTOP_PUBLISH%"
if errorlevel 1 (
    echo  ERROR: Desktop publish failed.
    goto :FAIL
)

:: Clean old desktop api/wwwroot to prevent stale JS/CSS bundles
if exist "%DESKTOP_PUBLISH%\api\wwwroot" rmdir /s /q "%DESKTOP_PUBLISH%\api\wwwroot" 2>nul
mkdir "%DESKTOP_PUBLISH%\api" 2>nul
xcopy /s /e /y /q "%PUBLISH_DIR%\*" "%DESKTOP_PUBLISH%\api\" >nul

echo        Desktop app built.
echo.

:: ── Step 5: Create Desktop Shortcut ──────────────────────────

echo  [5/5] Creating desktop shortcut...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\FlexShoes Stock.lnk'); ^
   $sc.TargetPath = '%DESKTOP_PUBLISH%\FlexShoes Stock.exe'; ^
   $sc.WorkingDirectory = '%DESKTOP_PUBLISH%'; ^
   $sc.Description = 'FlexShoes Stock Management System'; ^
   $sc.WindowStyle = 1; ^
   $sc.Save(); ^
   Write-Output 'Shortcut created'"

echo        Shortcut created on Desktop.
echo.

:: ── Summary ───────────────────────────────────────────────────

echo  ============================================
echo   BUILD COMPLETE
echo  ============================================
echo.
echo    Desktop app: publish\desktop\FlexShoes Stock.exe
echo    Shortcut:    Desktop\FlexShoes Stock
echo.
echo  ============================================
echo.

cd /d "%ROOT%"
pause
exit /b 0

:FAIL
echo.
echo  BUILD FAILED
echo  Press any key to exit...
pause >nul
exit /b 1
