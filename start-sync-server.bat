@echo off
echo ============================================
echo  India Post Dashboard - Local Server (Sync)
echo ============================================
echo.

REM Load environment variables from .env.local
for /f "usebackq tokens=1,* delims==" %%a in (".env.local") do (
    set "%%a=%%b"
)

echo DATA_SYNC_URL: %DATA_SYNC_URL%
echo WORKER_API_TOKEN: %WORKER_API_TOKEN:~0,8%...
echo.

if "%WORKER_API_TOKEN%"=="REPLACE_WITH_YOUR_TOKEN" (
    echo ERROR: Please replace REPLACE_WITH_YOUR_TOKEN in .env.local
    echo with your actual WORKER_API_TOKEN from Cloudflare dashboard.
    echo.
    echo Get it from: Cloudflare Dashboard > Workers > dashv1-proxy > Settings > Variables
    pause
    exit /b 1
)

echo Starting server with sync enabled...
cd src\server
node start.js
pause
