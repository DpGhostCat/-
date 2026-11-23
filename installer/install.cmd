@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "TARGET=%LOCALAPPDATA%\Xunye"
set "PAYLOAD=%~dp0payload.zip"

if not exist "%PAYLOAD%" (
  echo Installation payload not found.
  pause
  exit /b 1
)

echo Installing Xunye to "%TARGET%"...
if not exist "%TARGET%" mkdir "%TARGET%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:PAYLOAD -DestinationPath $env:TARGET -Force"
if errorlevel 1 (
  echo Failed to extract application files.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $start=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'; foreach($dir in @($desktop,$start)){ $link=$ws.CreateShortcut((Join-Path $dir 'Xunye.lnk')); $link.TargetPath=Join-Path $env:TARGET 'Xunye.vbs'; $link.WorkingDirectory=$env:TARGET; $link.IconLocation=Join-Path $env:TARGET 'xunye.ico'; $link.Description='Xunye reading and writing platform'; $link.Save() }"
if errorlevel 1 (
  echo Application installed, but shortcuts could not be created.
)

start "" wscript.exe "%TARGET%\Xunye.vbs"
exit /b 0
