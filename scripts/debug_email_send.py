"""Inspect Email Account state + try sendmail directly to see Frappe's path."""
import frappe

print("--- Email Account state ---")
ea = frappe.get_doc("Email Account", "Resend Outgoing")
for f in ("name", "smtp_server", "smtp_port", "use_ssl", "use_tls",
          "login_id_for_sending", "email_id", "default_outgoing",
          "always_use_account_email_id_as_sender"):
    print(f"  {f}: {getattr(ea, f)!r}")

# Check the password decrypts correctly
from frappe.utils.password import get_decrypted_password
try:
    pwd = get_decrypted_password("Email Account", ea.name, "password")
    print(f"  password decrypts OK (len={len(pwd)}, prefix={pwd[:3]}...)")
except Exception as e:
    print(f"  password decrypt FAILED: {e}")

print()
print("--- Trying SMTPServer.connect() directly ---")
from frappe.email.smtp import SMTPServer

smtp = SMTPServer(
    email_account=ea,
)
try:
    smtp.connect()
    print(f"  Frappe SMTPServer connected OK")
    smtp.session.quit()
except Exception as e:
    print(f"  Frappe SMTPServer FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
