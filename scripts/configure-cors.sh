#!/bin/bash
# Configure Frappe CORS + cookie settings for cross-origin Vercel traffic.
#
# This adds the learn/admin portal domains to allow_cors and sets
# cookie_samesite=None so Frappe's session cookie crosses origins.
#
# Run AFTER setup-api-https.sh — cookie_samesite=None requires HTTPS or
# browsers will reject the cookie.

set -e

EC2_HOST="ubuntu@18.194.169.111"
FRAPPE_SITE="api.deltaspmu.com"
BENCH_DIR="/home/frappe/deltaspmu"
BENCH_BIN="/usr/local/bin/bench"

echo "==> Updating Frappe CORS + cookie config..."

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
rm -f "$TMPFILE"

ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} console < /tmp/check_cors.py > /tmp/check_cors.out 2>&1' </dev/null"
echo ""
echo "==> Before:"
ssh ${EC2_HOST} "grep -E 'allow_cors|cookie_samesite' /tmp/check_cors.out | tail -5"

echo ""
echo "==> Applying new config..."

ssh -n ${EC2_HOST} "sudo -u frappe ${BENCH_BIN} --site ${FRAPPE_SITE} set-config -p allow_cors '[\"https://learn.deltaspmu.com\",\"https://admin.deltaspmu.com\"]'" </dev/null
ssh -n ${EC2_HOST} "sudo -u frappe ${BENCH_BIN} --site ${FRAPPE_SITE} set-config cookie_samesite None" </dev/null

echo ""
echo "==> Restarting bench (so config changes take effect)..."
ssh -n ${EC2_HOST} "sudo pkill -u frappe -f 'honcho start' || true" </dev/null
sleep 3
ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && nohup setsid ${BENCH_BIN} start </dev/null >/tmp/bench-start.log 2>&1 &' </dev/null >/dev/null 2>&1"

echo "==> Waiting for API to respond..."
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsS https://api.deltaspmu.com/api/method/ping >/dev/null 2>&1; then
    echo "  API responding after ${i} attempts."
    break
  fi
  sleep 2
done

echo ""
echo "==> Done. Verify the CORS headers with:"
echo "    curl -sI -H 'Origin: https://learn.deltaspmu.com' https://api.deltaspmu.com/api/method/ping | grep -i 'access-control'"
