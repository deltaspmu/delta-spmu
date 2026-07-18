#!/usr/bin/env bash
# Replace local development data with a developer-safe clone of staging.
# Staging is read-only. The local database and files are backed up first.
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "${REPO_DIR}/dev/docker-compose.yml")
SITE="lms.localhost"
STAGING_SITE="staging-api.deltaspmu.com"
STAGING_BENCH="/home/frappe/deltaspmu"
STAGING_USER="ubuntu"
STAGING_IP="63.181.17.70"
AWS_REGION="eu-central-1"
SSH_PUBLIC_KEY="${HOME}/.ssh/id_ed25519.pub"
YES=0
KEEP_ARTIFACTS=0
PHASE="preflight"
MUTATION_STARTED=0
ROLLBACK_RUNNING=0

usage() {
  cat <<'EOF'
Usage: ./scripts/sync-staging-to-dev.sh [--yes] [--keep-artifacts]

Copies staging into local dev, mirrors the staging LMS app, imports public
files, anonymizes identities, disables integrations, and resets the local
Administrator password to "admin".

Options:
  --yes             Skip the destructive confirmation.
  --keep-artifacts  Keep downloaded staging artifacts in the temporary folder.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --keep-artifacts) KEEP_ARTIFACTS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/deltaspmu-staging-sync.XXXXXX")"
BACKUP_DIR="${REPO_DIR}/dev/backups/${timestamp}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$WORK" "$BACKUP_DIR"
CONTROL_PATH="/tmp/dspmu-ssh-${$}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ControlMaster=auto
  -o ControlPersist=10m -o "ControlPath=${CONTROL_PATH}")
REMOTE="${STAGING_USER}@${STAGING_IP}"

cleanup() {
  ssh "${SSH_OPTS[@]}" -O exit "$REMOTE" >/dev/null 2>&1 || true
  rm -f "$CONTROL_PATH"
  if [[ "$KEEP_ARTIFACTS" -eq 0 ]]; then
    rm -rf "$WORK"
  else
    echo "Artifacts retained at: $WORK"
  fi
}

restart_local_backend() {
  "${COMPOSE[@]}" exec -T frappe bash -lc \
    "cd /workspace/frappe-bench && nohup setsid bench start </dev/null >/tmp/bench-start.log 2>&1 &"
}

rollback() {
  [[ "$MUTATION_STARTED" -eq 1 && "$ROLLBACK_RUNNING" -eq 0 ]] || return 0
  ROLLBACK_RUNNING=1
  trap - ERR
  echo "ERROR during ${PHASE}; restoring the previous local environment..." >&2
  "${COMPOSE[@]}" exec -T frappe pkill -u frappe -f 'honcho|bench start' >/dev/null 2>&1 || true
  docker cp "${BACKUP_DIR}/local-apps.tar.gz" deltaspmu-dev-frappe-1:/tmp/local-apps.tar.gz
  docker cp "${BACKUP_DIR}/local-database.sql.gz" deltaspmu-dev-frappe-1:/tmp/local-database.sql.gz
  docker cp "${BACKUP_DIR}/local-public-files.tar" deltaspmu-dev-frappe-1:/tmp/local-public-files.tar
  docker cp "${BACKUP_DIR}/local-private-files.tar" deltaspmu-dev-frappe-1:/tmp/local-private-files.tar
  "${COMPOSE[@]}" exec -T -u root frappe chmod 644 \
    /tmp/local-apps.tar.gz /tmp/local-database.sql.gz \
    /tmp/local-public-files.tar /tmp/local-private-files.tar
  "${COMPOSE[@]}" exec -T frappe bash -lc "
    set -e
    cd /workspace/frappe-bench
    rm -rf apps/lms apps/payments
    tar xzf /tmp/local-apps.tar.gz -C apps
    ./env/bin/pip install -q -e apps/lms
    ./env/bin/pip install -q -e apps/payments
    bench --site ${SITE} restore /tmp/local-database.sql.gz \
      --mariadb-root-username root --mariadb-root-password 123 --force
    rm -rf sites/${SITE}/public/files sites/${SITE}/private/files
    mkdir -p sites/${SITE}/public sites/${SITE}/private
    tar xf /tmp/local-public-files.tar -C sites/${SITE}/public
    tar xf /tmp/local-private-files.tar -C sites/${SITE}/private
    bench --site ${SITE} migrate
    bench --site ${SITE} clear-cache
  " || echo "Automatic rollback failed; backup is at ${BACKUP_DIR}" >&2
  restart_local_backend || true
  echo "Previous local backup retained at: ${BACKUP_DIR}" >&2
}

trap cleanup EXIT
trap rollback ERR

