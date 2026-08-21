"""Focused regression checks for live admin-recipient resolution.

Run: python3 backend/frappe-lms/lms/lms/test_admin_recipients.py
"""

import os
import sys
import types


frappe = types.ModuleType("frappe")
frappe.conf = {}
frappe.whitelist = lambda *args, **kwargs: lambda fn: fn
frappe._ = lambda value: value

frappe_utils = types.ModuleType("frappe.utils")
frappe_utils.cint = lambda value: int(value or 0)
frappe_utils.now_datetime = lambda: None

sys.modules["frappe"] = frappe
sys.modules["frappe.utils"] = frappe_utils
sys.path.insert(0, os.path.dirname(__file__))

from telebirr_c2b import _admin_recipients  # noqa: E402


class FakeDB:
    users = {
        "Administrator": {"email": "admin@example.com", "enabled": 1},
        "manager@example.com": {"email": "manager@example.com", "enabled": 1},
        "duplicate@example.com": {"email": "manager@example.com", "enabled": 1},
        "disabled@example.com": {"email": "disabled@example.com", "enabled": 0},
    }

    @classmethod
    def get_value(cls, doctype, name, fields, as_dict=False):
        assert doctype == "User"
        assert fields == ["email", "enabled"]
        assert as_dict is True
        row = cls.users.get(name)
        return types.SimpleNamespace(**row) if row else None


frappe.db = FakeDB()
frappe.get_all = lambda *args, **kwargs: [
    "manager@example.com",
    "duplicate@example.com",
    "disabled@example.com",
]

assert _admin_recipients() == ["admin@example.com", "manager@example.com"]

frappe.conf["telebirr_c2b_alert_email"] = " alerts@example.com, finance@example.com "
assert _admin_recipients() == ["alerts@example.com", "finance@example.com"]

print("ok")
