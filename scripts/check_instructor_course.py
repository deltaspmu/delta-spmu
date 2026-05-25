exec("""
import frappe
print('--- All LMS Courses (any published state) ---')
rows = frappe.db.sql('''
    SELECT name, title, published, status
    FROM `tabLMS Course`
    ORDER BY creation
''', as_dict=True)
for r in rows:
    print(f'  name={r.name!r:35} published={r.published}  status={r.status!r}  title={r.title!r}')

print()
print('--- Looking for Instructor Licensing ---')
candidates = frappe.db.sql('''
    SELECT name, title, published, status
    FROM `tabLMS Course`
    WHERE name LIKE %s OR title LIKE %s
''', ('%instructor%', '%nstructor%'), as_dict=True)
for c in candidates:
    print(f'  {c}')
""")
