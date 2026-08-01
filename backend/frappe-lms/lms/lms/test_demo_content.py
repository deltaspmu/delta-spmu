"""Tests for safe, idempotent Frappe demo-content cleanup.

Run: python3 backend/frappe-lms/lms/lms/test_demo_content.py
"""

import os
import sys
import types


class FakeDB:
    def __init__(self, records):
        self.records = records
        self.commits = 0
        self.rollbacks = 0

    def count(self, doctype, filters):
        return sum(
            1
            for row in self.records[doctype]
            if all(row.get(field) == value for field, value in filters.items())
        )

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_frappe(records):
    module = types.ModuleType("frappe")
    module.db = FakeDB(records)
    module.deleted = []
    module.cache_clears = 0

    def get_all(doctype, filters=None, fields=None, **_kwargs):
        rows = records[doctype]
        for field, condition in (filters or {}).items():
            if isinstance(condition, tuple) and condition[0] == "in":
                rows = [row for row in rows if row.get(field) in condition[1]]
            else:
                rows = [row for row in rows if row.get(field) == condition]
        return [
            {field: row.get(field) for field in (fields or row.keys())}
            for row in rows
        ]

    def delete_doc(doctype, name, **_kwargs):
        records[doctype][:] = [
            row for row in records[doctype] if row["name"] != name
        ]
        module.deleted.append((doctype, name))

    def clear_cache():
        module.cache_clears += 1

    module.get_all = get_all
    module.delete_doc = delete_doc
    module.clear_cache = clear_cache
    return module


def test():
    records = {
        "LMS Course": [
            {
                "name": "a-guide-to-frappe-learning",
                "title": "A Guide to Frappe Learning",
                "published": 0,
                "category": "Business",
            },
            {
                "name": "delta-personal-development",
                "title": "Delta Personal Development",
                "published": 1,
                "category": "Personal Development",
            },
        ],
        "LMS Quiz": [
            {
                "name": "do-you-know-frappe-learning",
                "title": "Do you know Frappe Learning?",
                "course": "a-guide-to-frappe-learning",
            },
            {"name": "delta-quiz", "title": "Delta Quiz", "course": None},
        ],
        "LMS Category": [
            {"name": "Business", "category": "Business"},
            {"name": "Design", "category": "Design"},
            {
                "name": "Personal Development",
                "category": "Personal Development",
            },
            {"name": "Permanent Makeup", "category": "Permanent Makeup"},
        ],
    }
    fake_frappe = make_frappe(records)
    sys.modules["frappe"] = fake_frappe
    sys.path.insert(0, os.path.dirname(__file__))

    from demo_content import cleanup_frappe_demo_content

    result = cleanup_frappe_demo_content()
    assert result["deleted"] == {
        "courses": ["a-guide-to-frappe-learning"],
        "quizzes": ["do-you-know-frappe-learning"],
        "categories": ["Business", "Design"],
    }, result
    assert result["skipped"] == {
        "categories_in_use": [
            {"name": "Personal Development", "course_count": 1}
        ]
    }, result
    assert result["after"]["courses"] == []
    assert result["after"]["quizzes"] == []
    assert [row["name"] for row in result["after"]["categories"]] == [
        "Personal Development"
    ]
    assert records["LMS Course"][0]["name"] == "delta-personal-development"
    assert records["LMS Quiz"][0]["name"] == "delta-quiz"
    assert {row["name"] for row in records["LMS Category"]} == {
        "Permanent Makeup",
        "Personal Development",
    }
    assert fake_frappe.db.commits == 1
    assert fake_frappe.db.rollbacks == 0

    second = cleanup_frappe_demo_content()
    assert second["deleted"] == {
        "courses": [],
        "quizzes": [],
        "categories": [],
    }
    assert second["skipped"]["categories_in_use"] == [
        {"name": "Personal Development", "course_count": 1}
    ]
    assert fake_frappe.db.commits == 2
    print("ok")


if __name__ == "__main__":
    test()
