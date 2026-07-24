"""Canonical Delta SPMU branding and idempotent site configuration."""

import frappe


SITE_NAME = "Delta SPMU Academy"
PRIMARY_COLOR = "#8B8D5A"
SECONDARY_COLOR = "#C0703C"


def _set_single_if_present(doctype, field, value):
    """Set a singleton field when it exists in the installed LMS version."""
    if frappe.get_meta(doctype).has_field(field):
        frappe.db.set_single_value(doctype, field, value)
        return True
    return False


def apply_branding():
    """Apply the academy name, palette, and signup policy to the current site.

    Run after deploying the backend overlay:

        bench --site <site> execute lms.lms.branding.apply_branding

    Optional LMS branding fields vary between upstream versions, so they are
    only written when present. Website Settings and the stock LMS signup field
    are configured on every supported installation.
    """
    configured = {}
    settings = {
        "Website Settings": {
            "app_name": SITE_NAME,
            "disable_signup": 0,
        },
        "LMS Settings": {
            "disable_signup": 0,
            "lms_title": SITE_NAME,
            "hero_title": SITE_NAME,
            "primary_color": PRIMARY_COLOR,
            "secondary_color": SECONDARY_COLOR,
        },
    }

    for doctype, values in settings.items():
        configured[doctype] = []
        for field, value in values.items():
            if _set_single_if_present(doctype, field, value):
                configured[doctype].append(field)

    frappe.db.commit()
    frappe.clear_cache()
    return {
        "site_name": SITE_NAME,
        "primary_color": PRIMARY_COLOR,
        "secondary_color": SECONDARY_COLOR,
        "disable_signup": False,
        "configured": configured,
    }
