exec("""
import frappe
meta = frappe.get_meta("Email Account")
print("--- Email Account fields (SMTP/auth/sender related) ---")
matches = [f for f in meta.fields if any(k in (f.fieldname or '').lower() for k in ['smtp','login','user','auth','password','outgoing','sender','tls','ssl','email_id'])]
for f in matches:
    print(f"  {f.fieldname:40} {f.fieldtype:15} {f.label or ''}")
""")
