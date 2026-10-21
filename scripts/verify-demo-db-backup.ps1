param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)
$ErrorActionPreference = "Stop"

$backupPath = (Resolve-Path $BackupFile).Path
$composeArgs = @("--env-file", ".env.production", "-f", "docker-compose.production.yml")
$containerId = docker compose @composeArgs ps -q db
if (-not $containerId) { throw "Database container is not running." }

$containerBackup = "/tmp/burnettpeople-restore-verify.dump"
docker cp $backupPath "${containerId}:$containerBackup"
if ($LASTEXITCODE -ne 0) { throw "Could not copy backup into the database container." }

# Restore into a separate disposable database. Never overwrite the live database.
docker compose @composeArgs exec -T db sh -c 'dropdb --if-exists -U "$POSTGRES_USER" burnettpeople_restore_verify && createdb -U "$POSTGRES_USER" burnettpeople_restore_verify'
if ($LASTEXITCODE -ne 0) { throw "Could not create the isolated verification database." }
docker compose @composeArgs exec -T db sh -c 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d burnettpeople_restore_verify /tmp/burnettpeople-restore-verify.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed. The backup has not passed validation." }
$migrationCount = docker compose @composeArgs exec -T db sh -c 'psql -U "$POSTGRES_USER" -d burnettpeople_restore_verify -Atc "SELECT COUNT(*) FROM django_migrations;"'
if ($LASTEXITCODE -ne 0 -or [int]$migrationCount.Trim() -lt 1) {
    throw "Restore verification failed: django_migrations missing or empty."
}
$coreTableCount = docker compose @composeArgs exec -T db sh -c 'psql -U "$POSTGRES_USER" -d burnettpeople_restore_verify -Atc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = ''public'' AND tablename IN (''django_migrations'', ''performance_management_dailystatusupdate'', ''performance_management_notification'');"'
if ($LASTEXITCODE -ne 0 -or [int]$coreTableCount.Trim() -lt 3) {
    throw "Restore verification failed: core Day 5 tables are missing. Ensure the backup was taken after migrations."
}
Write-Host "Restore verified into burnettpeople_restore_verify; migration rows: $($migrationCount.Trim()); core tables: $($coreTableCount.Trim())"
Write-Host "The disposable verification database is retained for manual spot checks. Drop it after review."
