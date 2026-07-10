#!/bin/bash
set -e

# Update system
apt-get update && apt-get upgrade -y

# Install prerequisites
apt-get install -y \
  python3 python3-pip python3-venv python3-dev \
  redis-server \
  nginx \
  supervisor \
  git \
  curl \
  wget \
  mariadb-client \
  libssl-dev \
  libffi-dev \
  libjpeg-dev \
  zlib1g-dev \
  libxml2-dev \
  libxslt1-dev \
  libmysqlclient-dev \
  software-properties-common

%{ if install_mariadb ~}
# ---------------------------------------------------------------------------
# On-instance MariaDB 10.11 (cost-optimized envs — no RDS).
# Ubuntu 22.04 ships 10.6, so add the MariaDB repo pinned to 10.11 to match
# the prod RDS engine version.
# ---------------------------------------------------------------------------
curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version=10.11
apt-get install -y mariadb-server

# Frappe-required charset config; bind to localhost only
cat > /etc/mysql/mariadb.conf.d/99-frappe.cnf <<'CNF'
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
bind-address = 127.0.0.1

[mysql]
default-character-set = utf8mb4
CNF

systemctl enable mariadb
systemctl restart mariadb

# Set the root password (used by `bench new-site --db-root-password`)
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${mariadb_root_password}'; FLUSH PRIVILEGES;" || true
%{ endif ~}

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install yarn
npm install -g yarn

# Install wkhtmltopdf
wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb
apt-get install -y ./wkhtmltox_0.12.6.1-3.jammy_amd64.deb || true
rm -f wkhtmltox_0.12.6.1-3.jammy_amd64.deb

# Install frappe-bench
pip3 install frappe-bench

# Create frappe user
useradd -m -s /bin/bash frappe || true
usermod -aG sudo frappe
echo "frappe ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/frappe

# Start and enable Redis
systemctl enable redis-server
systemctl start redis-server

# Start and enable Nginx
systemctl enable nginx
systemctl start nginx

echo "Delta SPMU server setup complete" > /home/ubuntu/setup-complete.txt
