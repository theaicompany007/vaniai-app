<#
.SYNOPSIS
  Sync .env.local to VM, apply dev/prod mode (set-env-mode.sh), and restart vaniai container.
  No git push/pull, no image rebuild — use when you only changed env (e.g. BYPASS_USAGE_LIMITS).

.DESCRIPTION
  1. Copy .env.local to VM (/home/postgres/vaniai-app/.env.local)
  2. On VM: run set-env-mode.sh [dev|prod] → updates .env.local sections and generates .env
  3. On VM: ./manage-vaniai-app.sh restart

.PARAMETER Environment
  dev | prod — which block in .env.local to activate (NEXT_PUBLIC_APP_URL, EMAIL_FROM, etc.).

.EXAMPLE
  .\sync-env-and-restart-vaniai.ps1 -Environment prod
  .\sync-env-and-restart-vaniai.ps1 -Environment dev
#>

param(
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'prod'
)

$ErrorActionPreference = 'Stop'

$VmHost     = 'chroma-vm'
$VmUser     = 'postgres'
$GcpZone    = 'asia-south1-a'
$GcpProject = 'onlynereputation-agentic'
$LocalProjectPath  = $PSScriptRoot
$RemoteProjectPath = '/home/postgres/vaniai-app'

function Write-Step { param([string]$Message); Write-Host "`n======== $Message ========`n" -ForegroundColor Cyan }
function Write-Info   { param([string]$Message); Write-Host "  [INFO] $Message" -ForegroundColor Gray }
function Write-Success { param([string]$Message); Write-Host "  [OK] $Message" -ForegroundColor Green }
function Write-Err    { param([string]$Message); Write-Host "  [ERROR] $Message" -ForegroundColor Red }

function Invoke-Ssh { param([string]$Command)
    $target = "${VmUser}@${VmHost}"
    & gcloud compute ssh $target --zone=$GcpZone --project=$GcpProject --command=$Command 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SSH failed: $LASTEXITCODE" }
}

function Invoke-Scp { param([string]$Source, [string]$Destination)
    $target = "${VmUser}@${VmHost}"
    Write-Info "Copy: $(Split-Path $Source -Leaf) -> $Destination"
    & gcloud compute scp $Source "${target}:${Destination}" --zone=$GcpZone --project=$GcpProject 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "SCP failed: $LASTEXITCODE" }
}

# ---------- 1. Copy .env.local ----------
Write-Step 'Step 1: Copy .env.local to VM'
$envLocal = Join-Path $LocalProjectPath '.env.local'
if (-not (Test-Path $envLocal)) {
    Write-Err '.env.local not found in project root.'
    exit 1
}
Invoke-Ssh "mkdir -p $RemoteProjectPath"
Invoke-Scp $envLocal ($RemoteProjectPath + '/.env.local')
Write-Success 'Copied .env.local'

# ---------- 2. set-env-mode.sh (dev/prod) → .env ----------
Write-Step 'Step 2: Apply env mode (set-env-mode.sh)'
try {
    Invoke-Ssh "cd $RemoteProjectPath; bash set-env-mode.sh $Environment 2>&1"
    Write-Success "Env mode set to: $Environment (.env generated)"
} catch {
    Write-Err "set-env-mode.sh failed: $_"
    Write-Info 'Ensure .env.local has # --- DEV --- and # --- PROD --- sections.'
    exit 1
}

# ---------- 3. Restart container ----------
Write-Step 'Step 3: Restart vaniai container'
try {
    $out = Invoke-Ssh "cd $RemoteProjectPath; ./manage-vaniai-app.sh restart 2>&1"
    Write-Host $out
    Write-Success 'Container restarted'
} catch {
    Write-Err "Restart failed: $_"
    Write-Info "On VM run: cd $RemoteProjectPath; ./manage-vaniai-app.sh status"
    exit 1
}

Write-Host ''
Write-Success 'Done. Env synced and vaniai restarted (no rebuild).'
Write-Host '  Production: https://vaniai.theaicompany.co' -ForegroundColor Gray
Write-Host ''