echo "==> Preflight"
for command in aws ssh scp docker python3; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
[[ -r "$SSH_PUBLIC_KEY" ]] || { echo "Missing SSH public key: $SSH_PUBLIC_KEY" >&2; exit 1; }
aws sts get-caller-identity >/dev/null 2>&1 || {
  echo "AWS authentication is unavailable or expired. Run: aws login" >&2
  exit 1
}
"${COMPOSE[@]}" up -d --wait
"${COMPOSE[@]}" exec -T frappe test -f "/workspace/frappe-bench/sites/${SITE}/site_config.json"
local_free_kb="$(df -Pk "$REPO_DIR" | awk 'NR==2{print $4}')"
[[ "$local_free_kb" -ge 921600 ]] || {
  echo "At least 900 MiB of local free disk space is required." >&2
  exit 1
}

instance_json="$(aws ec2 describe-instances --region "$AWS_REGION" \
  --filters "Name=ip-address,Values=${STAGING_IP}" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].[InstanceId,Placement.AvailabilityZone]' --output text)"
read -r INSTANCE_ID INSTANCE_AZ <<<"$instance_json"
[[ "$INSTANCE_ID" == i-* && "$INSTANCE_AZ" == "$AWS_REGION"* ]] || {
  echo "Could not identify the running staging EC2 instance at ${STAGING_IP}." >&2
  exit 1
}

aws ec2-instance-connect send-ssh-public-key --region "$AWS_REGION" \
  --instance-id "$INSTANCE_ID" --availability-zone "$INSTANCE_AZ" \
  --instance-os-user "$STAGING_USER" --ssh-public-key "file://${SSH_PUBLIC_KEY}" \
  --query Success --output text | grep -qx True
ssh "${SSH_OPTS[@]}" -MNf "$REMOTE"
remote_free_kb="$(ssh "${SSH_OPTS[@]}" "$REMOTE" "df -Pk /tmp | tail -1 | tr -s ' ' | cut -d ' ' -f4")"
[[ "$remote_free_kb" -ge 2097152 ]] || {
  echo "At least 2 GiB of free space is required in staging /tmp." >&2
  exit 1
}

ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo -u frappe bash -lc '
  set -e
  cd ${STAGING_BENCH}
  bench version
  echo __APPS__
  bench --site ${STAGING_SITE} list-apps
'" >"${WORK}/staging-versions.txt"

local_frappe="$("${COMPOSE[@]}" exec -T frappe bash -lc \
  "cd /workspace/frappe-bench && bench version | awk '\$1==\"frappe\"{print \$2}'")"
staging_frappe="$(awk '$1=="frappe"{print $2; exit}' "${WORK}/staging-versions.txt")"
[[ "${local_frappe%%.*}" == "15" && "${staging_frappe%%.*}" == "15" ]] || {
  echo "Frappe major-version mismatch: local=${local_frappe}, staging=${staging_frappe}" >&2
  exit 1
}
unexpected_apps="$(awk 'seen && NF{print $1} /__APPS__/{seen=1}' "${WORK}/staging-versions.txt" |
  grep -Ev '^(frappe|lms|payments)$' || true)"
[[ -z "$unexpected_apps" ]] || {
  echo "Staging has unsupported installed apps: ${unexpected_apps//$'\n'/, }" >&2
  exit 1
}

if [[ "$YES" -eq 0 ]]; then
  echo
  echo "This replaces the local ${SITE} database and files with anonymized staging data."
  read -r -p "Type 'replace local dev' to continue: " confirmation
  [[ "$confirmation" == "replace local dev" ]] || { echo "Cancelled."; exit 0; }
fi

echo "==> Creating staging backup (staging remains read-only)"
PHASE="staging backup"
remote_dir="/tmp/deltaspmu-dev-sync-${timestamp}"
ssh "${SSH_OPTS[@]}" "$REMOTE" "set -e
  sudo install -d -m 700 -o frappe -g frappe '${remote_dir}'
  sudo -u frappe bash -lc '
    cd ${STAGING_BENCH}
    bench --site ${STAGING_SITE} backup --compress \
      --backup-path-db ${remote_dir}/staging-database.sql.gz
    tar cf ${remote_dir}/staging-public-files.tar \
      -C sites/${STAGING_SITE}/public files
    tar czf ${remote_dir}/staging-apps.tar.gz -C apps \
      --exclude=lms/node_modules --exclude=lms/.git \
      --exclude=payments/.git lms payments
  '
  sudo find '${remote_dir}' -maxdepth 1 -type f \
    -exec chown ${STAGING_USER}:${STAGING_USER} {} + \
    -exec chmod 600 {} +
  sudo chown ${STAGING_USER}:${STAGING_USER} '${remote_dir}'
  sudo chmod 700 '${remote_dir}'"
scp "${SSH_OPTS[@]}" "$REMOTE:${remote_dir}/staging-database.sql.gz" "$WORK/"
scp "${SSH_OPTS[@]}" "$REMOTE:${remote_dir}/staging-public-files.tar" "$WORK/"
scp "${SSH_OPTS[@]}" "$REMOTE:${remote_dir}/staging-apps.tar.gz" "$WORK/"
ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo rm -rf '${remote_dir}'"

