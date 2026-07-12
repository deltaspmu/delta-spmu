"""
One-off certificate backfill / diagnostic.

Run read-only first:
    bench --site api.deltaspmu.com execute lms.lms._cert_backfill.report

Then issue certificates for everyone already eligible:
    bench --site api.deltaspmu.com execute lms.lms._cert_backfill.issue

`issue` simply calls the real, now-fixed `check_and_generate_certificate`
for every (course, enrolled member) pair, so it is idempotent (already-issued
pairs are skipped) and uses the exact production code path — including the
"certificate ready" email.

This module is throwaway; it is fine to delete after the backfill runs.
"""

import frappe
from frappe.utils import flt

from lms.lms.custom_api import (
    _all_lessons,
    _completed_set,
    _best_quiz_percentage,
    _course_quiz,
    check_and_generate_certificate,
)


def _enrolled_members(course):
    rows = frappe.db.get_all(
        "LMS Enrollment", filters={"course": course}, fields=["member"]
    )
    return sorted({r.member for r in rows})


def _eligibility(course, member):
    """Read-only mirror of check_and_generate_certificate's gate.

    Returns (eligible: bool, reason: str).
    """
    all_ls = _all_lessons(course)
    total = len(all_ls)
    if total == 0:
        return False, "no lessons"
    done = _completed_set(course, member)
    dc = sum(1 for l in all_ls if l["lesson"] in done)
    if dc < total:
        return False, "lessons %d/%d" % (dc, total)

    for li in all_ls:
        lq = frappe.db.get_value("Course Lesson", li["lesson"], "quiz_id")
        if not lq:
            continue
        pp = flt(frappe.db.get_value("LMS Quiz", lq, "passing_percentage")) or 70
        best = _best_quiz_percentage(lq, member)
        if best is None or flt(best) < pp:
            return False, "quiz '%s' best=%s need=%s" % (li["lesson_title"], best, pp)

    fq = _course_quiz(course)
    if fq:
        fp = flt(frappe.db.get_value("LMS Quiz", fq, "passing_percentage")) or 70
        best = _best_quiz_percentage(fq, member)
        if best is None or flt(best) < fp:
            return False, "final quiz best=%s need=%s" % (best, fp)

    return True, "ELIGIBLE"


def report():
    """Print eligibility for every enrolled member of every published course."""
    courses = frappe.db.get_all(
        "LMS Course", filters={"published": 1}, fields=["name", "title"]
    )
    print("=== CERTIFICATE ELIGIBILITY REPORT ===")
    for c in courses:
        members = _enrolled_members(c.name)
        print("\n# %s  (%d enrolled)" % (c.name, len(members)))
        for m in members:
            existing = frappe.db.get_value(
                "LMS Certificate", {"course": c.name, "member": m}, "certificate_id"
            )
            elig, reason = _eligibility(c.name, m)
            tag = "CERT:%s" % existing if existing else ("YES" if elig else "no ")
            print("  [%s] %-40s %s" % (tag, m, reason))
    print("\n=== END REPORT ===")


def issue():
    """Issue certificates for every eligible (course, member) pair."""
    courses = frappe.db.get_all(
        "LMS Course", filters={"published": 1}, fields=["name"]
    )
    issued, skipped, failed = [], [], []
    for c in courses:
        for m in _enrolled_members(c.name):
            try:
                res = check_and_generate_certificate(c.name, m) or {}
            except Exception as e:
                failed.append((c.name, m, str(e)[:120]))
                continue
            if res.get("eligible") and res.get("certificate_id"):
                issued.append((c.name, m, res["certificate_id"]))
            elif res.get("already_issued"):
                skipped.append((c.name, m, res.get("certificate_id")))
            else:
                skipped.append((c.name, m, res.get("reason")))
    print("=== ISSUE RESULTS ===")
    print("ISSUED (%d):" % len(issued))
    for r in issued:
        print("  +", r)
    print("SKIPPED (%d):" % len(skipped))
    for r in skipped:
        print("  .", r)
    if failed:
        print("FAILED (%d):" % len(failed))
        for r in failed:
            print("  !", r)
    print("=== END ===")
