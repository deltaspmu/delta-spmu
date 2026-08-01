#!/bin/bash
# Remove the stock Frappe LMS course, quiz, and unused fixture categories.
# Usage: ./scripts/cleanup-frappe-demo-content.sh <staging|prod>

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Inspecting Frappe demo content on ${ENV_NAME} (${FRAPPE_SITE})..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.demo_content.get_frappe_demo_content_status'"

echo "==> Removing unreferenced Frappe demo content..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.demo_content.cleanup_frappe_demo_content'"

echo "==> Frappe demo-content cleanup (${ENV_NAME}) complete!"
