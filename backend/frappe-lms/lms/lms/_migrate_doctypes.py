"""One-time migration helper: recreate the custom DocTypes the Delta overlay
depends on, which lived only in the lost Afritutors LMS fork.

Run after installing stock frappe/lms and deploying the overlay:
    bench --site api.deltaspmu.com execute lms.lms._migrate_doctypes.run

Idempotent: skips any DocType that already exists. The base fields below mirror
the fork's schema (recovered from the Afritutors 2026-05-28 DB dump). The extra
columns the API/portal expect (transaction_id, amount, eims_*, …) are layered on
afterwards by the existing setup_* functions:
    lms.lms.payments_api.setup_payment_transaction_fields
    lms.lms.eims.setup_eims_custom_fields
    lms.lms.telebirr_c2b.setup_telebirr_c2b_custom_fields

Course Access carries the UNION of every field name the payment modules use
(user/course/access_start/access_end from chapa+payments_api+api grant;
student/access_to/transaction from telebirr; billing_type/reference_name/
access_type/valid_until from api.validate_billing_access) so no code path hits a
missing column.
"""

import frappe


def _f(fieldname, fieldtype, label=None, options=None, default=None):
    d = {
        "fieldname": fieldname,
        "label": label or fieldname.replace("_", " ").title(),
        "fieldtype": fieldtype,
    }
    if options is not None:
        d["options"] = options
    if default is not None:
        d["default"] = default
    return d


PAYMENT_TRANSACTION_FIELDS = [
    _f("user", "Link", options="User"),
    _f("course", "Link", options="LMS Course"),
    _f("course_title", "Data"),
    _f("status", "Data", default="Pending"),
    _f("payment_method", "Data", default="telebirr"),
    _f("original_amount", "Currency"),
    _f("discount_percent", "Float"),
    _f("discount_amount", "Currency"),
    _f("final_amount", "Currency"),
    _f("currency", "Data", default="ETB"),
    _f("is_first_time_buyer", "Check"),
    _f("discount_reason", "Data"),
    _f("prepay_id", "Data"),
    _f("trade_no", "Data"),
    _f("checkout_url", "Small Text"),
    _f("notify_received", "Check"),
    _f("notify_payload", "Long Text"),
    _f("created_at", "Datetime"),
    _f("expires_at", "Datetime"),
    _f("completed_at", "Datetime"),
    _f("error_message", "Small Text"),
    _f("ethswitch_order_id", "Data"),
]

COURSE_ACCESS_FIELDS = [
    _f("user", "Link", options="User"),
    _f("student", "Link", options="User"),
    _f("course", "Link", options="LMS Course"),
    _f("payment_transaction", "Link", options="Payment Transaction"),
    _f("transaction", "Data"),
    _f("is_active", "Check", default="1"),
    _f("access_start", "Date"),
    _f("access_end", "Date"),
    _f("access_to", "Date"),
    _f("billing_type", "Data"),
    _f("reference_name", "Data"),
    _f("access_type", "Data"),
    _f("valid_until", "Date"),
]


def _module():
    return "LMS" if frappe.db.exists("Module Def", "LMS") else "Custom"


def _ensure(name, fields, is_submittable=0, autoname=None):
    if frappe.db.exists("DocType", name):
        return "EXISTS " + name
    naming_rule = ""
    if autoname == "hash":
        naming_rule = "Random"
    elif autoname and autoname.startswith("format:"):
        naming_rule = "Expression"
    doc = frappe.get_doc({
        "doctype": "DocType",
        "name": name,
        "module": _module(),
        "custom": 1,
        "is_submittable": is_submittable,
        "naming_rule": naming_rule,
        "autoname": autoname,
        "track_changes": 1,
        "fields": fields,
        "permissions": [{
            "role": "System Manager",
            "read": 1, "write": 1, "create": 1, "delete": 1,
            "submit": is_submittable, "cancel": is_submittable, "amend": is_submittable,
        }],
    })
    doc.insert(ignore_permissions=True)
    return "CREATED " + name


def run():
    results = [
        _ensure("Payment Transaction", PAYMENT_TRANSACTION_FIELDS, is_submittable=0, autoname="hash"),
        _ensure("Course Access", COURSE_ACCESS_FIELDS, is_submittable=1, autoname="format:CA-{user}-{course}"),
    ]
    frappe.db.commit()
    for r in results:
        print(r)
    return results
