#!/bin/bash
# Recovery script: continues Frappe bootstrap from step 6 onward.
# System packages, wkhtmltopdf, node, frappe user, and bench CLI are already installed.
# This script uses the system-wide bench at /usr/local/bin/bench.

set -e

SITE_NAME="api.deltaspmu.com"
BENCH_NAME="deltaspmu"
FRAPPE_BRANCH="version-15"
RDS_ENDPOINT="deltaspmu-dev-db.cxqkw6i4ict1.eu-central-1.rds.amazonaws.com"
RDS_PASSWORD="DeltaSPMU_Yeg8qjUZk3sp6QuvPTeDBhUXF7ly"
BENCH_BIN="/usr/local/bin/bench"

echo "============================================================"
echo "  Delta SPMU — Frappe bootstrap (resume from step 6)"
echo "============================================================"
echo "  Bench bin: ${BENCH_BIN}"
echo "  Site:      ${SITE_NAME}"
echo "  RDS:       ${RDS_ENDPOINT}"
echo ""

# Make sure frappe user owns its home directory
sudo chown -R frappe:frappe /home/frappe

# ============================================================================
# 6. Initialize bench
# ============================================================================
if [ ! -d "/home/frappe/${BENCH_NAME}" ]; then
  echo "==> [6/9] Initializing bench (${BENCH_NAME})..."
  sudo -u frappe -H bash -c "
    cd /home/frappe
    ${BENCH_BIN} init ${BENCH_NAME} --frappe-branch ${FRAPPE_BRANCH} --skip-assets --verbose
  "
else
  echo "==> [6/9] Bench dir already exists, skipping init."
fi

# ============================================================================
# 7. Create site (with RDS MariaDB)
# ============================================================================
if [ ! -d "/home/frappe/${BENCH_NAME}/sites/${SITE_NAME}" ]; then
  echo "==> [7/9] Creating site ${SITE_NAME}..."
  sudo -u frappe -H bash -c "
    cd /home/frappe/${BENCH_NAME}
    ${BENCH_BIN} new-site ${SITE_NAME} \
      --db-host ${RDS_ENDPOINT} \
      --db-port 3306 \
      --mariadb-root-password '${RDS_PASSWORD}' \
      --admin-password 'admin' \
      --no-mariadb-socket
    ${BENCH_BIN} --site ${SITE_NAME} set-config developer_mode 0
    ${BENCH_BIN} use ${SITE_NAME}
  "
else
  echo "==> [7/9] Site already exists, skipping."
fi

# ============================================================================
# 8. Install LMS app
# ============================================================================
if [ ! -d "/home/frappe/${BENCH_NAME}/apps/lms" ]; then
  echo "==> [8/9] Installing LMS app..."
  sudo -u frappe -H bash -c "
    cd /home/frappe/${BENCH_NAME}
    ${BENCH_BIN} get-app lms
    ${BENCH_BIN} --site ${SITE_NAME} install-app lms
  "
else
  echo "==> [8/9] LMS app already installed."
fi

# ============================================================================
# 9. Configure Nginx + Supervisor
# ============================================================================
echo "==> [9/9] Setting up Nginx and Supervisor..."
sudo -u frappe -H bash -c "
  cd /home/frappe/${BENCH_NAME}
  ${BENCH_BIN} setup nginx --yes
  ${BENCH_BIN} setup supervisor --yes
"
sudo ln -sf /home/frappe/${BENCH_NAME}/config/nginx.conf /etc/nginx/conf.d/${BENCH_NAME}.conf
sudo ln -sf /home/frappe/${BENCH_NAME}/config/supervisor.conf /etc/supervisor/conf.d/${BENCH_NAME}.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo service nginx reload || true
sudo service supervisor restart || true

echo ""
echo "============================================================"
echo "  Bootstrap resume complete!"
echo "============================================================"
echo "  Site URL: http://${SITE_NAME}:8000"
echo "  Admin:    Administrator / admin"
