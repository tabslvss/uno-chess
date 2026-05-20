# UNO Chess — install Render CLI, log in, deploy API from GitHub, wire Vercel
# Run from repo root:  .\scripts\setup-render.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

$RenderVersion = "v2.17.0"
$RenderDir = Join-Path $env:LOCALAPPDATA "render-cli"
$RenderExe = Join-Path $RenderDir "cli_v2.17.0.exe"
$RenderZip = Join-Path $env:TEMP "render-cli.zip"
$RenderUrl = "https://github.com/render-oss/cli/releases/download/$RenderVersion/cli_2.17.0_windows_amd64.zip"

function Get-DotEnvValue([string]$Key) {
    $envFile = Join-Path $RepoRoot ".env"
    if (-not (Test-Path $envFile)) {
        throw "Missing .env in $RepoRoot — run Supabase setup first."
    }
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*#") { continue }
        if ($line -match "^\s*$Key\s*=\s*(.+)\s*$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    throw ".env is missing $Key"
}

function Ensure-RenderCli {
    if (Test-Path $RenderExe) { return }
    Write-Host "Downloading Render CLI $RenderVersion..."
    Invoke-WebRequest -Uri $RenderUrl -OutFile $RenderZip -UseBasicParsing
    New-Item -ItemType Directory -Force -Path $RenderDir | Out-Null
    tar -xf $RenderZip -C $RenderDir
    if (-not (Test-Path $RenderExe)) {
        throw "Render CLI not found after extract. Expected $RenderExe"
    }
}

function Invoke-Render([string[]]$Args) {
    & $RenderExe @Args
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Ensure-RenderCli
Write-Host "Render CLI: $RenderExe"

$whoami = & $RenderExe whoami -o text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Log in to Render (browser opens). Approve the device code when prompted."
    Invoke-Render @("login", "-o", "text")
}

Invoke-Render @("whoami", "-o", "text")

$supabaseUrl = Get-DotEnvValue "SUPABASE_URL"
$serviceKey = Get-DotEnvValue "SUPABASE_SERVICE_ROLE_KEY"
$allowedOrigins = "https://uno-chess.vercel.app"
$githubRepo = "https://github.com/tabslvss/uno-chess"

Write-Host ""
Write-Host "Checking for existing unochess-api service..."
$servicesJson = & $RenderExe services -o json 2>&1 | Out-String
$existing = $null
try {
    $list = $servicesJson | ConvertFrom-Json
    $existing = $list | Where-Object { $_.name -eq "unochess-api" } | Select-Object -First 1
} catch {
    # JSON parse may fail on empty workspace
}

if ($existing) {
    $serviceId = $existing.id
    Write-Host "Service exists: $serviceId — triggering deploy..."
    Invoke-Render @("deploys", "create", $serviceId, "--confirm", "-o", "text")
} else {
    Write-Host "Creating unochess-api from $githubRepo ..."
    Invoke-Render @(
        "services", "create",
        "--name", "unochess-api",
        "--type", "web_service",
        "--repo", $githubRepo,
        "--branch", "main",
        "--runtime", "node",
        "--plan", "free",
        "--region", "oregon",
        "--build-command", "npm install",
        "--start-command", "npm run start:server",
        "--health-check-path", "/health",
        "--env-var", "NODE_ENV=production",
        "--env-var", "SUPABASE_URL=$supabaseUrl",
        "--env-var", "SUPABASE_SERVICE_ROLE_KEY=$serviceKey",
        "--env-var", "ALLOWED_ORIGINS=$allowedOrigins",
        "--confirm", "-o", "json"
    )
    $created = & $RenderExe services -o json | ConvertFrom-Json
    $existing = $created | Where-Object { $_.name -eq "unochess-api" } | Select-Object -First 1
    $serviceId = $existing.id
}

$serviceUrl = $existing.serviceDetails.url
if (-not $serviceUrl) {
    $serviceUrl = "https://unochess-api.onrender.com"
}

Write-Host ""
Write-Host "API URL (use for VITE_SERVER_URL): $serviceUrl"
Write-Host "Health check: $serviceUrl/health"
Write-Host ""

$healthOk = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "$serviceUrl/health" -TimeoutSec 15
        if ($r.ok) { $healthOk = $true; break }
    } catch { }
    Write-Host "Waiting for deploy... ($($i + 1)/12)"
    Start-Sleep -Seconds 15
}

if ($healthOk) {
    Write-Host "Health check OK."
} else {
    Write-Host "Service not healthy yet — check https://dashboard.render.com"
}

Write-Host ""
Write-Host "Setting VITE_SERVER_URL on Vercel (production)..."
$env:VERCEL_TOKEN = $null
echo $serviceUrl | npx vercel env add VITE_SERVER_URL production --force 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Redeploying Vercel..."
    npx vercel deploy --prod --yes
} else {
    Write-Host "Vercel env failed — run manually:"
    Write-Host "  echo $serviceUrl | npx vercel env add VITE_SERVER_URL production"
    Write-Host "  npx vercel deploy --prod --yes"
}

Write-Host ""
Write-Host "Done. Live site: https://uno-chess.vercel.app"
