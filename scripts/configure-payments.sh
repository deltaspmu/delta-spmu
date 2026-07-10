#!/bin/bash
# Configure payment providers and Vimeo for Delta SPMU Academy
# Runs ON the EC2 server. Environment is selected via env vars (defaults = prod):
#
#   # staging example — stream it over SSH with the env pre-set:
#   ssh ubuntu@<STAGING-IP> "SITE_NAME=staging-api.deltaspmu.com \
#     API_URL=https://staging-api.deltaspmu.com \
#     PORTAL_URL=https://staging-learn.deltaspmu.com \
#     TELEBIRR_ENV=sandbox bash -s" < scripts/configure-payments.sh
#
# OR run locally to generate the commands:
#   bash scripts/configure-payments.sh --dry-run
#
# Fill in all <PLACEHOLDER> values before running.

set -e

BENCH_DIR="${BENCH_DIR:-/home/frappe/deltaspmu}"
SITE_NAME="${SITE_NAME:-api.deltaspmu.com}"
API_URL="${API_URL:-https://api.deltaspmu.com}"
PORTAL_URL="${PORTAL_URL:-https://learn.deltaspmu.com}"
TELEBIRR_ENV="${TELEBIRR_ENV:-sandbox}"

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "==> DRY RUN: printing commands only (not executing)"
  echo ""
fi

run_bench() {
  if [ "$DRY_RUN" = true ]; then
    echo "  bench set-config $@"
  else
    cd ${BENCH_DIR} && sudo -u frappe /home/frappe/.local/bin/bench set-config "$@"
  fi
}

echo "============================================================"
echo "  Delta SPMU Academy — Payment & Service Configuration"
echo "============================================================"
echo ""

# ============================================================================
# Vimeo
# ============================================================================
echo "--- Vimeo ---"
echo "  Shared Vimeo account. Videos tagged 'deltaspmu-lms' are filtered."
echo ""
run_bench vimeo_access_token "<VIMEO-ACCESS-TOKEN>"

# ============================================================================
# telebirr (Mobile Money)
# ============================================================================
echo ""
echo "--- telebirr ---"
echo "  Ethiopia's largest mobile money platform."
echo "  Apply at: https://developer.ethiotelecom.et"
echo ""
run_bench telebirr_fabric_app_id   "<TELEBIRR-FABRIC-APP-ID>"
run_bench telebirr_app_secret      "<TELEBIRR-APP-SECRET>"
run_bench telebirr_merchant_app_id "<TELEBIRR-MERCHANT-APP-ID>"
run_bench telebirr_merchant_code   "<TELEBIRR-MERCHANT-CODE>"
run_bench telebirr_private_key     "<TELEBIRR-RSA-PRIVATE-KEY>"
run_bench telebirr_public_key      "<TELEBIRR-RSA-PUBLIC-KEY>"
run_bench telebirr_environment     "${TELEBIRR_ENV}"
run_bench telebirr_notify_url      "${API_URL}/api/method/lms.lms.payments_api.telebirr_notify"
run_bench telebirr_redirect_url    "${PORTAL_URL}/payment/success"

# ============================================================================
# Chapa
# ============================================================================
echo ""
echo "--- Chapa ---"
echo "  Ethiopian payment gateway (local + international cards)."
echo "  Apply at: https://dashboard.chapa.co"
echo ""
run_bench chapa_secret_key      "<CHAPA-SECRET-KEY>"
run_bench chapa_webhook_secret  "<CHAPA-WEBHOOK-SECRET>"
run_bench chapa_callback_url    "${API_URL}/api/method/lms.lms.payments_api.chapa_webhook"
run_bench chapa_return_url      "${PORTAL_URL}/payment/success"

# ============================================================================
# EthSwitch (National Payment Gateway)
# ============================================================================
echo ""
echo "--- EthSwitch ---"
echo "  National payment switch connecting all Ethiopian banks."
echo "  Apply through your bank's merchant services."
echo ""
run_bench ethswitch_base_url    "<ETHSWITCH-BASE-URL>"
run_bench ethswitch_username    "<ETHSWITCH-MERCHANT-USERNAME>"
run_bench ethswitch_password    "<ETHSWITCH-MERCHANT-PASSWORD>"
run_bench ethswitch_return_url  "${API_URL}/api/method/lms.lms.payments_api.ethswitch_return"
run_bench ethswitch_webhook_url "${API_URL}/api/method/lms.lms.payments_api.ethswitch_webhook"

# ============================================================================
# CBE (Commercial Bank of Ethiopia — manual bank transfer)
# ============================================================================
echo ""
echo "--- CBE (Bank Transfer) ---"
echo "  Manual bank transfer. Users pay, then submit reference number."
echo "  No API integration needed — verification is manual via admin portal."
echo ""
run_bench cbe_account_name   "Delta SPMU Academy"
run_bench cbe_account_number "<CBE-ACCOUNT-NUMBER>"
run_bench cbe_bank_name      "Commercial Bank of Ethiopia"

# ============================================================================
# CORS / Allowed Origins
# ============================================================================
echo ""
echo "--- CORS Configuration ---"
echo ""
if [ "$DRY_RUN" = true ]; then
  echo "  bench --site ${SITE_NAME} set-config allow_cors \"*\""
  echo ""
  echo "  For production, restrict to specific origins:"
  echo "  bench --site ${SITE_NAME} set-config allow_cors '[\"https://deltaspmu.com\",\"https://learn.deltaspmu.com\",\"https://admin.deltaspmu.com\"]'"
else
  cd ${BENCH_DIR} && sudo -u frappe /home/frappe/.local/bin/bench --site ${SITE_NAME} set-config allow_cors "*"
  echo "  CORS set to allow all origins. Restrict in production."
fi

echo ""
echo "============================================================"
echo "  Configuration complete!"
echo "============================================================"
echo ""
echo "  Remember to restart bench after configuring:"
echo "    cd ${BENCH_DIR} && sudo -u frappe /home/frappe/.local/bin/bench restart"
echo ""
echo "  To switch telebirr to production:"
echo "    bench set-config telebirr_environment production"
echo ""
echo "  To verify config values:"
echo "    bench --site ${SITE_NAME} show-config"
echo ""
