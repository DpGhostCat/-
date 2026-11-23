@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-NetTCPConnection -LocalPort 3777 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){Stop-Process -Id $p.OwningProcess -Force; Write-Host 'Xunye stopped.'}else{Write-Host 'Xunye is not running.'}"
pause
