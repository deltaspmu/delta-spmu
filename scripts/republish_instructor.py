exec("""
import frappe
frappe.db.set_value('LMS Course', 'instructor-licensing', 'published', 1)
frappe.db.commit()
print('re-published instructor-licensing')
""")
