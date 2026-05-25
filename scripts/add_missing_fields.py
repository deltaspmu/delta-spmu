exec(r"""
import frappe
import uuid

def add_field(dt, fieldname, label, fieldtype, insert_after):
    if frappe.db.exists('Custom Field', {'dt': dt, 'fieldname': fieldname}):
        print('  exists: ' + dt + '.' + fieldname)
        return
    cf = frappe.get_doc({
        'doctype': 'Custom Field',
        'dt': dt,
        'fieldname': fieldname,
        'label': label,
        'fieldtype': fieldtype,
        'insert_after': insert_after,
    })
    cf.flags.ignore_permissions = True
    cf.flags.ignore_validate = True
    cf.insert(ignore_permissions=True)
    print('  created: ' + dt + '.' + fieldname)

add_field('LMS Enrollment', 'enrollment_date', 'Enrollment Date', 'Date', 'member')
add_field('LMS Certificate', 'certificate_id', 'Certificate ID', 'Data', 'member')

# Backfill
unset_certs = frappe.db.get_all('LMS Certificate',
    filters={'certificate_id': ['in', ['', None]]},
    fields=['name'])
for c in unset_certs:
    cid = 'DELTA-SPMU-' + uuid.uuid4().hex[:12].upper()
    frappe.db.set_value('LMS Certificate', c.name, 'certificate_id', cid, update_modified=False)
print('Backfilled certificate_id on ' + str(len(unset_certs)) + ' certificates')

unset_enrl = frappe.db.get_all('LMS Enrollment',
    filters={'enrollment_date': ['in', ['', None]]},
    fields=['name', 'creation'])
for e in unset_enrl:
    if e.creation:
        d = e.creation.date() if hasattr(e.creation, 'date') else str(e.creation)[:10]
        frappe.db.set_value('LMS Enrollment', e.name, 'enrollment_date', d, update_modified=False)
print('Backfilled enrollment_date on ' + str(len(unset_enrl)) + ' enrollments')

frappe.db.commit()
print('Done.')
""")
