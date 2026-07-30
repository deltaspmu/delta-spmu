"""Canonical Delta SPMU LMS feature settings and site configuration."""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from lms.lms.branding import SITE_NAME


PAYMENT_GATEWAY = "Chapa"
DEFAULT_CURRENCY = "ETB"


# These fields form the public ``get_lms_settings`` contract but are not part
# of every upstream LMS release. Keep them as Custom Fields so the singleton
# remains the persisted source of truth instead of hard-coding the API result.
CUSTOM_FIELDS = {
    "LMS Settings": [
        {
            "fieldname": "delta_platform_settings_section",
            "fieldtype": "Section Break",
            "label": "Delta Platform Features",
            "insert_after": "general_tab",
        },
        {
            "fieldname": "lms_title",
            "fieldtype": "Data",
            "label": "LMS Title",
            "insert_after": "delta_platform_settings_section",
        },
        {
            "fieldname": "force_published_on_creation",
            "fieldtype": "Check",
            "label": "Publish Courses on Creation",
            "insert_after": "lms_title",
        },
        {
            "fieldname": "allow_self_enrollment",
            "fieldtype": "Check",
            "label": "Allow Self Enrollment",
            "insert_after": "force_published_on_creation",
        },
        {
            "fieldname": "send_enrollment_email",
            "fieldtype": "Check",
            "label": "Send Enrollment Email",
            "insert_after": "allow_self_enrollment",
        },
        {
            "fieldname": "show_reviews",
            "fieldtype": "Check",
            "label": "Show Reviews",
            "insert_after": "send_enrollment_email",
        },
        {
            "fieldname": "allow_reviews",
            "fieldtype": "Check",
            "label": "Allow Reviews",
            "insert_after": "show_reviews",
        },
        {
            "fieldname": "show_progress",
            "fieldtype": "Check",
            "label": "Show Course Progress",
            "insert_after": "allow_reviews",
        },
        {
            "fieldname": "enable_certificates",
            "fieldtype": "Check",
            "label": "Enable Certificates",
            "insert_after": "show_progress",
        },
        {
            "fieldname": "enable_gamification",
            "fieldtype": "Check",
            "label": "Enable Gamification",
            "insert_after": "enable_certificates",
        },
        {
            "fieldname": "enable_payments",
            "fieldtype": "Check",
            "label": "Enable Payments",
            "insert_after": "enable_gamification",
        },
        {
            "fieldname": "enrollment_requires_approval",
            "fieldtype": "Check",
            "label": "Enrollment Requires Approval",
            "insert_after": "enable_payments",
        },
    ]
}


CANONICAL_SETTINGS = {
    "lms_title": SITE_NAME,
    "force_published_on_creation": 0,
    "allow_self_enrollment": 1,
    "send_enrollment_email": 1,
    "show_reviews": 1,
    "allow_reviews": 1,
    "show_progress": 1,
    "enable_certificates": 1,
    "enable_gamification": 0,
    "enable_payments": 1,
    "enrollment_requires_approval": 0,
    # Stock LMS equivalents used outside the custom portal/API.
    "certifications": 1,
    "payment_gateway": PAYMENT_GATEWAY,
    "default_currency": DEFAULT_CURRENCY,
}


def _create_missing_custom_fields():
    """Install only fields absent from the current upstream LMS schema."""
    meta = frappe.get_meta("LMS Settings")
    missing = [
        field
        for field in CUSTOM_FIELDS["LMS Settings"]
        if not meta.has_field(field["fieldname"])
    ]
    if missing:
        create_custom_fields({"LMS Settings": missing}, update=True)
        frappe.clear_cache(doctype="LMS Settings")
    return [field["fieldname"] for field in missing]


def apply_lms_settings():
    """Persist the canonical feature configuration on the current site.

    Run after deploying the backend overlay:

        bench --site <site> execute lms.lms.platform_settings.apply_lms_settings

    The operation is idempotent and tolerates LMS versions that add or remove
    optional stock fields.
    """
    created_fields = _create_missing_custom_fields()
    meta = frappe.get_meta("LMS Settings")
    configured = []

    for field, value in CANONICAL_SETTINGS.items():
        if meta.has_field(field):
            frappe.db.set_single_value("LMS Settings", field, value)
            configured.append(field)

    frappe.db.commit()
    frappe.clear_cache(doctype="LMS Settings")
    return {
        "configured": configured,
        "created_fields": created_fields,
        "payment_gateway": PAYMENT_GATEWAY,
        "currency": DEFAULT_CURRENCY,
    }
