#!/bin/bash
# Replace the local dev bench's stock LMS app with the exact fork running in prod.
# Streams a tarball from the prod EC2 over SSH into the dev container — prod is
# only ever READ (tar czf). Run this yourself; it needs your prod SSH key.
#
# Usage: ./scripts/dev-fetch-lms.sh [prod-host]   (default: host from scripts/env/prod.env)
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/dev/docker-compose.yml"

PROD_HOST="${1:-}"
if [ -z "$PROD_HOST" ] && [ -f "${REPO_DIR}/scripts/env/prod.env" ]; then
  # shellcheck disable=SC1091
  source "${REPO_DIR}/scripts/env/prod.env"
  PROD_HOST="$EC2_HOST"
fi
: "${PROD_HOST:?Usage: dev-fetch-lms.sh <ubuntu@prod-ip>}"

echo "==> Streaming apps/lms from ${PROD_HOST} into the dev container (read-only on prod)..."
ssh "$PROD_HOST" "sudo tar czf - -C /home/frappe/deltaspmu/apps lms --exclude=lms/node_modules --exclude='lms/lms/public/dist'" \
  | $COMPOSE exec -T frappe bash -lc '
set -e
cd /workspace/frappe-bench/apps
if [ -d lms ] && [ ! -d lms.stock-backup ]; then mv lms lms.stock-backup; fi
rm -rf lms
tar xzf -
# Preserve built public assets from the stock app (same trick as swap-lms-fork.sh)
mkdir -p lms/lms/public
if [ -d lms.stock-backup/lms/public ]; then
  cp -r lms.stock-backup/lms/public/. lms/lms/public/ 2>/dev/null || true
fi
cd /workspace/frappe-bench
./env/bin/pip install -q -e apps/lms
'

echo "==> Re-applying Delta overlay + migrating..."
"${REPO_DIR}/scripts/dev-sync-backend.sh"
$COMPOSE exec -T frappe bash -lc 'cd /workspace/frappe-bench && bench --site lms.localhost migrate && bench --site lms.localhost clear-cache'
echo "==> Done — local bench now runs the prod LMS fork."
