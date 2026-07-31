"""Tests for chapter index normalization.

Run: python3 backend/frappe-lms/lms/lms/test_curriculum.py
"""

import os
import sys
import types


if "frappe" not in sys.modules:
    frappe = types.ModuleType("frappe")
    frappe.DoesNotExistError = type("DoesNotExistError", (Exception,), {})
    sys.modules["frappe"] = frappe

sys.path.insert(0, os.path.dirname(__file__))
from curriculum import chapter_index_changes  # noqa: E402


def test():
    broken = [
        {"name": "intro", "title": "Introduction", "idx": 1},
        {"name": "skin", "title": "Skin", "idx": 2},
        {"name": "hygiene", "title": "Hygiene", "idx": 4},
        {"name": "color", "title": "Color", "idx": 4},
        {"name": "mapping", "title": "Mapping", "idx": 5},
        {"name": "machine", "title": "Machine", "idx": 6},
        {"name": "demo", "title": "Demo", "idx": 9},
        {"name": "aftercare", "title": "Aftercare", "idx": 10},
        {"name": "techniques", "title": "Techniques", "idx": 12},
        {"name": "business", "title": "Business", "idx": 13},
    ]
    changes = chapter_index_changes(broken)
    final_indices = {
        chapter["name"]: chapter["idx"] for chapter in broken
    }
    final_indices.update({change["name"]: change["new_idx"] for change in changes})

    assert list(final_indices.values()) == list(range(1, 11)), final_indices
    assert {change["name"] for change in changes} == {
        "hygiene",
        "demo",
        "aftercare",
        "techniques",
        "business",
    }
    assert chapter_index_changes([
        {"name": "one", "idx": 1},
        {"name": "two", "idx": 2},
    ]) == []
    assert chapter_index_changes([
        {"name": "missing", "idx": None},
    ]) == [{
        "name": "missing",
        "title": "",
        "old_idx": 0,
        "new_idx": 1,
    }]
    print("ok")


if __name__ == "__main__":
    test()
