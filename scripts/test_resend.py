"""Verify Frappe Email Account + send a real test email through Resend.

Usage on EC2:
    sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com console < /tmp/test_resend.py
"""
import frappe
from lms.lms.email_templates import welcome

RECIPIENT = "tigrayinsights@gmail.com"

print("=== Email Account check ===")
if frappe.db.exists("Email Account", "Resend Outgoing"):
    ea = frappe.get_doc("Email Account", "Resend Outgoing")
    print(f"  name:         {ea.name}")
    print(f"  smtp_server:  {ea.smtp_server}")
    print(f"  smtp_port:    {ea.smtp_port}")
    print(f"  use_ssl:      {ea.use_ssl}")
    print(f"  login_id:     {ea.login_id_for_sending}")
    print(f"  default_out:  {ea.default_outgoing}")
    print(f"  email_id:     {ea.email_id}")
else:
    print("  MISSING: Resend Outgoing not found")
    raise SystemExit(1)

print()
print("=== Sending test email ===")
print(f"  to: {RECIPIENT}")
try:
    frappe.sendmail(
        recipients=[RECIPIENT],
        subject="Delta SPMU — Resend SMTP test",
        message=welcome(student_name="Delta SPMU Admin"),
        now=True,
        retry=1,
    )
    print("  OK: sendmail accepted the message (queued to SMTP).")
    print("  Check Resend dashboard → Emails for delivery status.")
except Exception as e:
    print(f"  FAILED: {e}")
    raise
