exec("""
import frappe

OLD = 'Resend Outgoing'
NEW = 'Delta SPMU Academy'

if not frappe.db.exists('Email Account', OLD):
    print(f'  no Email Account named {OLD!r} found')
elif frappe.db.exists('Email Account', NEW):
    print(f'  {NEW!r} already exists; nothing to rename')
else:
    print(f'  renaming {OLD!r} -> {NEW!r}')
    # Frappe v15 rename_doc signature: (doctype, old, new, force=False,
    # merge=False, ignore_permissions=False, ignore_if_exists=False, ...)
    # but older signatures only accept positional + force/merge. Set the
    # session user to Administrator so rename bypasses permission checks.
    frappe.set_user('Administrator')
    frappe.rename_doc('Email Account', OLD, NEW, force=True)
    frappe.db.commit()
    print('  OK')

if frappe.db.exists('Email Account', NEW):
    ea = frappe.get_doc('Email Account', NEW)
    print(f'  final: name={ea.name!r}  email_id={ea.email_id!r}  default_out={ea.default_outgoing}')
""")
