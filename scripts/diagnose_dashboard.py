exec("""
import frappe

print('--- User counts by user_type + enabled ---')
rows = frappe.db.sql('''
    SELECT user_type, enabled, COUNT(*) as n
    FROM tabUser
    GROUP BY user_type, enabled
    ORDER BY user_type, enabled
''', as_dict=True)
for r in rows:
    print(f'  user_type={r.user_type!r:20} enabled={r.enabled} count={r.n}')

print()
print('--- All Website Users (any enabled state) ---')
website = frappe.db.get_all('User',
    filters={'user_type': 'Website User'},
    fields=['name', 'email', 'enabled', 'creation'],
    order_by='creation desc',
    limit=10)
for u in website:
    print(f'  {u.name:35} enabled={u.enabled}  created={u.creation}')

print()
print('--- Counts the dashboard uses ---')
n_users = frappe.db.count('User', {'enabled': 1, 'user_type': 'Website User'})
n_courses_published = frappe.db.count('LMS Course', {'published': 1})
n_courses_total = frappe.db.count('LMS Course')
n_enrollments = frappe.db.count('LMS Enrollment')
print(f'  enabled+Website Users: {n_users}')
print(f'  published LMS Courses: {n_courses_published}')
print(f'  ALL LMS Courses:       {n_courses_total}')
print(f'  LMS Enrollments:       {n_enrollments}')

print()
print('--- LMS Course published state ---')
courses = frappe.db.get_all('LMS Course', fields=['name', 'title', 'published'])
for c in courses:
    print(f'  {c.name:35} published={c.published}  title={c.title}')
""")
