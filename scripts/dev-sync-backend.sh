#!/bin/bash
# Sync backend/frappe-lms overlay into the local dev bench (mirrors deploy-backend.sh
# semantics: copy *.py, clear __pycache__). Frappe dev server auto-reloads.
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/dev/docker-compose.yml"

$COMPOSE exec -T frappe bash -lc '
set -e
DEST=/workspace/frappe-bench/apps/lms/lms/lms
if [ ! -d "$DEST" ]; then
  echo "ERROR: $DEST not found — run scripts/dev-setup.sh first" >&2
  exit 1
fi
cp /repo/backend/frappe-lms/lms/lms/*.py "$DEST/"
rm -rf "$DEST/__pycache__"
echo "Synced $(ls /repo/backend/frappe-lms/lms/lms/*.py | wc -l | tr -d " ") files to $DEST"
'
