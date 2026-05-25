exec("""
import frappe

print('--- Last 5 Email Queue entries ---')
q = frappe.db.get_all('Email Queue',
    fields=['name', 'status', 'error', 'creation', 'sender'],
    order_by='creation desc',
    limit=5)
for entry in q:
    err = (entry.error or '')[:100]
    print(f'  {entry.creation} | status={entry.status} | sender={entry.sender} | err={err}')

print()
print('--- Test user state ---')
print(f'  exists: {frappe.db.exists(chr(34)+\"User\"+chr(34), chr(34)+\"tigrayinsights@gmail.com\"+chr(34))}')
u = frappe.db.get_value('User', 'tigrayinsights@gmail.com', ['enabled','reset_password_key'], as_dict=True)
if u:
    print(f'  enabled: {u.enabled}')
    print(f'  has reset_key: {bool(u.reset_password_key)}')
    print(f'  reset_key value: {u.reset_password_key}')
""")
