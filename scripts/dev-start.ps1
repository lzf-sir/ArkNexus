# ============================================================
# ArkNexus dev launcher: config-service + email-service + ai-service + gateway + frontend
# ============================================================
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$configDir   = Join-Path $root "backend\services\config-service"
$emailDir    = Join-Path $root "backend\services\email-service"
$gatewayDir  = Join-Path $root "backend\services\gateway"
$aiDir       = Join-Path $root "backend\services\ai-service"
$frontendDir = Join-Path $root "frontend"

Write-Host ""
Write-Host "[ArkNexus] Starting dev stack..." -ForegroundColor Cyan
Write-Host "  config-service: http://127.0.0.1:8081"
Write-Host "  email-service:  http://127.0.0.1:8000  (SMTP :1025)"
Write-Host "  ai-service:     http://127.0.0.1:8001"
Write-Host "  gateway:        http://127.0.0.1:8080"
Write-Host "  frontend:       http://127.0.0.1:5173"
Write-Host ""

# Resolve Python 3.13 (avoids relying on the 'py' launcher).
function Get-Python313 {
    $candidates = @(
        "C:\Users\Administrator\AppData\Local\Programs\Python\Python313\python.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
        "C:\Python313\python.exe",
        "C:\Program Files\Python313\python.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    # Last resort: ask the 'py' launcher.
    try {
        $out = & py -3.13 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) { return $out.Trim() }
    } catch {}
    return $null
}

$global:PYTHON313 = Get-Python313
if (-not $global:PYTHON313) {
    Write-Host "[ArkNexus] FATAL: Python 3.13 not found. Install it from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}
Write-Host "[ArkNexus] Using Python at $global:PYTHON313" -ForegroundColor DarkGray

function Ensure-Venv($dir) {
    if (-not (Test-Path (Join-Path $dir ".venv"))) {
        Write-Host "[ArkNexus] Creating venv in $dir ..." -ForegroundColor Yellow
        & $global:PYTHON313 -m venv (Join-Path $dir ".venv")
        & (Join-Path $dir ".venv\Scripts\python.exe") -m pip install --upgrade pip | Out-Null
        & (Join-Path $dir ".venv\Scripts\python.exe") -m pip install -r (Join-Path $dir "requirements.txt")
    }
    if (-not (Test-Path (Join-Path $dir ".env"))) {
        Copy-Item (Join-Path $dir ".env.example") (Join-Path $dir ".env")
    }
}

Ensure-Venv $configDir
Ensure-Venv $emailDir
Ensure-Venv $aiDir
Ensure-Venv $gatewayDir

# Initialize databases (idempotent).
& (Join-Path $configDir ".venv\Scripts\python.exe") (Join-Path $configDir "scripts\init_db.py")
& (Join-Path $emailDir  ".venv\Scripts\python.exe") (Join-Path $emailDir  "scripts\init_db.py")
& (Join-Path $aiDir     ".venv\Scripts\python.exe") (Join-Path $aiDir     "scripts\init_db.py")

# Inject config-service URL into email-service .env (the value is local by default).
$emailEnvPath = Join-Path $emailDir ".env"
$emailEnv = Get-Content $emailEnvPath -Raw
if ($emailEnv -notmatch "CONFIG_SERVICE_URL=http://127.0.0.1:8081") {
    $emailEnv = $emailEnv -replace "CONFIG_SERVICE_URL=", "CONFIG_SERVICE_URL=http://127.0.0.1:8081"
    [System.IO.File]::WriteAllText($emailEnvPath, $emailEnv, [System.Text.UTF8Encoding]::new($false))
}

# Inject ai-service URL into gateway .env (insert right after CONFIG_SERVICE_URL if not present).
$gatewayEnvPath = Join-Path $gatewayDir ".env"
$gatewayEnv = Get-Content $gatewayEnvPath -Raw
if ($gatewayEnv -notmatch "AI_SERVICE_URL=http://127.0.0.1:8001") {
    if ($gatewayEnv -match "AI_SERVICE_URL=") {
        $gatewayEnv = [regex]::Replace($gatewayEnv, "AI_SERVICE_URL=.*", "AI_SERVICE_URL=http://127.0.0.1:8001")
    } else {
        $gatewayEnv = [regex]::Replace($gatewayEnv, "(CONFIG_SERVICE_URL=.*)", "$1`r`nAI_SERVICE_URL=http://127.0.0.1:8001", 1)
    }
    [System.IO.File]::WriteAllText($gatewayEnvPath, $gatewayEnv, [System.Text.UTF8Encoding]::new($false))
}

# Start config-service first so email-service can register.
$configProc = Start-Process `
    -FilePath (Join-Path $configDir ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8081") `
    -WorkingDirectory $configDir `
    -PassThru
Write-Host "[ArkNexus] config-service pid=$($configProc.Id)" -ForegroundColor Green

Start-Sleep -Seconds 2

$aiProc = Start-Process `
    -FilePath (Join-Path $aiDir ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001") `
    -WorkingDirectory $aiDir `
    -PassThru
Write-Host "[ArkNexus] ai-service pid=$($aiProc.Id)" -ForegroundColor Green

Start-Sleep -Seconds 1

$emailProc = Start-Process `
    -FilePath (Join-Path $emailDir ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory $emailDir `
    -PassThru
Write-Host "[ArkNexus] email-service pid=$($emailProc.Id)" -ForegroundColor Green

$gatewayProc = Start-Process `
    -FilePath (Join-Path $gatewayDir ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8080") `
    -WorkingDirectory $gatewayDir `
    -PassThru
Write-Host "[ArkNexus] gateway pid=$($gatewayProc.Id)" -ForegroundColor Green

# Frontend
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "[ArkNexus] Installing frontend deps..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install --no-fund --no-audit | Out-Null
    Pop-Location
}
$frontendProc = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $frontendDir `
    -PassThru
Write-Host "[ArkNexus] frontend pid=$($frontendProc.Id)" -ForegroundColor Green

Write-Host ""
Write-Host "[ArkNexus] Open http://127.0.0.1:5173/login in your browser." -ForegroundColor Cyan
Write-Host "[ArkNexus] Press Ctrl+C in each window to stop." -ForegroundColor DarkGray

try {
    while (
        -not $configProc.HasExited -and
        -not $emailProc.HasExited -and
        -not $aiProc.HasExited -and
        -not $gatewayProc.HasExited -and
        -not $frontendProc.HasExited
    ) {
        Start-Sleep -Seconds 2
    }
}
finally {
    foreach ($p in @($configProc, $emailProc, $aiProc, $gatewayProc, $frontendProc)) {
        if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
}