exec("""
import frappe
from frappe.utils.password import update_password

PASSWORD = 'AdminDelta!2026'

# Reset both admin-style accounts to the same password
for u in ('Administrator', 'administrator@deltaspmu.com'):
    if frappe.db.exists('User', u):
        update_password(u, PASSWORD)
        # Ensure enabled
        frappe.db.set_value('User', u, 'enabled', 1)
        print(f'  reset password for {u!r}')
    else:
        print(f'  skipped (not found): {u!r}')

frappe.db.commit()
print()
print(f'Use either username with password: {PASSWORD}')
""")
