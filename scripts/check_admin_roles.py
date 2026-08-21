exec("""
import frappe

users = {'Administrator'}
users.update(frappe.get_all(
    'Has Role',
    filters={'role': 'System Manager', 'parenttype': 'User'},
    pluck='parent',
))

for u in sorted(users):
    if not frappe.db.exists('User', u):
        print(f'{u!r}: does not exist')
        continue
    enabled = frappe.db.get_value('User', u, 'enabled')
    roles = frappe.get_roles(u)
    print(f'{u!r}:')
    print(f'  enabled: {enabled}')
    print(f'  roles:   {roles}')
    print(f'  is_sys_mgr: {"System Manager" in roles}')
    print()
""")
