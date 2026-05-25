exec(r"""
import frappe
for dt in ['LMS Enrollment', 'LMS Certificate']:
    meta = frappe.get_meta(dt)
    fields = sorted(f.fieldname for f in meta.fields if f.fieldname and not f.fieldname.startswith('section'))
    print()
    print('=== ' + dt + ' ===')
    for fn in fields:
        f = meta.get_field(fn)
        print('  ' + fn.ljust(35) + ' ' + (f.fieldtype or ''))
""")
