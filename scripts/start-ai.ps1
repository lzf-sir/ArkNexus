# ============================================================
# Standalone launcher for ai-service only.
# Use this if the other services are already up and you only
# need to bring ai-service online.
# ============================================================
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$aiDir = Join-Path $root "backend\services\ai-service"

# Locate Python 3.13.
$candidates = @(
    "C:\Users\Administrator\AppData\Local\Programs\Python\Python313\python.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
    "C:\Python313\python.exe"
)
$python = $null
foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { $python = $c; break } }
if (-not $python) {
    try { $python = (& py -3.13 -c "import sys; print(sys.executable)" 2>$null).Trim() } catch {}
}
if (-not $python -or -not (Test-Path $python)) {
    Write-Host "Python 3.13 not found." -ForegroundColor Red
    exit 1
}
Write-Host "Using Python: $python" -ForegroundColor DarkGray

# Create venv if missing.
if (-not (Test-Path (Join-Path $aiDir ".venv"))) {
    Write-Host "Creating venv..." -ForegroundColor Yellow
    & $python -m venv (Join-Path $aiDir ".venv")
    & (Join-Path $aiDir ".venv\Scripts\python.exe") -m pip install --upgrade pip | Out-Null
    & (Join-Path $aiDir ".venv\Scripts\python.exe") -m pip install -r (Join-Path $aiDir "requirements.txt")
}
if (-not (Test-Path (Join-Path $aiDir ".env"))) {
    Copy-Item (Join-Path $aiDir ".env.example") (Join-Path $aiDir ".env")
}

# Run Alembic migrations.
Write-Host "[ArkNexus] Initialising ai-service database..." -ForegroundColor Cyan
& (Join-Path $aiDir ".venv\Scripts\python.exe") (Join-Path $aiDir "scripts\init_db.py")

# Inject AI_SERVICE_URL into gateway .env if needed.
$gatewayDir = Join-Path $root "backend\services\gateway"
$gatewayEnvPath = Join-Path $gatewayDir ".env"
if (Test-Path $gatewayEnvPath) {
    $envContent = Get-Content $gatewayEnvPath -Raw
    if ($envContent -notmatch "AI_SERVICE_URL=http://127.0.0.1:8001") {
        if ($envContent -match "AI_SERVICE_URL=") {
            $envContent = [regex]::Replace($envContent, "AI_SERVICE_URL=.*", "AI_SERVICE_URL=http://127.0.0.1:8001")
        } elseif ($envContent -match "CONFIG_SERVICE_URL=") {
            $envContent = [regex]::Replace($envContent, "(CONFIG_SERVICE_URL=.*)", "`$1`r`nAI_SERVICE_URL=http://127.0.0.1:8001", 1)
        } else {
            $envContent += "`r`nAI_SERVICE_URL=http://127.0.0.1:8001`r`n"
        }
        [System.IO.File]::WriteAllText($gatewayEnvPath, $envContent, [System.Text.UTF8Encoding]::new($false))
        Write-Host "[ArkNexus] Injected AI_SERVICE_URL into gateway/.env" -ForegroundColor Yellow
    }
}

# Kill any stale ai-service instance on 8001.
$existing = Get-NetTCPConnection -State Listen -LocalPort 8001 -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($c in $existing) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

# Launch ai-service.
Write-Host "[ArkNexus] Starting ai-service on http://127.0.0.1:8001 ..." -ForegroundColor Cyan
$proc = Start-Process `
    -FilePath (Join-Path $aiDir ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001") `
    -WorkingDirectory $aiDir `
    -PassThru
Write-Host "[ArkNexus] ai-service pid=$($proc.Id)" -ForegroundColor Green

# Wait for it to become reachable.
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            Write-Host "[ArkNexus] ai-service is up: $($r.Content)" -ForegroundColor Green
            exit 0
        }
    } catch {}
    Start-Sleep -Seconds 1
}
Write-Host "[ArkNexus] WARN: ai-service did not respond within 30s. Check its log window." -ForegroundColor Yellow
exit 1
