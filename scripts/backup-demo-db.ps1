param(
    [string]$OutputDirectory = ".\backups"
)
$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "burnettpeople-demo-$timestamp.dump"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$backupPath = Join-Path $OutputDirectory $backupName

$composeArgs = @("--env-file", ".env.production", "-f", "docker-compose.production.yml")
$containerId = docker compose @composeArgs ps -q db
if (-not $containerId) { throw "Database container is not running. Start the production/demo compose stack first." }

# Write the binary custom-format dump inside the container, then docker-cp it.
# This avoids PowerShell text-redirection corrupting a binary pg_dump stream.
docker compose @composeArgs exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/burnettpeople-demo.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
docker cp "${containerId}:/tmp/burnettpeople-demo.dump" $backupPath
if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }
docker compose @composeArgs exec -T db rm -f /tmp/burnettpeople-demo.dump | Out-Null

if (-not (Test-Path $backupPath) -or (Get-Item $backupPath).Length -lt 1024) {
    throw "Backup file is missing or unexpectedly small: $backupPath"
}
Write-Host "Backup created: $backupPath"
Write-Host "Next, validate it using scripts/verify-demo-db-backup.ps1 -BackupFile `"$backupPath`""
