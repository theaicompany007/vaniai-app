<#
.SYNOPSIS
  Complete Vani AI App Deployment - Windows to chroma-vm (gcc).

.DESCRIPTION
  Production URL: https://vaniai.theaicompany.co
  Resend domain:  vaniai.theaicompany.co

  Workflow:
  1. Push code to GitHub (SSH/HTTPS auto-detect)
  2. SSH to VM: pull or clone vaniai-app
  3. Copy .env.local, normalize line endings, create .env for Docker
  4. Apply prod overrides when -VaniaAIEnvironment prod: NEXT_PUBLIC_APP_URL, EMAIL_FROM (Resend)
  5. Set permissions on .sh scripts
  6. Run manage-vaniai-app.sh full-deploy
  7. Check status

.PARAMETER VaniaAIEnvironment
  'prod' (default): set NEXT_PUBLIC_APP_URL=https://vaniai.theaicompany.co, EMAIL_FROM=noreply@vaniai.theaicompany.co on VM
  'dev': leave .env as-is on VM

.PARAMETER SkipPush, SkipDeploy, CommitMessage, AutoCommit, FreshClone, GitHubMethod, Help
  Same semantics as deploy-theaicompany-web-complete.ps1
#>

param(
    [switch]$SkipPush = $false,
    [switch]$SkipDeploy = $false,
    [string]$CommitMessage = '',
    [switch]$AutoCommit = $false,
    [switch]$FreshClone = $false,
    [Alias('h')]
    [switch]$Help = $false,
    [ValidateSet('ssh', 'https', 'auto')]
    [string]$GitHubMethod = 'auto',
    [ValidateSet('dev', 'prod')]
    [string]$VaniaAIEnvironment = 'prod'
)

$ErrorActionPreference = 'Stop'

# ========== CONFIG ==========
$dq = [char]34
$VmHost = 'chroma-vm'
$VmUser = 'postgres'
$SshKeyPath = ''
$DeployMethod = 'gcloud'
$GcpZone = 'asia-south1-a'
$GcpProject = 'onlynereputation-agentic'

$LocalProjectPath = $PSScriptRoot
$RemoteProjectPath = '/home/postgres/vaniai-app'
$GitHubRepoSsh = 'git@github.com:theaicompany007/vaniai-app.git'
$GitHubRepoHttps = 'https://github.com/theaicompany007/vaniai-app.git'

$ProdAppUrl = 'https://vaniai.theaicompany.co'
$ProdEmailFrom = 'noreply@vaniai.theaicompany.co'

# GitHub method
$useHttpsMethod = $false
if ($GitHubMethod -eq 'https') { $useHttpsMethod = $true }
elseif ($GitHubMethod -eq 'auto') {
    $currentRemote = git config --get remote.origin.url 2>$null
    if ($currentRemote -match '^https://') { $useHttpsMethod = $true; Write-Host '  [INFO] Using HTTPS' -ForegroundColor Cyan }
    else { Write-Host '  [INFO] Using SSH' -ForegroundColor Cyan }
}

# ========== HELP ==========
function Show-Help {
    Write-Host ''
    Write-Host '  Vani AI App - Deploy to chroma-vm' -ForegroundColor Cyan
    Write-Host ('  Production: ' + $ProdAppUrl) -ForegroundColor Gray
    Write-Host '  Resend domain: vaniai.theaicompany.co' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  -VaniaAIEnvironment  prod (default) | dev  - requires a value, e.g. -VaniaAIEnvironment prod'
    Write-Host '  -SkipPush            Skip git push'
    Write-Host '  -SkipDeploy          Only push, do not deploy to VM'
    Write-Host '  -FreshClone          Remove repo on VM and clone fresh'
    Write-Host '  -GitHubMethod        ssh | https | auto'
    Write-Host ''
    Write-Host '  Example: .\deploy-vaniai-app-complete.ps1 -VaniaAIEnvironment prod -FreshClone' -ForegroundColor Gray
    Write-Host ''
    exit 0
}
if ($Help) { Show-Help }

