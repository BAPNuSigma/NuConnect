@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js not found. Install from https://nodejs.org & exit /b 1)
if not exist node_modules (echo Installing dependencies... & call npm install)
if not exist data (mkdir data & echo Pushing schema... & call npx drizzle-kit push)
echo Starting http://localhost:3000
call npm run dev
