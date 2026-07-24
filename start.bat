@echo off
chcp 65001 >nul
title W1ld Auth Server
mode con: cols=78 lines=24

for /f %%i in ('echo prompt $E ^| cmd') do set "ESC=%%i"

cls
echo %ESC%[38;5;67m"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""%ESC%[0m
echo %ESC%[38;5;67m"                                                             "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m    _    _ _       _   _      ___     _    _      _   %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m   ^| ^|  ^| (_)     ^| ^| ^| ^|    / __^|   ^| ^|  ^| ^|    ^| ^|  %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m   ^| ^|__^| ^|_  ___ ^| ^|_^| ^|__ ^| ^|__    ^| ^|__^| ^| ___^| ^|_ %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m   ^|  __  ^| ^|/ _ \^| __^|  _  \^|  __^|   ^|  __  ^|/ _ \ __^| %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m   ^| ^|  ^| ^| ^| (_) ^| ^|_^| ^| ^| ^| ^|___   ^| ^|  ^| ^| (_) ^| ^|_ %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m   ^|_^|  ^|_^|_^|\___/^| \__^|_^| ^|_^|\____^|  ^|_^|  ^|_^|\___/ \__^| %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"                                                             "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;102mAuth Server%ESC%[38;5;67m  ::  %ESC%[38;5;102mv1.0.0%ESC%[38;5;67m  ::  %ESC%[38;5;102mPort 3000%ESC%[38;5;67m             "%ESC%[0m
echo %ESC%[38;5;67m"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""%ESC%[0m
echo.
echo %ESC%[38;5;245m  [INFO]%ESC%[0m %ESC%[38;5;231mStarting server...%ESC%[0m
echo.
echo %ESC%[38;5;245m  [TIP]%ESC%[0m %ESC%[38;5;231mAfter server starts, run %ESC%[38;5;51mstart_tunnel.bat%ESC%[38;5;231m for public access%ESC%[0m
echo %ESC%[38;5;245m  [TIP]%ESC%[0m %ESC%[38;5;231mWebsite: %ESC%[38;5;51mhttp://localhost:3000%ESC%[0m
echo %ESC%[38;5;245m  [TIP]%ESC%[0m %ESC%[38;5;231mAPI:    %ESC%[38;5;51m/login /register /stats /download-client%ESC%[0m
echo.
echo %ESC%[38;5;67m---------------------------------------------------------------%ESC%[0m
echo.

node server/server.js

echo.
echo %ESC%[38;5;203m  [ERROR] Server stopped!%ESC%[0m
echo %ESC%[38;5;245m  Press any key to exit...%ESC%[0m
pause >nul
