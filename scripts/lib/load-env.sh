# Sourced by deploy/config scripts to load per-environment config.
#
#   source "$(dirname "$0")/lib/load-env.sh" "$1"
#
# $1 must be an environment name matching scripts/env/<name>.env.
# Exports ENV_NAME, EC2_HOST, FRAPPE_SITE, BENCH_DIR, BENCH_BIN, API_URL,
# PORTAL_URL, ADMIN_URL, CERT_EMAIL, FROM_EMAIL, TELEBIRR_ENV, ...

_LOAD_ENV_ARG="${1:?Usage: $(basename "$0") <staging|prod> [args...]}"
_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_ENV_FILE="${_SCRIPTS_DIR}/env/${_LOAD_ENV_ARG}.env"

if [ ! -f "$_ENV_FILE" ]; then
  echo "ERROR: unknown environment '${_LOAD_ENV_ARG}' — expected one of:" >&2
  ls "${_SCRIPTS_DIR}/env/" | sed 's/\.env$//; s/^/  /' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$_ENV_FILE"
set +a

for _v in ENV_NAME EC2_HOST FRAPPE_SITE BENCH_DIR BENCH_BIN API_URL; do
  if [ -z "${!_v}" ]; then
    echo "ERROR: ${_v} is not set in ${_ENV_FILE}" >&2
    exit 1
  fi
done

if [[ "$EC2_HOST" == *PENDING* ]]; then
  echo "ERROR: EC2_HOST in ${_ENV_FILE} is a placeholder — fill in the real host first." >&2
  exit 1
fi

# Guard rail: confirm before touching prod
if [ "$ENV_NAME" = "prod" ] && [ -z "$SKIP_PROD_CONFIRM" ]; then
  printf "You are targeting PRODUCTION (%s). Continue? [y/N] " "$FRAPPE_SITE" >&2
  read -r _ans
  case "$_ans" in y|Y|yes|YES) ;; *) echo "Aborted." >&2; exit 1 ;; esac
fi
