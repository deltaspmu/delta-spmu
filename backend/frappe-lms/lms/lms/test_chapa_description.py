"""Check that _chapa_description satisfies Chapa's customization.description
rules (<= 50 chars, only letters/numbers/hyphens/underscores/spaces/dots).
Violating either rule 400s the whole /transaction/initialize call.

Run: python3 backend/frappe-lms/lms/lms/test_chapa_description.py
"""

import os
import re
import sys
import types

# Import chapa.py without a bench: stub out the frappe/requests imports it
# does at module level. _chapa_description itself touches neither.
if "frappe" not in sys.modules:
    frappe = types.ModuleType("frappe")
    frappe.ValidationError = type("ValidationError", (Exception,), {})
    frappe.whitelist = lambda *a, **kw: (lambda fn: fn)
    sys.modules["frappe"] = frappe
    sys.modules.setdefault("requests", types.ModuleType("requests"))

sys.path.insert(0, os.path.dirname(__file__))
from chapa import _chapa_description  # noqa: E402

ALLOWED = re.compile(r"^[A-Za-z0-9\-_. ]+$")

PROD_TITLES = [
    "Professional Certificate in Lip Blush & Lip Neutralization",  # 58 chars + "&"
    "Professional Certificate in Nano Combo Brows Artistry",  # 53 chars
    "Professional Certificate in Bridal Makeup Artistry",  # 50 — at the limit
    "Professional Certificate in Ombre Brows Artistry",  # 48 — already fine
    "All Courses Bundle",
    "&&&",  # degenerate: nothing survives sanitising
    "",
    None,
]


def test():
    for title in PROD_TITLES:
        out = _chapa_description(title)
        assert len(out) <= 50, (title, len(out))
        assert ALLOWED.match(out), (title, out)  # also asserts non-empty
        assert out == out.strip(), (title, out)

    # Already-valid titles pass through untouched.
    assert (
        _chapa_description("Professional Certificate in Ombre Brows Artistry")
        == "Professional Certificate in Ombre Brows Artistry"
    )
    # "&" collapses to one space, not two.
    assert (
        _chapa_description("Lip Blush & Lip Neutralization")
        == "Lip Blush Lip Neutralization"
    )
    print("ok")


if __name__ == "__main__":
    test()
