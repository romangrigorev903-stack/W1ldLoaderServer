@echo off
chcp 1251 >nul
title W1ld Auth Server - Menu
cd /d "%~dp0"

:menu
cls
echo ================================================
echo        W1LD AUTH SERVER - CONTROL PANEL
echo ================================================
echo.
echo   [1] Start server (local)
echo   [2] Start tunnel (NPort - permanent URL)
echo   [3] Start both (server + tunnel)
echo   [4] Stop all
echo   [5] Check server status
echo   [0] Exit
echo.
echo ================================================
echo.
set /p choice="Select action (0-5): "

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto start_tunnel
if "%choice%"=="3" goto start_both
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" goto check_server
if "%choice%"=="0" goto end
goto menu

:start_server
cls
echo ================================================
echo   Starting server...
echo ================================================
echo.
start /b "" node server/server.js
if %errorlevel% neq 0 (
    echo   ERROR! Check that node is installed
    pause
    goto menu
)
timeout /t 2 /nobreak >nul
echo   OK Server running on http://localhost:3000
echo.
pause
goto menu

:start_tunnel
cls
echo ================================================
echo   Starting NPort tunnel...
echo ================================================
echo.
echo   Server must be running first! (option 1)
echo.
echo   Permanent URL: https://w1ldauth.nport.link
echo   Launcher will auto-detect it!
echo.
echo   To stop tunnel - press Ctrl+C
echo.
pause
powershell -ExecutionPolicy Bypass -File run_tunnel.ps1
echo.
echo   Tunnel stopped.
pause
goto menu

:start_both
cls
echo ================================================
echo   Starting server + tunnel...
echo ================================================
echo.
echo  [1/2] Starting server...
start /b "" node server/server.js
timeout /t 3 /nobreak >nul
echo   OK Server running on http://localhost:3000
echo.
echo  [2/2] Starting NPort tunnel...
echo.
echo   Permanent URL: https://w1ldauth.nport.link
echo   Launcher will auto-detect it!
echo.
pause
powershell -ExecutionPolicy Bypass -File run_tunnel.ps1
echo.
echo   Tunnel stopped.
pause
goto menu

:stop_all
cls
echo ================================================
echo   Stopping all...
echo ================================================
echo.
taskkill /f /im node.exe 2>nul
taskkill /f /im cloudflared.exe 2>nul
echo   OK All stopped!
echo.
pause
goto menu

:check_server
cls
echo ================================================
echo   Checking server...
echo ================================================
echo.
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/login' -Method POST -ContentType 'application/json' -Body '{\"username\":\"test\",\"password\":\"test\"}' -UseBasicParsing -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel%==0 (
    echo   OK Server is running!
) else (
    echo   FAIL Server is not running!
    echo   Start it with option [1] or [3]
)
echo.
pause
goto menu

:end
cls
echo.
echo   Thanks for using W1ld Auth Server!
echo.
timeout /t 2 /nobreak >nul
exit