for artifact in staging-database.sql.gz staging-public-files.tar staging-apps.tar.gz; do
  [[ -s "${WORK}/${artifact}" ]] || { echo "Downloaded artifact is empty: $artifact" >&2; exit 1; }
done

echo "==> Backing up current local environment"
PHASE="local backup"
"${COMPOSE[@]}" exec -T frappe bash -lc "
  set -e
  cd /workspace/frappe-bench
  bench --site ${SITE} backup --compress \
    --backup-path-db /tmp/local-database.sql.gz
  tar cf /tmp/local-public-files.tar -C sites/${SITE}/public files
  tar cf /tmp/local-private-files.tar -C sites/${SITE}/private files
  tar czf /tmp/local-apps.tar.gz -C apps \
    --exclude='*/node_modules' --exclude='*/.git' lms payments
"
for artifact in local-database.sql.gz local-public-files.tar local-private-files.tar local-apps.tar.gz; do
  docker cp "deltaspmu-dev-frappe-1:/tmp/${artifact}" "${BACKUP_DIR}/${artifact}"
done

echo "==> Restoring staging into local dev"
PHASE="restore"
MUTATION_STARTED=1
"${COMPOSE[@]}" exec -T frappe pkill -u frappe -f 'honcho|bench start' >/dev/null 2>&1 || true
docker cp "${WORK}/staging-database.sql.gz" deltaspmu-dev-frappe-1:/tmp/staging-database.sql.gz
docker cp "${WORK}/staging-public-files.tar" deltaspmu-dev-frappe-1:/tmp/staging-public-files.tar
docker cp "${WORK}/staging-apps.tar.gz" deltaspmu-dev-frappe-1:/tmp/staging-apps.tar.gz
"${COMPOSE[@]}" exec -T -u root frappe chmod 644 \
  /tmp/staging-database.sql.gz /tmp/staging-public-files.tar /tmp/staging-apps.tar.gz

"${COMPOSE[@]}" exec -T frappe bash -lc "
  set -e
  cd /workspace/frappe-bench
  rm -rf apps/lms apps/payments
  tar xzf /tmp/staging-apps.tar.gz -C apps
  ./env/bin/pip install -q -e apps/lms
  ./env/bin/pip install -q -e apps/payments
  bench --site ${SITE} restore /tmp/staging-database.sql.gz \
    --mariadb-root-username root --mariadb-root-password 123 --force
  rm -rf sites/${SITE}/public/files
  mkdir -p sites/${SITE}/public
  tar xf /tmp/staging-public-files.tar -C sites/${SITE}/public
  bench --site ${SITE} migrate
"

echo "==> Sanitizing identities, credentials, sessions, and integrations"
PHASE="sanitization"
"${COMPOSE[@]}" exec -T frappe bash -lc \
  "cd /workspace/frappe-bench && ./env/bin/python /repo/scripts/sanitize_staging_clone.py ${SITE}" |
  tee "${BACKUP_DIR}/sanitization.log"
grep -q '^SANITIZE_OK ' "${BACKUP_DIR}/sanitization.log"
"${COMPOSE[@]}" exec -T frappe bash -lc \
  "cd /workspace/frappe-bench && bench --site ${SITE} clear-cache"

echo "==> Starting and verifying local backend"
PHASE="verification"
restart_local_backend
for attempt in {1..30}; do
  if curl -fsS -H "Host: ${SITE}" "http://127.0.0.1:8000/api/method/ping" >/dev/null 2>&1; then
    break
  fi
  [[ "$attempt" -lt 30 ]] || { echo "Local API did not become healthy." >&2; exit 1; }
  sleep 2
done

login_response="$(curl -fsS -H "Host: ${SITE}" -H 'Content-Type: application/json' \
  -d '{"usr":"Administrator","pwd":"admin"}' \
  "http://127.0.0.1:8000/api/method/login")"
grep -q '"Logged In"' <<<"$login_response"

"${COMPOSE[@]}" exec -T frappe bash -lc "
  cd /workspace/frappe-bench
  bench --site ${SITE} mariadb -N -e \"
    SELECT CONCAT('courses=', COUNT(*)) FROM \\\`tabLMS Course\\\`;
    SELECT CONCAT('users=', COUNT(*)) FROM \\\`tabUser\\\`;
    SELECT CONCAT('sessions=', COUNT(*)) FROM \\\`tabSessions\\\`;
  \"
"

MUTATION_STARTED=0
echo
echo "==> Staging-to-dev refresh complete"
echo "Admin portal: http://127.0.0.1:5174"
echo "Login: Administrator / admin"
echo "Previous local backup: ${BACKUP_DIR}"
