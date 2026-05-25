exec("""
import frappe

print('--- All users with System Manager role ---')
role_links = frappe.get_all('Has Role',
    filters={'role': 'System Manager', 'parenttype': 'User'},
    fields=['parent'])
for link in role_links:
    u = frappe.db.get_value('User', link.parent,
        ['name', 'email', 'full_name', 'enabled'], as_dict=True)
    if u:
        print(f'  name={u.name!r}  email={u.email!r}  full={u.full_name!r}  enabled={u.enabled}')
""")
