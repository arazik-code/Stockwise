#!/usr/bin/env bash
# Nightly backup of the StockManagement Postgres database running inside the
# docker-compose.prod.yml stack on the VPS. Port to tools/backup-db.ps1 (the Windows desktop
# equivalent) - same -Fc compressed format, same 30-daily + 1-permanent-monthly retention.
#
# Runs pg_dump INSIDE the postgres container via `docker compose exec`, rather than needing a
# host-level pg_dump install or exposing Postgres's port to the host - consistent with
# docker-compose.prod.yml deliberately never publishing Postgres's port.
#
# Intended to run via cron, e.g.:
#   0 3 * * * /opt/flexshoes/deploy/backup-vps.sh >> /var/log/flexshoes-backup.log 2>&1
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/flexshoes/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/flexshoes/backups}"
DAILY_RETENTION_DAYS="${DAILY_RETENTION_DAYS:-30}"

DAILY_DIR="$BACKUP_DIR/daily"
MONTHLY_DIR="$BACKUP_DIR/monthly"
mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

STAMP=$(date +%Y%m%d_%H%M%S)
DAILY_FILE="$DAILY_DIR/sms_$STAMP.dump"

echo "Backing up StockManagement to $DAILY_FILE ..."
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -Fc -U postgres -d StockManagement > "$DAILY_FILE"

SIZE_KB=$(( $(stat -c%s "$DAILY_FILE") / 1024 ))
echo "OK: $DAILY_FILE (${SIZE_KB} KB)"

# Keep exactly one permanent copy per calendar month (the first daily dump of the month)
MONTH_TAG=$(date +%Y%m)
MONTHLY_FILE="$MONTHLY_DIR/sms_$MONTH_TAG.dump"
if [ ! -f "$MONTHLY_FILE" ]; then
    cp "$DAILY_FILE" "$MONTHLY_FILE"
    echo "Archived monthly copy: $MONTHLY_FILE"
fi

# Retention: drop daily dumps older than N days
find "$DAILY_DIR" -name "sms_*.dump" -type f -mtime "+$DAILY_RETENTION_DAYS" -print -delete

echo "Backup complete."
