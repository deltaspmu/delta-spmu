#!/bin/bash
# Configure Frappe CORS + cookie settings for cross-origin Vercel traffic.
# Usage: ./scripts/configure-cors.sh <staging|prod>
#
# Adds the environment's portal domains to allow_cors and sets
# cookie_samesite=None so Frappe's session cookie crosses origins.
#
# Run AFTER setup-api-https.sh — cookie_samesite=None requires HTTPS or
# browsers will reject the cookie.

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

echo "==> Updating Frappe CORS + cookie config on ${ENV_NAME}..."

TMPFILE=$(mktemp)
cat > "$TMPFILE" <<PYEOF
exec("""
import frappe
import json

site_config = frappe.get_site_config()
print('Current allow_cors:', site_config.get('allow_cors'))
print('Current cookie_samesite:', site_config.get('cookie_samesite'))
""")
PYEOF

scp "$TMPFILE" ${EC2_HOST}:/tmp/check_cors.py > /dev/null
ssh -n ${EC2_HOST} "chmod 644 /tmp/check_cors.py" </dev/null  # mktemp is 600; frappe user must read it
rm -f "$TMPFILE"

ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} console < /tmp/check_cors.py > /tmp/check_cors.out 2>&1' </dev/null"
echo ""
echo "==> Before:"
ssh ${EC2_HOST} "grep -E 'allow_cors|cookie_samesite' /tmp/check_cors.out | tail -5"

echo ""
echo "==> Applying new config..."

ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} set-config -p allow_cors \"[\\\"${PORTAL_URL}\\\",\\\"${ADMIN_URL}\\\"]\"'" </dev/null
ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} set-config cookie_samesite None'" </dev/null

echo ""
echo "==> Restarting bench (so config changes take effect)..."
ssh -n ${EC2_HOST} "sudo pkill -u frappe -f 'honcho start' || true" </dev/null
sleep 3
ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && nohup setsid ${BENCH_BIN} start </dev/null >/tmp/bench-start.log 2>&1 &' </dev/null >/dev/null 2>&1"

echo "==> Waiting for API to respond..."
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsS ${API_URL}/api/method/ping >/dev/null 2>&1; then
    echo "  API responding after ${i} attempts."
    break
  fi
  sleep 2
done

echo ""
echo "==> Done. Verify the CORS headers with:"
echo "    curl -sI -H 'Origin: ${PORTAL_URL}' ${API_URL}/api/method/ping | grep -i 'access-control'"
