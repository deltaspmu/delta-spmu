#!/bin/bash
# Deploy Frappe backend API files to an environment's EC2.
# Usage: ./scripts/deploy-backend.sh <staging|prod>
#
# Process models differ per host (issue #39): prod runs supervisord-managed
# gunicorn (--preload, so old code stays in memory until a real restart);
# staging runs `bench start` + honcho, where `bench restart` doesn't work.
# The restart step detects the model on the host rather than trusting env
# names — restarting the wrong stack reports success while old code serves.

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/backend/frappe-lms/lms/lms"

echo "==> Deploying backend to ${ENV_NAME} (${EC2_HOST})..."

# Pre-create the staging dir as ubuntu (needed for scp)
ssh ${EC2_HOST} "mkdir -p /tmp/deltaspmu_deploy"

# Copy Python files
echo "  Uploading API files..."
scp ${BACKEND_DIR}/*.py ${EC2_HOST}:/tmp/deltaspmu_deploy/

# Install + clear pyc (one SSH session, exits quickly)
echo "  Installing files + clearing Python cache..."
ssh ${EC2_HOST} "
  set -e
  sudo cp /tmp/deltaspmu_deploy/*.py ${BENCH_DIR}/apps/lms/lms/lms/
  sudo chown -R frappe:frappe ${BENCH_DIR}/apps/lms/
  sudo rm -f ${BENCH_DIR}/apps/lms/lms/lms/__pycache__/*.pyc
  echo OK
"

# Restart Frappe with whichever process model actually runs on the host.
if ssh ${EC2_HOST} "sudo supervisorctl status 2>/dev/null | grep -q '^deltaspmu'"; then
  echo "  supervisord detected — restarting managed services..."
  ssh ${EC2_HOST} "sudo supervisorctl restart all >/dev/null 2>&1; sleep 2
    if sudo supervisorctl status 2>/dev/null | grep -v RUNNING | grep -q .; then
      echo '  ERROR: not all supervisor services are RUNNING:'
      sudo supervisorctl status 2>/dev/null | grep -v RUNNING
      exit 1
    fi
    echo RESTARTED"
else
  # Kill honcho (separate SSH so it exits cleanly when honcho dies)
  echo "  honcho detected — stopping honcho-managed workers..."
  ssh ${EC2_HOST} "sudo pkill -u frappe -f 'honcho start' || true; echo STOPPED"

  # Sleep server-side so the kill settles before we relaunch
  sleep 3

  # Spawn bench start in a fully-detached SSH session.
  # Using ssh -n (stdin from /dev/null) plus explicit FD redirection on the
  # spawned shell so SSH gets EOF immediately and returns. Without the redirects
  # bench start inherits SSH's channel descriptors and SSH waits forever.
  echo "  Relaunching bench start (detached)..."
  ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && nohup setsid ${BENCH_BIN} start </dev/null >/tmp/bench-start.log 2>&1 &' </dev/null >/dev/null 2>&1; echo SPAWNED"
fi

# Wait for workers to come up, then sanity-check.
echo "  Waiting for API to respond..."
ssh ${EC2_HOST} "
  for i in 1 2 3 4 5 6 7 8; do
    if curl -fsS -o /dev/null http://localhost:8000/api/method/ping 2>/dev/null; then
      echo \"  API responding after \${i} tries.\"
      exit 0
    fi
    sleep 2
  done
  echo '  WARNING: API did not respond within 16s. Last log lines:'
  tail -20 /tmp/bench-start.log 2>/dev/null || sudo supervisorctl status 2>/dev/null
  exit 1
"
echo "  Done!"

echo "==> Backend deployment (${ENV_NAME}) complete!"
