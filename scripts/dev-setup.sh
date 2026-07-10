#!/bin/bash
# One-shot bootstrap of the local dev backend (Frappe v15 + LMS, site lms.localhost).
# Prereq: docker compose -f dev/docker-compose.yml up -d
# Idempotent: safe to re-run; skips completed steps.
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/dev/docker-compose.yml"
IN_FRAPPE="$COMPOSE exec -T frappe bash -lc"

echo "==> Waiting for containers..."
$COMPOSE up -d --wait

# The named volume mounts root-owned; bench runs as the frappe user
$COMPOSE exec -T -u root frappe bash -c 'chown frappe:frappe /workspace'

echo "==> Initializing bench (frappe version-15) — first run takes ~10 min..."
$IN_FRAPPE '
set -e
if [ ! -d /workspace/frappe-bench ]; then
  bench init --skip-redis-config-generation --frappe-branch version-15 /workspace/frappe-bench
fi
cd /workspace/frappe-bench
# Point bench at the compose services instead of localhost
bench set-config -g db_host mariadb
bench set-config -g redis_cache "redis://redis-cache:6379"
bench set-config -g redis_queue "redis://redis-queue:6379"
bench set-config -g redis_socketio "redis://redis-queue:6379"
'

echo "==> Getting LMS app (stock version-15; run scripts/dev-fetch-lms.sh afterwards for the prod fork)..."
$IN_FRAPPE '
set -e
cd /workspace/frappe-bench
if [ ! -d apps/payments ]; then
  bench get-app payments   # lms dependency — get-app lms does not always resolve it
fi
if [ ! -d apps/lms ]; then
  bench get-app lms https://github.com/frappe/lms --branch main
fi
'

echo "==> Creating site lms.localhost..."
$IN_FRAPPE '
set -e
cd /workspace/frappe-bench
if [ ! -d sites/lms.localhost ]; then
  bench new-site lms.localhost \
    --db-root-password 123 \
    --admin-password admin \
    --no-mariadb-socket
  bench --site lms.localhost install-app lms
  bench --site lms.localhost set-config developer_mode 1
  bench --site lms.localhost set-config allow_cors "*"
  bench --site lms.localhost clear-cache
  bench use lms.localhost
fi
'

echo "==> Overlaying Delta SPMU backend files..."
"${REPO_DIR}/scripts/dev-sync-backend.sh"

echo ""
echo "==> Done. Start the backend with:"
echo "    docker compose -f dev/docker-compose.yml exec frappe bash -lc 'cd /workspace/frappe-bench && bench start'"
echo "    Backend:  http://lms.localhost:8000  (admin / admin)"
echo "    Portals:  set VITE_DEV_API_TARGET=http://lms.localhost:8000 in frontend/*/.env.local, then npm run dev"
echo "    Seed:     see docs/DEV_SETUP.md"
