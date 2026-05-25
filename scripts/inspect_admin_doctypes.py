exec("""
import frappe

DOCTYPES = [
    'LMS Enrollment',
    'LMS Quiz',
    'LMS Quiz Submission',
    'LMS Certificate',
    'LMS Course Review',
    'Payment Transaction',
    'Course Access',
    'LMS Category',
    'Course Chapter',
    'Course Lesson',
]

for dt in DOCTYPES:
    try:
        meta = frappe.get_meta(dt)
        print(f'=== {dt} ===')
        for f in meta.fields:
            if f.fieldname and not f.fieldname.startswith('column_break') and not f.fieldname.startswith('section_break') and not f.fieldname.startswith('tab_'):
                print(f'  {f.fieldname:35} {f.fieldtype or \"\":15} {(f.label or \"\")[:30]}')
        print()
    except Exception as e:
        print(f'=== {dt} ===  NOT FOUND: {e}')
        print()
""")
