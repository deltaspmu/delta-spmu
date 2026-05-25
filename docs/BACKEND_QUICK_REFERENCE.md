# Delta SPMU Academy — Backend Quick Reference

Common commands for managing the Frappe backend on EC2. All commands assume you are logged into the server.

---

## SSH Connection

```bash
# Connect to the EC2 instance
ssh ubuntu@<EC2-IP>

# Or with the specific key
ssh -i ~/.ssh/deltaspmu ubuntu@<EC2-IP>
```

---

## Bench Commands

All bench commands must run from the bench directory as the `frappe` user.

```bash
# Switch to frappe user and bench directory
sudo su - frappe
cd /home/frappe/deltaspmu

# Or run individual commands as frappe
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench <command>
```

### Restart

```bash
# Restart all Frappe processes (workers, web, scheduler)
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart
```

### Migrate

Run after schema changes or Frappe updates:

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com migrate
```

### Clear Cache

```bash
# Clear Frappe/Redis cache
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com clear-cache

# Clear website cache
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com clear-website-cache
```

---

## Clear Python Bytecode Cache

Required after deploying new or modified `.py` files with `@frappe.whitelist()` methods:

```bash
sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart
```

---

## View Logs

```bash
# Frappe application log (API requests, errors)
tail -f /home/frappe/deltaspmu/logs/frappe.log

# Frappe error log (tracebacks)
tail -f /home/frappe/deltaspmu/logs/error.log

# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Supervisor logs (process manager)
sudo tail -f /var/log/supervisor/supervisord.log

# Worker logs
tail -f /home/frappe/deltaspmu/logs/worker.log

# Search logs for specific errors
grep "PaymentError" /home/frappe/deltaspmu/logs/frappe.log
grep "500" /var/log/nginx/access.log | tail -20
```

---

## Configuration

### View current config

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com show-config
```

### Add or update a config key

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench set-config <key> <value>

# Examples:
bench set-config vimeo_access_token "your-token-here"
bench set-config telebirr_environment "production"
bench set-config chapa_secret_key "CHASECK-xxxxx"
```

### Remove a config key

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench set-config <key> --delete
```

---

## User Management

### Create a new user

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com add-user user@example.com --first-name "First" --last-name "Last"
```

### Reset admin password

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com set-admin-password <NEW-PASSWORD>
```

### Reset any user's password

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com set-password user@example.com <NEW-PASSWORD>
```

### Disable a user (via Frappe console)

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com console
```

```python
user = frappe.get_doc("User", "user@example.com")
user.enabled = 0
user.save()
frappe.db.commit()
```

---

## Check Site Status

```bash
# Check if bench processes are running
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench doctor

# Check site info
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com show-config

# Check installed apps
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com list-apps

# Quick API health check (from local machine)
curl -s https://api.deltaspmu.com/api/method/frappe.client.get_count?doctype=User | python3 -m json.tool
```

---

## Database

### Backup

```bash
# Create a full backup (SQL + files)
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com backup --with-files

# Backups are stored at:
ls -la /home/frappe/deltaspmu/sites/api.deltaspmu.com/private/backups/
```

### Restore from backup

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com restore /path/to/backup.sql.gz
```

### Access MariaDB console

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com mariadb
```

```sql
-- Example queries
SELECT count(*) FROM `tabUser` WHERE enabled=1;
SELECT name, status, payment_method FROM `tabPayment Transaction` ORDER BY creation DESC LIMIT 10;
SELECT user, course, access_start, access_end FROM `tabCourse Access` WHERE is_active=1;
```

### Frappe console (Python REPL)

```bash
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com console
```

```python
# Count active users
frappe.db.count("User", {"enabled": 1})

# Check recent payments
frappe.db.get_all("Payment Transaction", 
    fields=["name", "user", "course", "status", "payment_method"],
    order_by="creation desc", limit=10)

# Check course access
frappe.db.get_all("Course Access",
    fields=["user", "course", "access_end", "is_active"],
    filters={"is_active": 1})
```

---

## Nginx

### Reload Nginx (after config changes)

```bash
sudo nginx -t          # Test config first
sudo service nginx reload
```

### View Nginx config

```bash
cat /etc/nginx/conf.d/deltaspmu.conf
```

### Check Nginx status

```bash
sudo systemctl status nginx
```

---

## Supervisor (Process Manager)

```bash
# Check status of all Frappe processes
sudo supervisorctl status

# Restart all
sudo supervisorctl restart all

# Restart specific process
sudo supervisorctl restart deltaspmu-web:deltaspmu-frappe-web
```

---

## Deploy Backend Files (from local machine)

Quick one-liner:

```bash
scp backend/frappe-lms/lms/lms/*.py ubuntu@<EC2-IP>:/tmp/ && \
ssh ubuntu@<EC2-IP> "sudo cp /tmp/*.py /home/frappe/deltaspmu/apps/lms/lms/lms/ && \
sudo chown -R frappe:frappe /home/frappe/deltaspmu/apps/lms/ && \
sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc && \
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart"
```

Or use the deploy script:

```bash
./scripts/deploy-backend.sh <EC2-IP>
```

---

## Common Issues

### "502 Bad Gateway"

Frappe web process crashed. Check and restart:

```bash
sudo supervisorctl status
sudo supervisorctl restart all
tail -20 /home/frappe/deltaspmu/logs/frappe.log
```

### "Old code still running after deploy"

Python bytecode cache not cleared:

```bash
sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart
```

### "PermissionError on guest endpoint"

Using `frappe.get_doc()` in a guest-accessible API. Replace with `frappe.db.get_value()` or `frappe.db.get_list()`.

### "CSRF token mismatch"

- For GET endpoints: CSRF is not checked (use GET for cross-origin calls)
- For POST endpoints: fetch CSRF token via `get_csrf_token` API first
- Ensure `withCredentials: true` is set on Axios requests

### Redis connection error

```bash
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

### Disk space issues

```bash
df -h
# Clean old backups
ls -la /home/frappe/deltaspmu/sites/api.deltaspmu.com/private/backups/
# Clean old logs
sudo truncate -s 0 /home/frappe/deltaspmu/logs/frappe.log
```
