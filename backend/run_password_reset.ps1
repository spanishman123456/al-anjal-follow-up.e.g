# One-click: set all app users' password to BabaMama1, then remove reset secret from .env
$ErrorActionPreference = "Stop"
$backendDir = $PSScriptRoot
$envPath = Join-Path $backendDir ".env"
$apiUrl = "http://127.0.0.1:8000/api/auth/reset-all-passwords"
$secret = "reset-once-babamama"

# Ensure secret is in .env
$envContent = Get-Content $envPath -Raw
if ($envContent -notmatch "RESET_PASSWORD_SECRET=") {
    $envContent = $envContent -replace "(JWT_SECRET=[^\r\n]+)", "`$1`r`nRESET_PASSWORD_SECRET=$secret"
    Set-Content $envPath $envContent -NoNewline
}

# Try to call the API (backend must be running)
$body = @{ secret = $secret; new_password = "BabaMama1" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -ContentType "application/json" -Body $body -TimeoutSec 15
    Write-Host "OK: $($response.updated_count) user(s) updated. You can now log in with password: BabaMama1"
} catch {
    Write-Host "Error: $_"
    Write-Host "Make sure the backend is running (e.g. run start_backend.bat or: python -m uvicorn server:app --reload --port 8000)"
    exit 1
}

# Remove RESET_PASSWORD_SECRET line from .env
$lines = Get-Content $envPath | Where-Object { $_ -notmatch "RESET_PASSWORD_SECRET" }
Set-Content $envPath $lines
Write-Host "Removed RESET_PASSWORD_SECRET from .env for security."
