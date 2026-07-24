@echo off
chcp 65001 >nul
title W1ld Launcher Update Manager
mode con: cols=72 lines=18

for /f %%i in ('echo prompt $E ^| cmd') do set "ESC=%%i"

cls
echo %ESC%[38;5;67m======================================================================%ESC%[0m
echo %ESC%[38;5;67m=%ESC%[38;5;231m  W1ld Launcher Update Manager%ESC%[38;5;67m                              =%ESC%[0m
echo %ESC%[38;5;67m======================================================================%ESC%[0m
echo.
echo %ESC%[38;5;245m  This script updates the launcher version on the server.%ESC%[0m
echo %ESC%[38;5;245m  After building a new exe, run this to publish the update.%ESC%[0m
echo.
echo %ESC%[38;5;67m----------------------------------------------------------------------%ESC%[0m
echo.

set /p NEWVER=%ESC%[38;5;221m  Enter new version (e.g. 1.1.0): %ESC%[0m
if "%NEWVER%"=="" (
    echo %ESC%[38;5;203m  [ERROR] Version cannot be empty!%ESC%[0m
    pause >nul
    exit /b
)

set /p CHANGELOG=%ESC%[38;5;221m  Enter changelog: %ESC%[0m
if "%CHANGELOG%"=="" set CHANGELOG=Bug fixes and improvements

echo.
echo %ESC%[38;5;67m----------------------------------------------------------------------%ESC%[0m
echo %ESC%[38;5;102m  [INFO]%ESC%[0m %ESC%[38;5;231mUpdating launcher-version.json...%ESC%[0m
echo.

:: Write JSON using node (safe for special characters)
node -e "const fs=require('fs'); const ver=process.argv[1]; const cl=process.argv[2]; fs.writeFileSync('launcher-version.json', JSON.stringify({version:ver, changelog:cl}, null, 4)); console.log('Version updated to ' + ver);" "%NEWVER%" "%CHANGELOG%"

echo.
echo %ESC%[38;5;67m----------------------------------------------------------------------%ESC%[0m
echo %ESC%[38;5;156m  [DONE]%ESC%[0m %ESC%[38;5;231mVersion: %NEWVER%%ESC%[0m
echo %ESC%[38;5;156m  [DONE]%ESC%[0m %ESC%[38;5;231mChangelog: %CHANGELOG%%ESC%[0m
echo.
echo %ESC%[38;5;245m  Make sure the new exe is built at:%ESC%[0m
echo %ESC%[38;5;51m  loader\dist\W1ld Launcher %NEWVER%.exe%ESC%[0m
echo.
echo %ESC%[38;5;245m  Restart the auth server to apply changes.%ESC%[0m
echo %ESC%[38;5;67m----------------------------------------------------------------------%ESC%[0m
echo.
pause >nul
