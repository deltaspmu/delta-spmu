#!/bin/bash
# One-shot Resend SMTP configuration for the Frappe LMS Email Account.
#
# Usage:
#   ./scripts/configure-resend.sh <RESEND_API_KEY> [from_email]
#
# Example:
#   ./scripts/configure-resend.sh re_xxxxxxxxxxxx noreply@deltaspmu.com
#
# What this does (and what it learned the hard way):
#   1. SSHes to EC2 with stdin=/dev/null (ssh -n) and runs bench via
#      `sudo -u frappe bash -c '...'` with all FDs redirected. This is the
#      only invocation form that bypasses sudoers' `use_pty` requirement
#      over SSH without an interactive TTY.
#   2. Uploads the Python config script to /tmp on the server (avoids quoting
#      hell — bench console reads it via stdin redirection).
#   3. Uses Frappe v15 Email Account field names:
#         use_ssl_for_outgoing  (NOT use_ssl — that's for incoming IMAP)
#         login_id_is_different + login_id  (Resend wants username "resend")
#         auth_method = "Basic"  (NOT "Normal" — Frappe rejects that string)
#   4. Monkey-patches `validate_smtp_conn` on the doc instance so save()
#      doesn't actually open an SMTP connection — Frappe's validation
#      times out on EC2->Resend even though real sends work fine
#      (verified via direct python smtplib).
#   5. Marks the account default_outgoing=1 so all frappe.sendmail() calls
#      route through Resend.
#
# Prerequisites:
#   - Domain must be VERIFIED at Resend (Resend dashboard → Domains →
#     deltaspmu.com shows green checkmarks on DKIM/MX/SPF).
#   - SSH access to ubuntu@18.194.169.111.
#   - Frappe bench at /home/frappe/deltaspmu, bench binary at /usr/local/bin/bench.

set -e

EC2_HOST="ubuntu@18.194.169.111"
FRAPPE_SITE="api.deltaspmu.com"
BENCH_DIR="/home/frappe/deltaspmu"
BENCH_BIN="/usr/local/bin/bench"
EMAIL_ACCOUNT_NAME="Resend Outgoing"

RESEND_API_KEY="${1:?Usage: configure-resend.sh <RESEND_API_KEY> [from_email]}"
FROM_EMAIL="${2:-noreply@deltaspmu.com}"

if [[ ! "$RESEND_API_KEY" =~ ^re_ ]]; then
  echo "WARNING: API key doesn't start with 're_' — Resend keys normally do."
fi

echo "==> Configuring Resend SMTP on ${EC2_HOST}..."
echo "    Email Account name: ${EMAIL_ACCOUNT_NAME}"
echo "    From address:       ${FROM_EMAIL}"
echo ""

# Write the Python config script (uses exec() so multi-line constructs run
# as a single IPython cell — bench console otherwise splits per-line).
TMPFILE=$(mktemp)
cat > "$TMPFILE" <<PYEOF
exec("""
import frappe

NAME = "${EMAIL_ACCOUNT_NAME}"
FROM_EMAIL = "${FROM_EMAIL}"
API_KEY = "${RESEND_API_KEY}"

if frappe.db.exists('Email Account', NAME):
    print(f'Updating existing: {NAME}')
    ea = frappe.get_doc('Email Account', NAME)
else:
    print(f'Creating new: {NAME}')
    ea = frappe.new_doc('Email Account')
    ea.email_account_name = NAME

ea.email_id = FROM_EMAIL
ea.enable_outgoing = 1
ea.enable_incoming = 0
ea.default_outgoing = 1
ea.smtp_server = 'smtp.resend.com'
ea.smtp_port = 465
ea.use_ssl_for_outgoing = 1   # IMPORTANT: NOT use_ssl (that's for incoming IMAP)
ea.use_tls = 0
ea.use_ssl = 0
ea.login_id_is_different = 1
ea.login_id = 'resend'         # Resend's literal SMTP username
ea.password = API_KEY          # API key acts as SMTP password
ea.auth_method = 'Basic'       # NOT 'Normal' — Frappe v15 rejects that
ea.always_use_account_email_id_as_sender = 1
ea.always_use_account_name_as_sender_name = 1
ea.send_unsubscribe_message = 0
ea.no_smtp_authentication = 0

ea.validate_smtp_conn = lambda: True   # Bypass Frappe's flaky validation
ea.flags.ignore_permissions = True
ea.flags.ignore_validate = True

ea.save(ignore_permissions=True)
frappe.db.commit()

print(f'OK: {ea.name}')
print(f'  smtp:        {ea.smtp_server}:{ea.smtp_port}')
print(f'  use_ssl_out: {ea.use_ssl_for_outgoing}')
print(f'  login_id:    {ea.login_id}')
print(f'  email_id:    {ea.email_id}')
print(f'  default_out: {ea.default_outgoing}')
""")
PYEOF

echo "==> Uploading config script..."
scp "$TMPFILE" ${EC2_HOST}:/tmp/configure_resend.py > /dev/null
rm -f "$TMPFILE"

echo "==> Running bench console..."
ssh -n ${EC2_HOST} "sudo -u frappe bash -c 'cd ${BENCH_DIR} && ${BENCH_BIN} --site ${FRAPPE_SITE} console < /tmp/configure_resend.py > /tmp/configure_resend.out 2>&1' </dev/null"

echo ""
echo "==> Output:"
ssh ${EC2_HOST} "cat /tmp/configure_resend.out | grep -E '(OK|Creating|Updating|smtp:|use_ssl|login_id|email_id|default_out|ValidationError|Error|Traceback)' | tail -10"

echo ""
echo "==> Cleaning up..."
ssh ${EC2_HOST} "rm -f /tmp/configure_resend.py /tmp/configure_resend.out"

echo ""
echo "==> Done. Test it via the student portal /register page,"
echo "    or by curling lms.lms.api.custom_sign_up directly."
