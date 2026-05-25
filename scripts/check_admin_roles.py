exec("""
import frappe

for u in ('Administrator', 'administrator@deltaspmu.com'):
    if not frappe.db.exists('User', u):
        print(f'{u!r}: does not exist')
        continue
    enabled = frappe.db.get_value('User', u, 'enabled')
    roles = [r.role for r in frappe.get_doc('User', u).roles]
    print(f'{u!r}:')
    print(f'  enabled: {enabled}')
    print(f'  roles:   {roles}')
    print(f'  is_sys_mgr: {"System Manager" in roles}')
    print()
""")
