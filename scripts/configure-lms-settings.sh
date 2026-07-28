#!/bin/bash
# Apply canonical Delta SPMU feature settings to a deployed Frappe site.
# Usage: ./scripts/configure-lms-settings.sh <staging|prod>

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Configuring LMS settings on ${ENV_NAME} (${FRAPPE_SITE})..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.platform_settings.apply_lms_settings'"
echo "==> LMS settings configuration (${ENV_NAME}) complete!"
