#!/bin/bash
# Deploy Frappe backend API files to EC2.
# Usage: ./scripts/deploy-backend.sh <EC2-IP>
#
# This Frappe install runs via `bench start` + honcho (not supervisor or
# systemd), so the standard `bench restart` doesn't work — it tries to call
# supervisorctl and fails. Instead we kill honcho and relaunch bench start.

set -e

EC2_IP="${1:?Usage: deploy-backend.sh <EC2-IP>}"
EC2_USER="ubuntu"
BACKEND_DIR="backend/frappe-lms/lms/lms"

echo "==> Deploying backend to ${EC2_IP}..."

# Pre-create the staging dir as ubuntu (needed for scp)
ssh ${EC2_USER}@${EC2_IP} "mkdir -p /tmp/deltaspmu_deploy"

# Copy Python files
echo "  Uploading API files..."
scp ${BACKEND_DIR}/*.py ${EC2_USER}@${EC2_IP}:/tmp/deltaspmu_deploy/

# Install + clear pyc (one SSH session, exits quickly)
echo "  Installing files + clearing Python cache..."
ssh ${EC2_USER}@${EC2_IP} "
  set -e
  sudo cp /tmp/deltaspmu_deploy/*.py /home/frappe/deltaspmu/apps/lms/lms/lms/
  sudo chown -R frappe:frappe /home/frappe/deltaspmu/apps/lms/
  sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc
  echo OK
"

# Kill honcho (separate SSH so it exits cleanly when honcho dies)
echo "  Stopping honcho-managed workers..."
ssh ${EC2_USER}@${EC2_IP} "sudo pkill -u frappe -f 'honcho start' || true; echo STOPPED"

# Sleep server-side so the kill settles before we relaunch
sleep 3

# Spawn bench start in a fully-detached SSH session.
# Using ssh -n (stdin from /dev/null) plus explicit FD redirection on the
# spawned shell so SSH gets EOF immediately and returns. Without the redirects
# bench start inherits SSH's channel descriptors and SSH waits forever.
echo "  Relaunching bench start (detached)..."
ssh -n ${EC2_USER}@${EC2_IP} "sudo -u frappe bash -c 'cd /home/frappe/deltaspmu && nohup setsid /usr/local/bin/bench start </dev/null >/tmp/bench-start.log 2>&1 &' </dev/null >/dev/null 2>&1; echo SPAWNED"

# Wait for workers to come up, then sanity-check.
echo "  Waiting for API to respond..."
ssh ${EC2_USER}@${EC2_IP} "
  for i in 1 2 3 4 5 6 7 8; do
    if curl -fsS -o /dev/null http://localhost:8000/api/method/ping 2>/dev/null; then
      echo \"  API responding after \${i} tries.\"
      exit 0
    fi
    sleep 2
  done
  echo '  WARNING: API did not respond within 16s. Last log lines:'
  tail -20 /tmp/bench-start.log
  exit 1
"
echo "  Done!"

echo "==> Backend deployment complete!"
