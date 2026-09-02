"""Focused regressions for lesson-completion membership validation.

Run: python3 backend/frappe-lms/lms/lms/test_lesson_completion.py
"""

import os
import sys
import types


class DoesNotExistError(Exception):
    pass


class FakeProgressDoc:
    def __init__(self, db):
        self.db = db
        self.values = {}

    def update(self, values):
        self.values.update(values)

    def insert(self, ignore_permissions=False):
        assert ignore_permissions is True
        self.db.inserts.append(self.values.copy())


class FakeDB:
    def __init__(self):
        self.inserts = []
        self.commits = 0

    def exists(self, doctype, filters):
        assert doctype == "LMS Course"
        return filters == "course-a"

    def get_value(self, doctype, filters, field):
        assert doctype == "LMS Course Progress"
        assert field == "name"
        return None

    def commit(self):
        self.commits += 1


frappe = types.ModuleType("frappe")
frappe.DoesNotExistError = DoesNotExistError
frappe.PermissionError = type("PermissionError", (Exception,), {})
frappe.AuthenticationError = type("AuthenticationError", (Exception,), {})
frappe.ValidationError = type("ValidationError", (Exception,), {})
frappe._ = lambda value: value
frappe.whitelist = lambda *args, **kwargs: lambda fn: fn
frappe.session = types.SimpleNamespace(user="student@example.com")

frappe_utils = types.ModuleType("frappe.utils")
frappe_utils.nowdate = lambda: "2026-09-02"
frappe_utils.now_datetime = lambda: None
frappe_utils.cint = lambda value: int(value or 0)
frappe_utils.flt = lambda value, *_args: float(value or 0)
frappe_utils.getdate = lambda value: value
frappe_utils.today = lambda: "2026-09-02"

sys.modules["frappe"] = frappe
sys.modules["frappe.utils"] = frappe_utils
sys.path.insert(0, os.path.dirname(__file__))

import custom_api  # noqa: E402


def test():
    db = FakeDB()
    frappe.db = db
    frappe.new_doc = lambda doctype: (
        FakeProgressDoc(db) if doctype == "LMS Course Progress" else None
    )

    def throw(message, exception=Exception):
        raise exception(message)

    frappe.throw = throw
    custom_api._require_login = lambda: None
    custom_api._is_admin = lambda: False
    custom_api._has_active_course_access = lambda member, course: (
        member == "student@example.com" and course == "course-a"
    )
    custom_api._all_lessons = lambda course: (
        [{"lesson": "lesson-a"}] if course == "course-a" else []
    )
    custom_api._completed_set = lambda course, member: {"lesson-a"}

    for invalid_lesson in ("missing-lesson", "lesson-from-course-b"):
        try:
            custom_api.mark_lesson_complete("course-a", invalid_lesson)
        except DoesNotExistError as exc:
            assert str(exc) == "Lesson not found in this course"
        else:
            raise AssertionError(f"accepted invalid lesson: {invalid_lesson}")

    assert db.inserts == []
    assert db.commits == 0

    result = custom_api.mark_lesson_complete("course-a", "lesson-a")
    assert db.inserts == [{
        "course": "course-a",
        "lesson": "lesson-a",
        "member": "student@example.com",
        "status": "Complete",
    }]
    assert db.commits == 1
    assert result["progress"] == 100
    assert result["completed_count"] == 1
    assert result["total_lessons"] == 1
    assert result["all_complete"] is True
    print("ok")


if __name__ == "__main__":
    test()
