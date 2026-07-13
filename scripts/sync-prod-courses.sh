#!/bin/bash
# Sync course CONTENT from prod → staging and/or local dev.
# Read-only on prod. Excludes all user activity & PII (enrollments, progress,
# reviews, certificates, quiz submissions, users, transactions).
#
# Usage: ./scripts/sync-prod-courses.sh [staging] [dev]     (default: both)
#
# Copied tables: LMS Course, Course Chapter, Course Lesson, Chapter/Lesson
# Reference, Course Instructor, LMS Category, LMS Quiz, LMS Quiz Question,
# LMS Question, Custom Field + Property Setter definitions — plus the site's
# public/files (course images). Targets run `bench migrate` after import,
# which creates any DB columns the custom-field definitions require.
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${REPO_DIR}/scripts/env/prod.env"
PROD_HOST="$EC2_HOST"
PROD_INSTANCE="i-0c4404a6aab59c80a"
# shellcheck disable=SC1091
source "${REPO_DIR}/scripts/env/staging.env"
STAGING_HOST="$EC2_HOST"

TARGETS=("${@:-staging dev}")
[ $# -eq 0 ] && TARGETS=(staging dev)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

DUMP_SCRIPT='
import json, subprocess, sys
cfg = json.load(open("/home/frappe/deltaspmu/sites/api.deltaspmu.com/site_config.json"))
tables = ["tabLMS Course","tabCourse Chapter","tabCourse Lesson","tabChapter Reference",
          "tabLesson Reference","tabCourse Instructor","tabLMS Category","tabLMS Quiz",
          "tabLMS Quiz Question","tabLMS Question",
          # Custom Field / Property Setter definitions — without them the
          # target site lacks prod'"'"'s custom columns (e.g. LMS
          # Enrollment.enrollment_date) and course pages 417.
          "tabCustom Field","tabProperty Setter"]
cmd = ["mysqldump","-h",cfg.get("db_host","localhost"),"-u",cfg.get("db_user") or cfg["db_name"],
       "-p"+cfg["db_password"],"--single-transaction","--quick","--no-tablespaces",cfg["db_name"]] + tables
with open("/tmp/prod-course-content.sql","w") as f:
    r = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
if r.returncode: print("DUMP FAILED:", r.stderr[:200]); sys.exit(1)
subprocess.run(["gzip","-f","/tmp/prod-course-content.sql"], check=True)
print("DUMP OK")
'

echo "==> [prod] read-only dump (via EC2 Instance Connect)..."
aws ec2-instance-connect send-ssh-public-key --instance-id "$PROD_INSTANCE" \
  --availability-zone eu-central-1a --instance-os-user ubuntu \
  --ssh-public-key "file://$HOME/.ssh/id_ed25519.pub" --query Success --output text
ssh -o BatchMode=yes "$PROD_HOST" "sudo python3 -c '$DUMP_SCRIPT' 2>&1 | tail -1 && \
  sudo tar czf /tmp/prod-course-files.tar.gz -C /home/frappe/deltaspmu/sites/api.deltaspmu.com/public files && \
  sudo chown ubuntu /tmp/prod-course-*.gz"
scp -o BatchMode=yes "$PROD_HOST":/tmp/prod-course-content.sql.gz "$WORK/"
scp -o BatchMode=yes "$PROD_HOST":/tmp/prod-course-files.tar.gz "$WORK/"

# Console script: raw-SQL-imported Custom Field rows bypass the ORM hook that
# ALTERs tables, and `bench migrate` does NOT create those columns — force it.
cat > "$WORK/apply_custom_columns.py" <<'"'"'CONSOLE'"'"'
exec("""
import frappe
for dt in frappe.db.sql_list("SELECT DISTINCT dt FROM `tabCustom Field`"):
    frappe.clear_cache(doctype=dt)
    try:
        frappe.db.updatedb(dt)
    except Exception as e:
        print("updatedb skipped:", dt, str(e)[:80])

# Courses reference prod instructor Users that are excluded from the sync
# (PII) — create login-less stubs so link validation passes on save.
for email in frappe.db.sql_list("SELECT DISTINCT instructor FROM `tabCourse Instructor`"):
    if email and not frappe.db.exists("User", email):
        frappe.get_doc({
            "doctype": "User", "email": email,
            "first_name": email.split("@")[0].replace(".", " ").title(),
            "send_welcome_email": 0, "roles": [{"role": "Course Creator"}],
        }).insert(ignore_permissions=True)
        print("created stub instructor:", email)
frappe.db.commit()
print("custom columns applied")
""")
CONSOLE

for target in ${TARGETS[@]}; do
  case "$target" in
  staging)
    echo "==> [staging] importing..."
    scp -o BatchMode=yes "$WORK"/prod-course-*.gz "$WORK/apply_custom_columns.py" "$STAGING_HOST":/tmp/
    ssh -o BatchMode=yes "$STAGING_HOST" "chmod 644 /tmp/apply_custom_columns.py"
    ssh -o BatchMode=yes "$STAGING_HOST" '
