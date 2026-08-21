"""Unit tests for the Vimeo lesson-duration backfill.

Run: python3 backend/frappe-lms/lms/lms/test_vimeo_durations.py
"""

import os
import sys
import types


class Row(dict):
    __getattr__ = dict.__getitem__


if "frappe" not in sys.modules:
    frappe = types.ModuleType("frappe")
    frappe.PermissionError = type("PermissionError", (Exception,), {})
    frappe.ValidationError = type("ValidationError", (Exception,), {})
    frappe.whitelist = lambda *args, **kwargs: lambda fn: fn
    frappe.conf = Row()
    sys.modules["frappe"] = frappe

sys.path.insert(0, os.path.dirname(__file__))
import vimeo_api  # noqa: E402


class FakeDB:
    def __init__(self, lessons):
        self.lessons = lessons
        self.writes = []
        self.commits = 0

    def has_column(self, doctype, field):
        return doctype == "Course Lesson" and field == "duration"

    def set_value(self, doctype, name, field, value, **kwargs):
        self.writes.append((doctype, name, field, value, kwargs))
        next(lesson for lesson in self.lessons if lesson.name == name)[field] = value

    def commit(self):
        self.commits += 1


def test():
    assert vimeo_api._lesson_video_id("1234567890/abc123") == "1234567890"
    assert vimeo_api._lesson_video_id("not-a-video") is None
    assert vimeo_api._duration_minutes(89) == 1
    assert vimeo_api._duration_minutes(90) == 2
    assert vimeo_api._duration_minutes(754) == 13
    assert vimeo_api._duration_minutes(None) is None

    lessons = [
        Row(name="lesson-1", title="One", youtube="111111/aaa", duration=0),
        Row(name="lesson-2", title="Two", youtube="222222/bbb", duration=2),
        Row(name="lesson-3", title="Three", youtube="333333/ccc", duration=0),
        Row(name="lesson-4", title="Four", youtube="invalid", duration=0),
        Row(name="lesson-5", title="Five", youtube="", duration=0),
    ]
    db = FakeDB(lessons)
    admin_checks = []
    error_logs = []

    vimeo_api.frappe.db = db
    vimeo_api.frappe.get_all = lambda *args, **kwargs: lessons
    vimeo_api.frappe.log_error = lambda **kwargs: error_logs.append(kwargs)
    vimeo_api._check_admin = lambda: admin_checks.append(True)

    def fetch(method, path, data=None, params=None):
        assert method == "GET"
        assert params == {"fields": "duration"}
        if path.endswith("111111"):
            return {"duration": 89}
        if path.endswith("222222"):
            return {"duration": 90}
        raise RuntimeError("not found")

    vimeo_api._vimeo_request = fetch
    result = vimeo_api.backfill_lesson_durations()

    assert admin_checks == [True]
    assert result == {
        "processed": 4,
        "updated": 1,
        "unchanged": 1,
        "skipped": 2,
        "errors": [
            {"lesson": "lesson-3", "video_id": "333333", "reason": "not found"},
            {"lesson": "lesson-4", "reason": "invalid Vimeo reference"},
        ],
    }
    assert db.writes == [
        ("Course Lesson", "lesson-1", "duration", 1, {"update_modified": False})
    ]
    assert db.commits == 1
    assert len(error_logs) == 2

    # Re-running with the same Vimeo data does not write again.
    db.writes.clear()
    second = vimeo_api.backfill_lesson_durations()
    assert second["updated"] == 0
    assert second["unchanged"] == 2
    assert db.writes == []
    assert db.commits == 2
    print("ok")


if __name__ == "__main__":
    test()
