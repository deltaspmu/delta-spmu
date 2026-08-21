exec("""
import os
import frappe

user = os.environ.get('VERIFY_USER', 'Administrator').strip()
print(f'Roles for {user!r}:')
roles = frappe.get_roles(user)
print(f'  count: {len(roles)}')
for r in roles:
    marker = '  *** ' if r == 'System Manager' else '    '
    print(f'{marker}{r!r}')
print()
print(f'System Manager in roles? {\"System Manager\" in roles}')
""")
