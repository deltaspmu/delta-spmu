#!/usr/bin/env python3
"""Sanitize a restored staging Frappe database for local development.

Run inside the bench Python environment:
  ./env/bin/python /repo/scripts/sanitize_staging_clone.py lms.localhost
"""

from __future__ import annotations

import hashlib
import os
import sys

import frappe
from frappe.installer import update_site_config
from frappe.utils.password import update_password


SITE = sys.argv[1] if len(sys.argv) > 1 else "lms.localhost"
SYSTEM_USERS = {"Administrator", "Guest"}


def table_exists(doctype: str) -> bool:
    return bool(frappe.db.table_exists(doctype))


def columns(doctype: str) -> set[str]:
    if not table_exists(doctype):
        return set()
    return {row[0] for row in frappe.db.sql(f"SHOW COLUMNS FROM `tab{doctype}`")}


def delete_doctype(doctype: str) -> None:
    if table_exists(doctype):
        frappe.db.sql(f"DELETE FROM `tab{doctype}`")


def stable_token(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:length]


def sanitize_users() -> dict[str, str]:
    users = frappe.get_all(
        "User",
        filters={"name": ["not in", list(SYSTEM_USERS)]},
        fields=["name"],
        order_by="name asc",
    )
    mapping: dict[str, str] = {}
    for index, row in enumerate(users, start=1):
        old = row.name
        new = f"dev-{stable_token(old, 12)}@example.test"
        if old != new:
            frappe.rename_doc("User", old, new, force=True, merge=False)
        mapping[old] = new
        values = {
            "email": new,
            "username": f"devuser{index:04d}",
            "first_name": "Dev",
            "middle_name": "",
            "last_name": f"User {index:04d}",
            "full_name": f"Dev User {index:04d}",
            "phone": None,
            "mobile_no": None,
            "location": "",
            "bio": "",
            "user_image": "",
            "banner_image": "",
            "reset_password_key": "",
            "last_ip": "",
        }
        available = columns("User")
        frappe.db.set_value(
            "User",
            new,
            {key: value for key, value in values.items() if key in available},
            update_modified=False,
        )
        update_password(new, "DevUser@2026!")
    return mapping


def scrub_contact_data() -> None:
    field_values = {
        "Address": {
            "address_title": "Development Address",
            "address_line1": "Redacted",
            "address_line2": "",
            "city": "Local",
            "county": "",
            "state": "",
            "pincode": "",
            "phone": "",
            "fax": "",
            "email_id": "",
        },
        "Contact": {
            "first_name": "Development",
            "middle_name": "",
            "last_name": "Contact",
            "full_name": "Development Contact",
            "email_id": "",
            "phone": "",
            "mobile_no": "",
            "designation": "",
            "department": "",
            "address": "",
        },
        "Contact Email": {"email_id": ""},
        "Contact Phone": {"phone": ""},
        "LMS Payment": {"address": None},
    }
    for doctype, requested in field_values.items():
        available = columns(doctype)
        values = {key: value for key, value in requested.items() if key in available}
        if values:
            assignments = ", ".join(f"`{key}`=%s" for key in values)
            frappe.db.sql(
                f"UPDATE `tab{doctype}` SET {assignments}",
                tuple(values.values()),
            )


def scrub_payment_data() -> None:
    doctype = "Payment Transaction"
    available = columns(doctype)
    if not available:
        return
    sensitive = {
        "phone",
        "provider_reference",
        "user_reference",
        "transaction_id",
        "telebirr_bill_ref",
        "telebirr_msisdn",
        "ethswitch_order_id",
        "checkout_url",
        "raw_response",
        "response_data",
        "gateway_response",
    }
    rows = frappe.get_all(doctype, fields=["name"], order_by="name asc")
    for row in rows:
        token = stable_token(row.name)
        values = {}
        for field in sensitive & available:
            if field in {"phone", "telebirr_msisdn"}:
                values[field] = ""
            elif field == "checkout_url":
                values[field] = ""
            else:
                values[field] = f"dev-{token}"
        if values:
            frappe.db.set_value(doctype, row.name, values, update_modified=False)


def disable_integrations() -> None:
    if table_exists("Email Account"):
        available = columns("Email Account")
        values = {
            key: value
            for key, value in {
                "enable_incoming": 0,
                "enable_outgoing": 0,
                "default_incoming": 0,
                "default_outgoing": 0,
                "awaiting_password": 1,
                "password": "",
                "smtp_server": "",
                "email_id": "",
            }.items()
            if key in available
        }
        if values:
            assignments = ", ".join(f"`{key}`=%s" for key in values)
            frappe.db.sql(
                f"UPDATE `tabEmail Account` SET {assignments}",
                tuple(values.values()),
            )

    for doctype in ("Webhook", "Social Login Key", "OAuth Client"):
        available = columns(doctype)
        enabled_field = next(
            (field for field in ("enabled", "enable_social_login") if field in available),
            None,
        )
        if enabled_field:
            frappe.db.sql(f"UPDATE `tab{doctype}` SET `{enabled_field}`=0")

    singleton_values = {
        "System Settings": {
            "enable_scheduler": "0",
            "disable_system_update_notification": "1",
        },
        "LMS Settings": {"send_calendar_invite_for_evaluations": "0"},
    }
    for doctype, values in singleton_values.items():
        if table_exists(doctype):
            for field, value in values.items():
                if field in columns(doctype):
                    frappe.db.set_single_value(doctype, field, value)


def clear_sensitive_operational_data() -> None:
    for doctype in (
        "Sessions",
        "OAuth Bearer Token",
        "OAuth Authorization Code",
        "Document Share Key",
        "User Invitation",
        "Event Participants",
        "Email Group Member",
        "Email Unsubscribe",
        "Email Queue",
        "Email Queue Recipient",
        "Communication",
        "Communication Link",
        "Notification Log",
        "Integration Request",
        "Webhook Request Log",
        "Access Log",
        "Activity Log",
        "View Log",
        "Error Log",
        "Scheduled Job Log",
        "Route History",
    ):
        delete_doctype(doctype)


def configure_local_site() -> None:
    local_config = {
        "host_name": "http://lms.localhost:8000",
        "allow_cors": "*",
        # "None" deletes the key — CSRF verification stays ON everywhere.
        "ignore_csrf": "None",
        "developer_mode": 1,
        "disable_scheduler": 1,
        "pause_scheduler": 1,
        "mail_server": "",
        "use_ssl": 0,
        "use_tls": 0,
    }
    site_config_path = f"/workspace/frappe-bench/sites/{SITE}/site_config.json"
    for key, value in local_config.items():
        update_site_config(key, value, site_config_path=site_config_path)


def main() -> None:
    # This Frappe build derives log paths from cwd in standalone scripts.
    sites_path = "/workspace/frappe-bench/sites"
    os.chdir(sites_path)
    frappe.init(site=SITE, sites_path=sites_path)
    frappe.connect()
    try:
        mapping = sanitize_users()
        scrub_contact_data()
        scrub_payment_data()
        disable_integrations()
        clear_sensitive_operational_data()
        update_password("Administrator", "admin")
        frappe.db.set_value(
            "User",
            "Administrator",
            {"email": "admin@example.test", "phone": None, "mobile_no": None},
            update_modified=False,
        )
        configure_local_site()
        frappe.db.commit()
        frappe.clear_cache()
        print(f"SANITIZE_OK users={len(mapping)}")
    except Exception:
        frappe.db.rollback()
        raise
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
