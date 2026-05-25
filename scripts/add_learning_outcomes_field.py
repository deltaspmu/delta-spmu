"""Add a 'learning_outcomes' Long Text custom field to LMS Course.

The field stores a newline-separated list of bullet points (one outcome
per line). Kept as plain text rather than a child table so it shows up
naturally in the admin list/get endpoints without joining.
"""
exec("""
import frappe

FIELDNAME = 'learning_outcomes'
DOCTYPE = 'LMS Course'
NAME = f'{DOCTYPE}-{FIELDNAME}'

if frappe.db.exists('Custom Field', NAME):
    print(f'Custom Field already exists: {NAME}')
else:
    cf = frappe.get_doc({
        'doctype': 'Custom Field',
        'dt': DOCTYPE,
        'fieldname': FIELDNAME,
        'fieldtype': 'Long Text',
        'label': 'Learning Outcomes',
        'description': 'One outcome per line. Shown on the course detail page.',
        'insert_after': 'description',
        'translatable': 0,
    })
    cf.insert(ignore_permissions=True)
    frappe.db.commit()
    print(f'Created Custom Field: {NAME}')

# Verify
columns = frappe.db.sql(f'SHOW COLUMNS FROM `tab{DOCTYPE}` LIKE %(f)s', {'f': FIELDNAME}, as_dict=True)
print(f'DB column: {columns}')
""")
