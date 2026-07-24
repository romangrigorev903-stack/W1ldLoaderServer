@echo off
chcp 65001 >nul
title W1ld Tunnel - localhost.run
mode con: cols=78 lines=18

for /f %%i in ('echo prompt  ^| cmd') do set "ESC=%%i"

cls
echo %ESC%[38;5;67m"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""%ESC%[0m
echo %ESC%[38;5;67m"                                                             "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m  ___ _   _ ___ ___ ___ ___  ___  ___                   %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m ^| __^| ^| ^| __^| __/ __/ _ \/ _ \/ __^|                  %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m ^| _^| ^|_^| ^|_^| ^|_^| (_^| (_) ^| (_) \__ \                  %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;231m ^|___|\___/\__^|\___\___\___/ \___/^|___/                  %ESC%[38;5;67m  "%ESC%[0m
echo %ESC%[38;5;67m"                                                             "%ESC%[0m
echo %ESC%[38;5;67m"  %ESC%[38;5;102mlocalhost.run%ESC%[38;5;67m  ::  %ESC%[38;5;102mPublic Access%ESC%[38;5;67m              "%ESC%[0m
echo %ESC%[38;5;67m"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""%ESC%[0m
echo.
echo %ESC%[38;5;245m  [INFO]%ESC%[0m %ESC%[38;5;231mStarting tunnel...%ESC%[0m
echo.
echo %ESC%[38;5;245m  [STEP 1]%ESC%[0m %ESC%[38;5;231mCopy the URL that appears below%ESC%[0m
echo %ESC%[38;5;245m  [STEP 2]%ESC%[0m %ESC%[38;5;231mPaste it in Launcher %ESC%[38;5;51mSettings ^> Server URL%ESC%[0m
echo %ESC%[38;5;245m  [STEP 3]%ESC%[0m %ESC%[38;5;231mShare it with your friends!%ESC%[0m
echo.
echo %ESC%[38;5;67m---------------------------------------------------------------%ESC%[0m
echo %ESC%[38;5;51m  Your public URL:%ESC%[0m
echo %ESC%[38;5;245m  (look for: https://xxxx.lhr.life)%ESC%[0m
echo %ESC%[38;5;67m---------------------------------------------------------------%ESC%[0m
echo.

:tunnel_loop
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3000 nokey@localhost.run
echo.
echo %ESC%[38;5;203m  [WARNING] Tunnel disconnected! Reconnecting in 3s...%ESC%[0m
timeout /t 3 /nobreak >nul
goto tunnel_loop
