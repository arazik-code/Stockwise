#!/usr/bin/env bash
# First-time provisioning for the Hostinger VPS. Idempotent - safe to re-run.
#
# Prerequisites (do these BEFORE running this script - see deploy/VPS-DEPLOY.md for the full
# walkthrough):
#   1. DNS: point your domain's A record at this VPS's public IP.
#   2. Get the code onto the VPS at /opt/flexshoes (git clone, or scp/rsync the repo up).
#   3. Fill in .env.prod at the repo root with real values (copy from .env.prod.example).
#
# Usage: sudo ./deploy/vps-setup.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/flexshoes}"

if [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: $REPO_DIR not found. Get the code onto the VPS there first (git clone or rsync)." >&2
    exit 1
fi

if [ ! -f "$REPO_DIR/.env.prod" ]; then
    echo "ERROR: $REPO_DIR/.env.prod not found. Copy .env.prod.example to .env.prod and fill in real values first." >&2
    exit 1
fi

echo "== Installing Docker (if not already present) =="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

echo "== Configuring firewall (ufw) =="
if ! command -v ufw &>/dev/null; then
    apt-get update && apt-get install -y ufw
fi
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Deliberately NOT opening 5432 (Postgres) or 8080 (API) - only Caddy's 80/443 are meant to be
# reachable from the internet; everything else stays on the internal Docker network.
ufw --force enable

echo "== Building and starting the stack =="
cd "$REPO_DIR"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "== Setting up nightly backups (cron) =="
chmod +x "$REPO_DIR/deploy/backup-vps.sh"
CRON_LINE="0 3 * * * COMPOSE_FILE=$REPO_DIR/docker-compose.prod.yml BACKUP_DIR=$REPO_DIR/backups $REPO_DIR/deploy/backup-vps.sh >> /var/log/flexshoes-backup.log 2>&1"
# grep -v exits 1 when nothing matches (the normal first-run case: no prior crontab at all) -
# harmless here, but `set -e` would otherwise abort the whole script on that exit code.
( crontab -l 2>/dev/null | grep -Fv "backup-vps.sh" || true ; echo "$CRON_LINE" ) | crontab -

echo ""
echo "Done. Check status with:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  curl https://\$(grep DOMAIN $REPO_DIR/.env.prod | cut -d= -f2)/api/health"
