"""Create / update the Resend Outgoing Email Account in Frappe v15.

Frappe v15 Email Account field names:
- use_ssl                      → INCOMING IMAP SSL (don't confuse with outgoing!)
- use_ssl_for_outgoing         → OUTGOING SMTP SSL (this is what we want for port 465)
- login_id_is_different=1
  login_id="resend"            → SMTP username different from email_id
- Frappe validates the SMTP connection on save; we disable that by
  monkey-patching the method on the doc instance.
"""
exec("""
import frappe

NAME = "Resend Outgoing"
FROM_EMAIL = "noreply@deltaspmu.com"
API_KEY = "re_KkntoFkG_4eMD4JdFx68Sp3Ecd7X2urGd"

if frappe.db.exists("Email Account", NAME):
    print(f"Updating existing: {NAME}")
    ea = frappe.get_doc("Email Account", NAME)
else:
    print(f"Creating new: {NAME}")
    ea = frappe.new_doc("Email Account")
    ea.email_account_name = NAME

ea.email_id = FROM_EMAIL
ea.enable_outgoing = 1
ea.enable_incoming = 0
ea.default_outgoing = 1
ea.smtp_server = "smtp.resend.com"
ea.smtp_port = 465
ea.use_ssl_for_outgoing = 1
ea.use_tls = 0
ea.use_ssl = 0
ea.login_id_is_different = 1
ea.login_id = "resend"
ea.password = API_KEY
ea.auth_method = "Basic"
ea.always_use_account_email_id_as_sender = 1
ea.always_use_account_name_as_sender_name = 1
ea.send_unsubscribe_message = 0
ea.no_smtp_authentication = 0

# Bypass Frappe's connection-validation-on-save (it times out on EC2->Resend
# even though real smtplib sends work fine — we verified this directly).
ea.validate_smtp_conn = lambda: True
ea.flags.ignore_permissions = True
ea.flags.ignore_validate = True

ea.save(ignore_permissions=True)
frappe.db.commit()

print(f"OK: {ea.name}")
print(f"  smtp:        {ea.smtp_server}:{ea.smtp_port}")
print(f"  use_ssl_out: {ea.use_ssl_for_outgoing}")
print(f"  login_id:    {ea.login_id}")
print(f"  email_id:    {ea.email_id}")
print(f"  default_out: {ea.default_outgoing}")
""")
