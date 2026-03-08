# NuConnect - run localhost (run this in a terminal where Node is installed)
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install from https://nodejs.org or open a terminal where Node is in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "Pushing database schema..." -ForegroundColor Yellow
    npx drizzle-kit push
}

Write-Host "Starting dev server at http://localhost:3000" -ForegroundColor Green
npm run dev
