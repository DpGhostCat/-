@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 goto run_global
if exist ".runtime\node\node.exe" goto run_local

echo.
echo Node.js is not installed.
echo Install Node.js 24+ from https://nodejs.org/ and run this file again.
echo.
pause
exit /b 1

:run_local
set "NODE_EXE=.runtime\node\node.exe"
goto start_server

:run_global
set "NODE_EXE=node"

:start_server
echo.
echo XUNYE is starting...
echo Mobile: http://localhost:3000
echo Admin:  http://localhost:3000/admin
echo Close this window to stop the server.
echo.
"%NODE_EXE%" server\index.js
pause
