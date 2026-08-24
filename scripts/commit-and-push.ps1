# One-shot commit + push helper.
# Run this from the repo root in a regular PowerShell window
# (NOT from the Codex sandbox, which blocks writes to .git/index.lock).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Sanity: make sure we're in a git repo and there is something to commit.
if (-not (Test-Path ".git")) {
    Write-Host "FATAL: no .git directory here. Run this from the repo root." -ForegroundColor Red
    exit 1
}

# Refuse to commit if there are unstaged secrets (sanity check only).
$badPaths = @(".env", "*.sqlite", "*.db")
foreach ($p in $badPaths) {
    $hits = git ls-files --others --exclude-standard $p 2>$null
    if ($hits) {
        Write-Host "Refusing to commit potential secret: $p" -ForegroundColor Red
        Write-Host $hits
        exit 1
    }
}

git add -A
if (Test-Path "COMMIT_MESSAGE.txt") {
    git commit -F COMMIT_MESSAGE.txt
    Remove-Item COMMIT_MESSAGE.txt -Force
} else {
    Write-Host "FATAL: COMMIT_MESSAGE.txt missing at repo root." -ForegroundColor Red
    exit 1
}

git log --oneline -5
Write-Host ""
Write-Host "Done. To push, run: git push origin main" -ForegroundColor Cyan