# ========== HELPERS ==========
function Write-Step { param([string]$Message, [string]$Color = 'Yellow'); $nl = [char]10; Write-Host ($nl + '======== ' + $Message + ' ========' + $nl) -ForegroundColor $Color }
function Write-Info { param([string]$Message); Write-Host ('  [INFO] ' + $Message) -ForegroundColor Cyan }
function Write-Success { param([string]$Message); Write-Host ('  [OK] ' + $Message) -ForegroundColor Green }
function Write-Error { param([string]$Message); Write-Host ('  [ERROR] ' + $Message) -ForegroundColor Red }
function Write-Warning { param([string]$Message); Write-Host ('  [WARN] ' + $Message) -ForegroundColor Yellow }

function Invoke-SshCommand { param([string]$Command, [switch]$NoOutput = $false)
    $sshTarget = $VmUser + '@' + $VmHost
    if ($DeployMethod -eq 'gcloud') {
        if ($NoOutput) { & gcloud compute ssh $sshTarget --zone=$GcpZone --project=$GcpProject --command=$Command 2>&1 | Out-Null }
        else { $result = & gcloud compute ssh $sshTarget --zone=$GcpZone --project=$GcpProject --command=$Command 2>&1; return $result }
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 17) { throw ('SSH failed: ' + $LASTEXITCODE) }
    } else {
        if ($SshKeyPath -and (Test-Path $SshKeyPath)) {
            if ($NoOutput) { & ssh -i $SshKeyPath $sshTarget $Command 2>&1 | Out-Null }
            else { return & ssh -i $SshKeyPath $sshTarget $Command 2>&1 }
        } else {
            if ($NoOutput) { & ssh $sshTarget $Command 2>&1 | Out-Null }
            else { return & ssh $sshTarget $Command 2>&1 }
        }
        if ($LASTEXITCODE -ne 0) { throw ('SSH failed: ' + $LASTEXITCODE) }
    }
}

