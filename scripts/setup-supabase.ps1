# UNO Chess — Supabase one-time setup (Windows PowerShell)
# Prerequisites: Node.js, a Supabase account, and optional Supabase CLI via npx

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "UNO Chess — Supabase setup" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example — edit it with your Supabase keys." -ForegroundColor Yellow
} else {
  Write-Host ".env already exists — skipping copy." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Steps:" -ForegroundColor Cyan
Write-Host "  1. Create a project at https://supabase.com/dashboard"
Write-Host "  2. Settings → API: copy Project URL, anon key, service_role key into .env"
Write-Host "  3. Run database migration (choose one):"
Write-Host "     A) Dashboard → SQL Editor → paste supabase/migrations/20250519000000_profiles.sql → Run"
Write-Host "     B) npx supabase login && npx supabase link --project-ref YOUR_REF && npx supabase db push"
Write-Host "  4. Auth → Providers: enable Email"
Write-Host "  5. npm run dev"
Write-Host ""

$runPush = Read-Host "Try 'npx supabase db push' now? (y/N)"
if ($runPush -eq "y" -or $runPush -eq "Y") {
  npx supabase db push
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration applied." -ForegroundColor Green
  } else {
    Write-Host "CLI push failed — use SQL Editor method above." -ForegroundColor Yellow
  }
}

Write-Host "Done." -ForegroundColor Green
