@echo off
title Forge - build
cd /d "%~dp0"
set "BUN=bun"
if exist "runtime\bun.exe" set "BUN=runtime\bun.exe"

"%BUN%" run install || (echo install failed & pause & exit /b 1)
"%BUN%" run build    || (echo client build failed & pause & exit /b 1)
"%BUN%" run compile  || (echo compile failed & pause & exit /b 1)

echo.
echo Done: dist\ built and ForgeLauncher.exe ready.
pause
