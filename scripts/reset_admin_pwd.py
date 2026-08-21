exec("""
import os
import frappe
from frappe.utils.password import update_password

user = os.environ.get('ADMIN_USER', 'Administrator').strip()
password = os.environ.get('ADMIN_PASSWORD', '')

if not password:
    raise RuntimeError('Set ADMIN_PASSWORD in the environment before running this script.')
if not frappe.db.exists('User', user):
    raise RuntimeError(f'User {user!r} does not exist.')
if user != 'Administrator' and 'System Manager' not in frappe.get_roles(user):
    raise RuntimeError(f'User {user!r} is not a System Manager.')

update_password(user, password)
frappe.db.set_value('User', user, 'enabled', 1)
frappe.db.commit()
print(f'Reset password for {user!r}.')
""")