function Invoke-ScpCommand { param([string]$Source, [string]$Destination)
    $sshTarget = $VmUser + '@' + $VmHost
    Write-Info ('Copy: ' + (Split-Path $Source -Leaf) + ' -> ' + $Destination)
    if ($DeployMethod -eq 'gcloud') {
        & gcloud compute scp $Source ($sshTarget + ':' + $Destination) --zone=$GcpZone --project=$GcpProject 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $fileBytes = [System.IO.File]::ReadAllBytes($Source)
            $b64 = [Convert]::ToBase64String($fileBytes)
            $destDir = Split-Path $Destination -Parent
            if ($destDir) { Invoke-SshCommand ('mkdir -p ' + $dq + $destDir + $dq) -NoOutput }
            Invoke-SshCommand ('echo ''' + $b64 + ''' | base64 -d > ' + $dq + $Destination + $dq) -NoOutput
            Write-Success 'Copied via base64 fallback'
        }
    } else {
        if ($SshKeyPath -and (Test-Path $SshKeyPath)) { & scp -i $SshKeyPath $Source ($sshTarget + ':' + $Destination) 2>&1 | Out-Null }
        else { & scp $Source ($sshTarget + ':' + $Destination) 2>&1 | Out-Null }
        if ($LASTEXITCODE -ne 0) { throw 'SCP failed' }
    }
}

function Configure-GitRemote { param([bool]$UseHttps)
    $currentRemote = git config --get remote.origin.url 2>$null
    if ($UseHttps) {
        if ($currentRemote -match '^git@') { git remote set-url origin $GitHubRepoHttps; Write-Success 'Remote set to HTTPS' }
    } else {
        if ($currentRemote -match '^https://') { git remote set-url origin $GitHubRepoSsh; Write-Success 'Remote set to SSH' }
    }
}

# ========== STEP 1: PUSH ==========
if (-not $SkipPush) {
    Write-Step 'Step 1: Push to GitHub' 'Yellow'
    if (-not (Test-Path '.git')) { Write-Error 'Not a git repo'; exit 1 }
    Configure-GitRemote -UseHttps $useHttpsMethod
    $status = git status --porcelain
    $branch = git rev-parse --abbrev-ref HEAD
    if ($status -and $status.Trim() -ne '') {
        if (-not $AutoCommit -and [string]::IsNullOrWhiteSpace($CommitMessage)) {
            $CommitMessage = Read-Host 'Commit message (Enter for default)'
        }
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) { $CommitMessage = 'Vani AI App update - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
        git add -A; git commit -m $CommitMessage
        Write-Success 'Committed'
    }
    try {
        $pushOut = & git push origin $branch 2>&1 | Out-String
        # "Everything up-to-date" is success (nothing new to push)
        if ($pushOut -match 'Everything up-to-date') {
            Write-Success 'Repository is up-to-date (nothing to push)'
        } elseif ($pushOut -match 'Permission denied|fatal:.*failed|ERROR') {
            if (-not $useHttpsMethod) {
                Configure-GitRemote -UseHttps $true
                & git push origin $branch 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
                Write-Success 'Pushed via HTTPS fallback'
            } else { throw 'Push failed' }
        } else {
            Write-Success 'Pushed to GitHub'
        }
    } catch {
        Write-Error ('Push failed: ' + $_)
        exit 1
    }
} else { Write-Step 'Step 1: Skip Push' 'Yellow' }

if ($SkipDeploy) { Write-Host 'Deploy skipped (-SkipDeploy).' -ForegroundColor Yellow; exit 0 }

# ========== STEP 2: PULL/CLONE ON VM ==========
Write-Step 'Step 2: Update code on VM' 'Yellow'
$checkCmd = 'test -d ' + $RemoteProjectPath + ' && echo exists || echo missing'
$newline = [char]10; try { $projectExists = (Invoke-SshCommand $checkCmd) -replace $newline, '' } catch { $projectExists = 'missing' }

if ($FreshClone -and ($projectExists -match 'exists')) {
    Write-Info 'Removing existing project...'
    Invoke-SshCommand ('sudo rm -rf ' + $RemoteProjectPath) -NoOutput
}
if ($FreshClone -or ($projectExists -match 'missing')) {
    Write-Info 'Cloning from GitHub...'
    $cloneLines = @(
        'export GIT_SSH_COMMAND=''ssh -i /home/postgres/.ssh/id_ed25519_theaicompany -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -F /dev/null''',
        'cd /home/postgres',
        ('git clone ' + $GitHubRepoSsh + ' vaniai-app')
    )
    $cloneScript = $cloneLines -join [char]10
    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $cloneScript, (New-Object System.Text.UTF8Encoding $false))
    Invoke-ScpCommand $tmp '/tmp/clone-vaniai.sh'
    $runClone = 'chmod +x /tmp/clone-vaniai.sh; /tmp/clone-vaniai.sh 2>&1; rm -f /tmp/clone-vaniai.sh'
    Invoke-SshCommand $runClone
    Remove-Item $tmp -ErrorAction SilentlyContinue
    Write-Success 'Cloned'
} else {
    Write-Info 'Pulling latest...'
    $pullLines = @(
        'export GIT_SSH_COMMAND=''ssh -i /home/postgres/.ssh/id_ed25519_theaicompany -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -F /dev/null''',
        ('cd ' + $RemoteProjectPath),
        ('git remote set-url origin ' + $GitHubRepoSsh),
        'git pull origin main'
    )
    $pullScript = $pullLines -join [char]10
    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $pullScript, (New-Object System.Text.UTF8Encoding $false))
    Invoke-ScpCommand $tmp '/tmp/pull-vaniai.sh'
    $runPull = 'chmod +x /tmp/pull-vaniai.sh; /tmp/pull-vaniai.sh 2>&1; rm -f /tmp/pull-vaniai.sh'
    Invoke-SshCommand $runPull
    Remove-Item $tmp -ErrorAction SilentlyContinue
    Write-Success 'Pulled'
}