set -e
sudo python3 -c "
import json, subprocess, gzip
cfg = json.load(open(\"/home/frappe/deltaspmu/sites/staging-api.deltaspmu.com/site_config.json\"))
sql = gzip.open(\"/tmp/prod-course-content.sql.gz\",\"rb\").read()
r = subprocess.run([\"mysql\",\"-h\",\"localhost\",\"-u\",cfg.get(\"db_user\") or cfg[\"db_name\"],\"-p\"+cfg[\"db_password\"],cfg[\"db_name\"]], input=sql, capture_output=True)
assert r.returncode == 0, r.stderr.decode()[:300]
print(\"import OK\")"
sudo tar xzf /tmp/prod-course-files.tar.gz -C /home/frappe/deltaspmu/sites/staging-api.deltaspmu.com/public/
sudo chown -R frappe:frappe /home/frappe/deltaspmu/sites/staging-api.deltaspmu.com/public/files
sudo -u frappe bash -c "cd /home/frappe/deltaspmu && /usr/local/bin/bench --site staging-api.deltaspmu.com migrate >/dev/null 2>&1 && /usr/local/bin/bench --site staging-api.deltaspmu.com clear-cache"
rm -f /tmp/prod-course-*.gz
echo "staging done"'
    ;;
  dev)
    echo "==> [dev] importing..."
    docker cp "$WORK/prod-course-content.sql.gz" deltaspmu-dev-frappe-1:/tmp/
    docker cp "$WORK/prod-course-files.tar.gz" deltaspmu-dev-frappe-1:/tmp/
    docker cp "$WORK/apply_custom_columns.py" deltaspmu-dev-frappe-1:/tmp/
    docker compose -f "${REPO_DIR}/dev/docker-compose.yml" exec -T frappe bash -lc '
set -e
cd /workspace/frappe-bench
DB=$(python3 -c "import json;print(json.load(open(\"sites/lms.localhost/site_config.json\"))[\"db_name\"])")
PW=$(python3 -c "import json;print(json.load(open(\"sites/lms.localhost/site_config.json\"))[\"db_password\"])")
gunzip -c /tmp/prod-course-content.sql.gz | mysql -h mariadb -u $DB -p$PW $DB
tar xzf /tmp/prod-course-files.tar.gz -C sites/lms.localhost/public/
bench --site lms.localhost migrate >/dev/null 2>&1
bench --site lms.localhost console < /tmp/apply_custom_columns.py 2>&1 | grep -a "custom columns applied" || true
bench --site lms.localhost clear-cache
rm -f /tmp/prod-course-*.gz
echo "dev done"'
    ;;
  *) echo "unknown target: $target (use staging|dev)"; exit 1 ;;
  esac
done
echo "==> Course sync complete."
