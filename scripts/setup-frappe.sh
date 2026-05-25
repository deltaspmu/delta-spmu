#!/bin/bash
# Set up Frappe LMS on a fresh Ubuntu 22.04 EC2 instance
# Usage: ssh into EC2 first, then run this script
#   ssh ubuntu@<EC2-IP>
#   bash < setup-frappe.sh
#
# OR copy to remote and run:
#   scp scripts/setup-frappe.sh ubuntu@<EC2-IP>:/tmp/
#   ssh ubuntu@<EC2-IP> "bash /tmp/setup-frappe.sh"
#
# Prerequisites:
#   - Ubuntu 22.04 EC2 instance (t3.small, 30GB gp3)
#   - RDS MariaDB endpoint ready
#   - Security group allows inbound 80, 443, 22, 8000

set -e

# ============================================================================
# Configuration — edit these before running
# ============================================================================
SITE_NAME="api.deltaspmu.com"
BENCH_NAME="deltaspmu"
FRAPPE_BRANCH="version-15"
NODE_VERSION="18"
RDS_ENDPOINT=""  # <-- FILL IN: your-rds-instance.xxxx.eu-central-1.rds.amazonaws.com
RDS_PASSWORD=""  # <-- FILL IN: MariaDB master password

if [ -z "$RDS_ENDPOINT" ] || [ -z "$RDS_PASSWORD" ]; then
  echo "ERROR: Set RDS_ENDPOINT and RDS_PASSWORD at the top of this script before running."
  exit 1
fi

echo "============================================================"
echo "  Delta SPMU Academy — Frappe LMS Server Setup"
echo "============================================================"
echo ""
echo "  Site:     ${SITE_NAME}"
echo "  Bench:    ${BENCH_NAME}"
echo "  Frappe:   ${FRAPPE_BRANCH}"
echo "  RDS:      ${RDS_ENDPOINT}"
echo ""

# ============================================================================
# 1. System packages
# ============================================================================
echo "==> [1/9] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y \
  git \
  python3 \
  python3-dev \
  python3-pip \
  python3-venv \
  redis-server \
  nginx \
  supervisor \
  curl \
  wget \
  build-essential \
  libssl-dev \
  libffi-dev \
  libmysqlclient-dev \
  xvfb \
  libfontconfig

# ============================================================================
# 2. wkhtmltopdf (required by Frappe for PDF generation)
# ============================================================================
echo "==> [2/9] Installing wkhtmltopdf..."
wget -q https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb -O /tmp/wkhtmltox.deb
sudo dpkg -i /tmp/wkhtmltox.deb || sudo apt-get install -f -y
rm -f /tmp/wkhtmltox.deb

# ============================================================================
# 3. Node.js 18
# ============================================================================
echo "==> [3/9] Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn

# ============================================================================
# 4. Create frappe user
# ============================================================================
echo "==> [4/9] Creating frappe user..."
if ! id "frappe" &>/dev/null; then
  sudo adduser --disabled-password --gecos "" frappe
  sudo usermod -aG sudo frappe
  echo "frappe ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/frappe
fi

# ============================================================================
# 5. Install bench CLI
# ============================================================================
echo "==> [5/9] Installing bench..."
sudo -u frappe -H bash -c '
  pip3 install --user frappe-bench
  echo "export PATH=\$PATH:/home/frappe/.local/bin" >> ~/.bashrc
'

# ============================================================================
# 6. Initialize bench
# ============================================================================
echo "==> [6/9] Initializing bench (${BENCH_NAME})..."
sudo -u frappe -H bash -c "
  cd /home/frappe
  /home/frappe/.local/bin/bench init ${BENCH_NAME} --frappe-branch ${FRAPPE_BRANCH}
"

# ============================================================================
# 7. Create site (with RDS MariaDB)
# ============================================================================
echo "==> [7/9] Creating site ${SITE_NAME}..."
sudo -u frappe -H bash -c "
  cd /home/frappe/${BENCH_NAME}
  /home/frappe/.local/bin/bench new-site ${SITE_NAME} \
    --db-host ${RDS_ENDPOINT} \
    --db-port 3306 \
    --mariadb-root-password '${RDS_PASSWORD}' \
    --admin-password 'admin'
  /home/frappe/.local/bin/bench --site ${SITE_NAME} set-config developer_mode 0
  /home/frappe/.local/bin/bench use ${SITE_NAME}
"

# ============================================================================
# 8. Install LMS app
# ============================================================================
echo "==> [8/9] Installing LMS app..."
sudo -u frappe -H bash -c "
  cd /home/frappe/${BENCH_NAME}
  /home/frappe/.local/bin/bench get-app lms
  /home/frappe/.local/bin/bench --site ${SITE_NAME} install-app lms
"

# ============================================================================
# 9. Configure Nginx + Supervisor
# ============================================================================
echo "==> [9/9] Setting up Nginx and Supervisor..."
sudo -u frappe -H bash -c "
  cd /home/frappe/${BENCH_NAME}
  /home/frappe/.local/bin/bench setup nginx --yes
  /home/frappe/.local/bin/bench setup supervisor --yes
"
sudo ln -sf /home/frappe/${BENCH_NAME}/config/nginx.conf /etc/nginx/conf.d/${BENCH_NAME}.conf
sudo ln -sf /home/frappe/${BENCH_NAME}/config/supervisor.conf /etc/supervisor/conf.d/${BENCH_NAME}.conf

# Remove default nginx site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

sudo service nginx reload
sudo service supervisor restart

echo ""
echo "============================================================"
echo "  Setup complete!"
echo "============================================================"
echo ""
echo "  Site URL:  http://${SITE_NAME}:8000"
echo "  Admin:     Administrator / admin"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. Change the admin password:"
echo "     cd /home/frappe/${BENCH_NAME}"
echo "     bench --site ${SITE_NAME} set-admin-password <NEW-PASSWORD>"
echo ""
echo "  2. Deploy custom API files:"
echo "     ./scripts/deploy-backend.sh <EC2-IP>"
echo ""
echo "  3. Configure payment providers:"
echo "     ./scripts/configure-payments.sh"
echo ""
echo "  4. Set up SSL (choose one):"
echo ""
echo "     Option A — Let's Encrypt (direct):"
echo "       sudo apt install certbot python3-certbot-nginx"
echo "       sudo certbot --nginx -d ${SITE_NAME}"
echo ""
echo "     Option B — Cloudflare Origin Certificate:"
echo "       - Generate cert in Cloudflare dashboard > SSL/TLS > Origin Server"
echo "       - Save .pem and .key to /etc/ssl/${SITE_NAME}/"
echo "       - Update Nginx config to use them"
echo "       - Set Cloudflare SSL mode to Full (strict)"
echo ""
echo "  5. Set up DNS in Cloudflare:"
echo "     A record: api.deltaspmu.com -> <ELASTIC-IP>"
echo ""
echo "  6. Enable production mode:"
echo "     cd /home/frappe/${BENCH_NAME}"
echo "     sudo bench setup production frappe"
echo ""
