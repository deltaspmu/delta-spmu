exec(r"""
import frappe
errs = frappe.db.get_all('Error Log',
    fields=['name','method','creation','error'],
    filters={'method': ['like', '%enrolled%']},
    order_by='creation desc',
    limit=1)
for e in errs:
    print('=== ' + str(e.creation) + ' method=' + repr(e.method) + ' ===')
    print(e.error or '(no error body)')
""")
