#!/bin/bash
# Normalize persisted chapter indices for the ombre course.
# Usage: ./scripts/normalize-ombre-chapters.sh <staging|prod>

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Normalizing ombre chapter numbering on ${ENV_NAME} (${FRAPPE_SITE})..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.curriculum.apply_ombre_chapter_order'"
echo "==> Ombre chapter numbering (${ENV_NAME}) is sequential."
