#!/bin/bash
# Swap stock frappe/lms for Afritutors LMS fork on the deltaspmu bench.
# Run on the deltaspmu EC2 instance as a user with sudo.
set -e

cd /home/frappe/deltaspmu/apps

# Stop bench so files aren't locked
pkill -f "bench start" 2>/dev/null || true
pkill -f honcho 2>/dev/null || true
sleep 2

# Backup stock lms OUTSIDE apps/ — a backup dir inside apps/ gets picked up
# by bench app discovery and breaks installs (ModuleNotFoundError lms.stock_backup)
BACKUP=/home/frappe/lms.stock-backup
if [ -d lms ] && [ ! -d "$BACKUP" ]; then
  mv lms "$BACKUP"
fi
if [ -d lms ] && [ -d "$BACKUP" ]; then
  rm -rf lms
fi

# Extract Afritutors fork
tar -xzf /tmp/afritutors-lms.tar.gz
chown -R frappe:frappe lms

# Preserve public/ build assets from the stock version
# (we excluded them from the tarball to keep it small)
mkdir -p lms/lms/public
if [ -d "$BACKUP/lms/public" ]; then
  cp -r "$BACKUP"/lms/public/. lms/lms/public/ 2>/dev/null || true
fi
chown -R frappe:frappe lms/lms/public

echo "==> apps/ directory:"
ls /home/frappe/deltaspmu/apps/
echo ""
echo "==> apps/lms/lms/lms/ Python files:"
ls /home/frappe/deltaspmu/apps/lms/lms/lms/*.py 2>/dev/null | head -20
