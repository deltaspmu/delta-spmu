#!/bin/bash
# Normalize persisted chapter indices so each course numbers its chapters 1..n.
# Duplicate indices make (course, idx) lookups resolve to the wrong chapter.
# Usage: ./scripts/normalize-chapters.sh <staging|prod>

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Normalizing chapter numbering on ${ENV_NAME} (${FRAPPE_SITE})..."
ssh "${EC2_HOST}" \
  "sudo -u frappe bash -lc 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} execute lms.lms.curriculum.apply_chapter_order'"
echo "==> Chapter numbering (${ENV_NAME}) is unique and sequential."
