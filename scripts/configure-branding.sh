#!/bin/bash
# Apply canonical Delta SPMU branding to a deployed Frappe site.
# Usage: ./scripts/configure-branding.sh <staging|prod>

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Configuring branding on ${ENV_NAME} (${FRAPPE_SITE})..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.branding.apply_branding'"
echo "==> Branding configuration (${ENV_NAME}) complete!"
