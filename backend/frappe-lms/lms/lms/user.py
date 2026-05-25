"""
User hooks for Delta SPMU Academy LMS.

These functions are intended to be wired into Frappe's doc_events
and login hooks via ``hooks.py``.
"""

import frappe


def validate_username_duplicates(doc, method):
    """Prevent duplicate usernames during user creation/update."""
    if doc.username:
        existing = frappe.db.get_value(
            "User",
            {"username": doc.username, "name": ("!=", doc.name)},
            "name",
        )
        if existing:
            frappe.throw(
                f"Username '{doc.username}' is already taken. Please choose another."
            )


def on_login(login_manager):
    """Track user login activity."""
    user = login_manager.user
    frappe.db.set_value("User", user, "last_login", frappe.utils.now())


def after_insert(doc, method):
    """Actions after a new user is created."""
    if doc.doctype == "User" and doc.email:
        frappe.logger().info(f"New user registered: {doc.email}")