# ========== STEP 3: .env.local + set-env-mode (dev/prod segregation) ==========
Write-Step 'Step 3: Configure .env for VM' 'Yellow'
$envLocalPath = Join-Path $LocalProjectPath '.env.local'
if (-not (Test-Path $envLocalPath)) {
    Write-Warning '.env.local not found locally; skip copy'
} else {
    Invoke-ScpCommand $envLocalPath ($RemoteProjectPath + '/.env.local')
    Write-Success 'Copied .env.local'
    Write-Info ('Running set-env-mode.sh ' + $VaniaAIEnvironment + ' (comment dev / enable prod or vice versa)...')
    try {
        $setEnvCmd = 'cd ' + $RemoteProjectPath + '; chmod +x set-env-mode.sh 2>/dev/null; ./set-env-mode.sh ' + $VaniaAIEnvironment + ' 2>&1'
        Invoke-SshCommand $setEnvCmd
        Write-Success ('Env mode set to ' + $VaniaAIEnvironment + '; .env generated for container')
    } catch {
        Write-Warning ('set-env-mode.sh failed: ' + $_)
        Write-Info 'Ensure .env.local has # --- DEV --- and # --- PROD --- sections. See set-env-mode.sh for format.'
    }
}

# ========== STEP 4: PERMISSIONS ==========
Write-Step 'Step 4: Script permissions' 'Yellow'
$chmodCmd = 'cd ' + $RemoteProjectPath + '; find . -name ' + $dq + '*.sh' + $dq + ' -type f -exec chmod +x {} \;'
Invoke-SshCommand $chmodCmd -NoOutput
Write-Success 'chmod +x *.sh'

# ========== STEP 4b: Write deploy environment (dev/prod) for supabase_post_deploy.sh ==========
Write-Info ('Setting deploy environment to ''' + $VaniaAIEnvironment + ''' (used by supabase_post_deploy.sh)')
Invoke-SshCommand ('echo ' + $VaniaAIEnvironment + ' > ' + $RemoteProjectPath + '/.deploy-environment') -NoOutput

# ========== STEP 5: FULL DEPLOY ==========
Write-Step 'Step 5: Full deploy (manage-vaniai-app.sh)' 'Yellow'
try {
    $deployCmd = 'cd ' + $RemoteProjectPath + '; ./manage-vaniai-app.sh full-deploy 2>&1'
    $out = Invoke-SshCommand $deployCmd
    Write-Host $out
    if ($out -match 'ERROR|Failed|fatal') {
        Write-Error 'Deploy may have failed; check output above'
        exit 1
    }
    Write-Success 'Deployment completed'
} catch {
    Write-Warning ('Deploy command error: ' + $_)
    Write-Host ('  Check on VM: cd ' + $RemoteProjectPath + '; ./manage-vaniai-app.sh status') -ForegroundColor Gray
}

# ========== STEP 6: STATUS ==========
Write-Step 'Step 6: Status' 'Yellow'
try {
    $psCmd = 'cd ' + $RemoteProjectPath + '; docker compose -p vaniai ps 2>&1'
    $ps = Invoke-SshCommand $psCmd
    Write-Host $ps
    $curlCmd = 'curl -s -o /dev/null -w ''%{http_code}'' http://localhost:3100 2>&1'
    $curl = Invoke-SshCommand $curlCmd 2>$null
    if ($curl -match '200|304') { Write-Success 'App responding on port 3100' } else { Write-Host ('  App check: ' + $curl) -ForegroundColor Gray }
} catch { Write-Warning ('Status: ' + $_) }

Write-Host ''
Write-Host ('  Done. Production: ' + $ProdAppUrl) -ForegroundColor Green
$logsCmd = '  Logs: gcloud compute ssh postgres@chroma-vm --zone=' + $GcpZone + ' --project=' + $GcpProject + ' --command=' + $dq + 'cd ' + $RemoteProjectPath + '; ./manage-vaniai-app.sh logs -f' + $dq
Write-Host $logsCmd -ForegroundColor Gray
Write-Host ''
