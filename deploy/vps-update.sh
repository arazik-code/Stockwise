#!/usr/bin/env bash
# Deploy an update to the VPS: pull latest code, rebuild the api image (frontend gets rebuilt as
# part of the same image per deploy/Dockerfile.api.prod), restart with zero manual steps.
#
# Usage: ./deploy/vps-update.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/flexshoes}"
cd "$REPO_DIR"

echo "== Pulling latest code =="
git pull

echo "== Rebuilding and restarting =="
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "== Waiting for health check =="
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T api curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then
        echo "Healthy."
        exit 0
    fi
    sleep 2
done

echo "WARNING: API did not report healthy within 60s - check logs:" >&2
echo "  docker compose -f docker-compose.prod.yml logs api --tail 100" >&2
exit 1
