@echo off
setlocal enabledelayedexpansion
chcp 1251 >nul
title W1ld Launcher Manager v2.0
color 0B
cd /d "%~dp0"

set "LOADER_PATH=C:\Users\7ims (admin)\Desktop\loader"
set "RENDER_URL=https://w1ldloaderserver.onrender.com"
set "BASE_PATH=%~dp0"

:main_menu
cls
echo.
echo  ================================================================
echo.
echo     __        __ ___  _     ___
echo     \ \      / /^|_ _^|^| ^|   ^|   \
echo      \ \ /\ / /  ^| ^| ^| ^|   ^| ^|) ^|
echo       \ V  V /   ^| ^| ^| ^|___^|  _/
echo        \_/\_/   ^|___^|^|_____^|_^|
echo.
echo     М Е Н Е Д Ж Е Р   З А П У С К А   v 2 . 0
echo.
echo  ================================================================
echo.
echo   СЕРВЕР: !RENDER_URL!
echo   ЛОКАЛ:  http://localhost:3000
echo   ЛАУНЧ:  !LOADER_PATH!
echo.
echo  ----------------------------------------------------------------
echo.
echo   [1]  Запустить сервер (локально)
echo   [2]  Запустить сервер + лаунчер
echo   [3]  Остановить все процессы Node.js
echo   [4]  Обновить зависимости (npm install)
echo   [5]  Открыть папку логов
echo   [6]  Открыть сайт Render
echo   [7]  Открыть панель Render
echo   [8]  Инструменты лаунчера (сборка/dev/pack)
echo   [9]  Проверить состояние сервера
echo   [0]  Выход
echo.
echo  ----------------------------------------------------------------
echo.
choice /c 1234567890 /n /m "  Выберите действие: "

if errorlevel 10 goto end
if errorlevel 9 goto health
if errorlevel 8 goto launcher_tools
if errorlevel 7 goto render_dash
if errorlevel 6 goto render_site
if errorlevel 5 goto logs
if errorlevel 4 goto install
if errorlevel 3 goto stop
if errorlevel 2 goto start_all
if errorlevel 1 goto start_server

:start_server
cls
echo.
echo  ================================================================
echo   ЗАПУСК СЕРВЕРА...
echo  ================================================================
echo.
if not exist "server\server.js" (
    echo   [ОШИБКА] Файл server\server.js не найден!
    echo.
    pause
    goto main_menu
)
echo   [OK] Сервер запускается в новом окне...
echo.
echo  ================================================================
echo.
start "W1ld Server" cmd /k "node "!BASE_PATH!server\server.js""
echo   [OK] Окно сервера открыто.
echo.
pause
goto main_menu

:start_all
cls
echo.
echo  ================================================================
echo   ЗАПУСК СЕРВЕРА + ЛАУНЧЕРА
echo  ================================================================
echo.
if not exist "server\server.js" (
    echo   [ОШИБКА] Файл server\server.js не найден!
    pause
    goto main_menu
)
if not exist "!LOADER_PATH!\package.json" (
    echo   [ОШИБКА] Папка лаунчера не найдена.
    pause
    goto main_menu
)
echo   [1/2] Запуск сервера...
start "W1ld Server" cmd /k "node "!BASE_PATH!server\server.js""
timeout /t 3 /nobreak >nul
echo   [2/2] Запуск лаунчера...
start "W1ld Launcher" cmd /k "cd /d "!LOADER_PATH!" ^&^& npx electron ."
echo.
echo   [OK] Сервер: http://localhost:3000
echo   [OK] Лаунчер запущен.
echo.
echo  ================================================================
echo.
pause
goto main_menu

:stop
cls
echo.
echo  ================================================================
echo   ОСТАНОВКА ВСЕХ ПРОЦЕССОВ NODE.JS
echo  ================================================================
echo.
echo   [!] Будут завершены ВСЕ процессы node.exe!
echo.
pause
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Все процессы Node.js завершены.
) else (
    echo   [i] Процессы Node.js не найдены.
)
echo.
pause
goto main_menu

:install
cls
echo.
echo  ================================================================
echo   ОБНОВЛЕНИЕ ЗАВИСИМОСТЕЙ (npm install)
echo  ================================================================
echo.
call npm install
echo.
echo   [OK] Зависимости обновлены!
echo.
pause
goto main_menu

:logs
cls
echo.
echo  ================================================================
echo   ОТКРЫТИЕ ПАПКИ ЛОГОВ
echo  ================================================================
echo.
if exist "logs" (
    explorer "logs"
    echo   [OK] Папка логов открыта.
) else (
    echo   [!] Папка логов не найдена. Сначала запустите сервер.
)
echo.
pause
goto main_menu

:render_site
echo   [i] Открываю сайт Render...
start !RENDER_URL!
goto main_menu

:render_dash
echo   [i] Открываю панель Render...
start https://dashboard.render.com
goto main_menu

:launcher_tools
cls
echo.
echo  ================================================================
echo   ИНСТРУМЕНТЫ ЛАУНЧЕРА
echo  ================================================================
echo.
if not exist "!LOADER_PATH!\package.json" (
    echo   [ОШИБКА] Папка лаунчера не найдена.
    pause
    goto main_menu
)
echo   [1] Запустить в режиме разработки (npx electron .)
echo   [2] Собрать portable версию (npm run build)
echo   [3] Только упаковать (npm run pack)
echo   [4] Установить зависимости (npm install)
echo   [5] Назад в главное меню
echo.
choice /c 12345 /n /m "  Выберите действие: "

if errorlevel 5 goto main_menu
if errorlevel 4 goto l_install
if errorlevel 3 goto l_pack
if errorlevel 2 goto l_build
if errorlevel 1 goto l_dev

:l_dev
cls
echo   [i] Запуск лаунчера в режиме разработки...
echo.
pushd "!LOADER_PATH!"
call npx electron .
popd
pause
goto launcher_tools

:l_build
cls
echo   [i] Установка зависимостей...
pushd "!LOADER_PATH!"
call npm install
echo.
echo   [i] Сборка production версии...
call npm run build
echo.
echo   [OK] Сборка завершена!
popd
pause
goto launcher_tools

:l_pack
cls
echo   [i] Установка зависимостей...
pushd "!LOADER_PATH!"
call npm install
echo.
echo   [i] Упаковка приложения...
call npm run pack
echo.
echo   [OK] Упаковка завершена!
popd
pause
goto launcher_tools

:l_install
cls
echo   [i] Установка зависимостей...
pushd "!LOADER_PATH!"
call npm install
echo.
echo   [OK] Зависимости установлены!
popd
pause
goto launcher_tools

:health
cls
echo.
echo  ================================================================
echo   ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРА
echo  ================================================================
echo.
echo   [i] Проверяю !RENDER_URL!/health ...
echo.
powershell -Command "try { $r = Invoke-WebRequest -Uri '!RENDER_URL!/health' -UseBasicParsing -TimeoutSec 60; Write-Host '   [OK] Статус:' $r.StatusCode; Write-Host '   [OK] Ответ:' $r.Content } catch { Write-Host '   [ОШИБКА]' $_.Exception.Message }"
echo.
pause
goto main_menu

:end
cls
echo.
echo  ================================================================
echo.
echo     Спасибо за использование W1ld Launcher Manager!
echo.
echo  ================================================================
echo.
timeout /t 2 >nul
exit
