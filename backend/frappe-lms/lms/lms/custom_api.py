"""
Custom API endpoints for Delta SPMU Academy LMS.

This module provides the full backend API surface for the Delta SPMU Academy
learning management system built on Frappe LMS.  It covers:

  - Instructor profile retrieval (guest-safe)
  - Course progress tracking and sequential lesson gating
  - Quiz delivery (without leaking correct answers) and server-side grading
  - Automatic certificate generation when eligibility criteria are met
  - Admin endpoints for quiz authoring and student progress reporting

IMPORTANT Frappe conventions followed:
  * Guest-accessible endpoints use ``frappe.db.get_value`` / ``frappe.db.get_all``
    instead of ``frappe.get_doc`` so that document-level permissions are bypassed
    safely (we never expose more than intended).
  * The course price field is referenced as ``course_price`` throughout.
  * Admin endpoints enforce ``System Manager`` role via helper checks.
"""

import frappe
import json
import uuid
import math

from frappe import _
from frappe.utils import nowdate, now_datetime, cint, flt


# ---------------------------------------------------------------------------
# Internal helper utilities
# ---------------------------------------------------------------------------

def _current_member():
    """Return the session user email, or ``None`` when the caller is Guest."""
    user = frappe.session.user
    if user == "Guest":
        return None
    return user


def _is_admin():
    """Return ``True`` when the session user holds the System Manager role."""
    return "System Manager" in frappe.get_roles(frappe.session.user)


def _require_login():
    """Abort with ``AuthenticationError`` if the caller is not logged in."""
    if frappe.session.user == "Guest":
        frappe.throw(_("Login required."), frappe.AuthenticationError)


def _require_admin():
    """Abort with ``PermissionError`` unless the caller is System Manager."""
    _require_login()
    if not _is_admin():
        frappe.throw(_("System Manager role required."), frappe.PermissionError)


def _all_lessons(course):
    """
    Return a flat, globally-indexed list of every lesson in *course*.

    Each entry is a dict with keys:
      chapter, chapter_title, lesson, lesson_title, idx

    Lessons are ordered by chapter idx then lesson idx within the chapter.
    The ``idx`` value is a 1-based global position across the whole course
    (used for sequential gating logic).
    """
    chapters = frappe.db.get_all(
        "Course Chapter",
        filters={"course": course},
        fields=["name", "title", "idx"],
        order_by="idx asc",
    )
    lessons = []
    global_idx = 0
    for ch in chapters:
        ch_lessons = frappe.db.get_all(
            "Lesson",
            filters={"chapter": ch.name},
            fields=["name", "title", "idx"],
            order_by="idx asc",
        )
        for ls in ch_lessons:
            global_idx += 1
            lessons.append({
                "chapter": ch.name,
                "chapter_title": ch.title,
                "lesson": ls.name,
                "lesson_title": ls.title,
                "idx": global_idx,
            })
    return lessons


def _completed_set(course, member):
    """Return a *set* of lesson names marked ``Complete`` for *member*."""
    rows = frappe.db.get_all(
        "LMS Course Progress",
        filters={"course": course, "member": member, "status": "Complete"},
        fields=["lesson"],
    )
    return {r.lesson for r in rows}


def _course_quiz(course):
    """Return the name of the final quiz attached to *course*, or ``None``.

    The ``quiz`` column does not exist on the base LMS Course doctype in this
    install — final-course quizzes are stored at the chapter level via
    ``Course Lesson.quiz_id`` instead. Wrapped in try/except so a missing
    column doesn't break certificate eligibility.
    """
    try:
        return frappe.db.get_value("LMS Course", course, "quiz") or None
    except Exception:
        return None


def _quiz_attempts(quiz, member):
    """Count how many times *member* has submitted *quiz*."""
    return frappe.db.count(
        "LMS Quiz Submission",
        filters={"quiz": quiz, "member": member},
    )


def _cert_id():
    """Generate a unique, human-readable certificate identifier."""
    return "DELTA-SPMU-" + uuid.uuid4().hex[:12].upper()


def _validate_course_exists(course):
    """Throw ``DoesNotExistError`` when *course* is missing or unknown."""
    if not course:
        frappe.throw(_("course is required"))
    if not frappe.db.exists("LMS Course", course):
        frappe.throw(
            _("Course {0} not found").format(course), frappe.DoesNotExistError
        )


# ---------------------------------------------------------------------------
# 1. get_instructor_profile  (Guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_instructor_profile(user):
    """
    Return instructor display information.

    Guest-safe: uses ``frappe.db.get_value`` only — no ``frappe.get_doc``.

    Args:
        user: Email / user ID of the instructor.

    Returns:
        dict with full_name, username, avatar, bio, title, course_count.
    """
    if not user:
        frappe.throw(_("user is required"))
    uf = frappe.db.get_value("User", user,
        ["full_name", "user_image", "bio", "username"], as_dict=True)
    if not uf:
        frappe.throw(_("User not found"), frappe.DoesNotExistError)

    inst = (frappe.db.get_value("Instructor", {"user": user}, ["title", "bio"], as_dict=True)
            if frappe.db.exists("DocType", "Instructor") else None)

    return {
        "user": user,
        "full_name": uf.full_name,
        "username": uf.username,
        "avatar": uf.user_image,
        "bio": (inst.bio if inst else None) or uf.bio or "",
        "title": (inst.title if inst else "") or "",
        "course_count": frappe.db.count("LMS Course", filters={"owner": user}),
    }


# ---------------------------------------------------------------------------
# 2. get_course_progress  (Guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_course_progress(course, member=None):
    """
    Return the progress percentage and list of completed lessons.

    Guest-safe.  When *member* is omitted and the caller is Guest the
    endpoint returns 0% progress with an empty completed-lessons list
    (no error is raised so the front-end can render a default state).

    Args:
        course: LMS Course name.
        member: (optional) User email.  Defaults to current session user.

    Returns:
        dict with course, member, progress (int 0-100),
        completed_lessons (list of lesson names), total_lessons.
    """
    _validate_course_exists(course)

    member = member or _current_member()
    if not member:
        return {"course": course, "member": None, "progress": 0,
                "completed_lessons": [], "total_lessons": 0}

    all_ls = _all_lessons(course)
    total = len(all_ls)
    if not total:
        return {"course": course, "member": member, "progress": 0,
                "completed_lessons": [], "total_lessons": 0}

    done = _completed_set(course, member)
    done_list = [l["lesson"] for l in all_ls if l["lesson"] in done]
    return {"course": course, "member": member,
            "progress": math.floor(len(done_list) / total * 100),
            "completed_lessons": done_list, "total_lessons": total}


# ---------------------------------------------------------------------------
# 3. get_quiz  (Guest — NO correct answers)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_quiz(quiz):
    """
    Return quiz metadata and questions WITHOUT correct answers.

    Guest-safe.  Only question text, option text, and quiz configuration
    (passing_score, max_attempts, negative_marking settings, etc.) are
    returned.  The ``is_correct`` flag is deliberately stripped from every
    option so that the client can never cheat.

    Args:
        quiz: LMS Quiz name.

    Returns:
        dict with quiz config fields and a ``questions`` list.
    """
    if not quiz:
        frappe.throw(_("quiz is required"))
    qf = frappe.db.get_value("LMS Quiz", quiz,
        ["name", "title", "max_attempts", "passing_percentage",
         "show_answers", "show_submission_history",
         "negative_marking", "negative_marking_percentage"], as_dict=True)
    if not qf:
        frappe.throw(_("Quiz not found"), frappe.DoesNotExistError)

    raw = frappe.db.get_all("LMS Quiz Question", filters={"parent": quiz},
        fields=["name", "question", "type", "marks", "idx"], order_by="idx asc")
    questions = []
    for q in raw:
        opts = frappe.db.get_all("LMS Quiz Option", filters={"parent": q.name},
            fields=["name", "option", "idx"], order_by="idx asc")
        questions.append({"name": q.name, "question": q.question,
            "type": q.get("type", "SingleChoice"), "marks": flt(q.marks) or 1,
            "idx": q.idx,
            "options": [{"name": o.name, "option": o.option, "idx": o.idx} for o in opts]})

    return {"name": qf.name, "title": qf.title,
            "max_attempts": cint(qf.max_attempts) or 0,
            "passing_percentage": flt(qf.passing_percentage) or 70,
            "show_answers": cint(qf.show_answers),
            "show_submission_history": cint(qf.show_submission_history),
            "negative_marking": cint(qf.negative_marking),
            "negative_marking_percentage": flt(qf.negative_marking_percentage),
            "total_questions": len(questions), "questions": questions}


# ---------------------------------------------------------------------------
# 4. get_quiz_questions  (Admin — WITH correct answers)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_quiz_questions(quiz):
    """
    Admin endpoint: return quiz questions WITH correct answers.

    Requires the ``System Manager`` role.  Unlike :func:`get_quiz`, this
    endpoint includes the ``is_correct`` flag on each option so that
    administrators can review and edit quiz content.

    Args:
        quiz: LMS Quiz name.

    Returns:
        dict with ``quiz`` and ``questions`` (including correct flags).
    """
    _require_admin()
    if not quiz or not frappe.db.exists("LMS Quiz", quiz):
        frappe.throw(_("Quiz not found"), frappe.DoesNotExistError)

    raw = frappe.db.get_all("LMS Quiz Question", filters={"parent": quiz},
        fields=["name", "question", "type", "marks", "negative_marks", "idx"],
        order_by="idx asc")
    questions = []
    for q in raw:
        opts = frappe.db.get_all("LMS Quiz Option", filters={"parent": q.name},
            fields=["name", "option", "is_correct", "idx"], order_by="idx asc")
        questions.append({"name": q.name, "question": q.question,
            "type": q.get("type", "SingleChoice"),
            "marks": flt(q.marks) or 1, "negative_marks": flt(q.get("negative_marks", 0)),
            "idx": q.idx,
            "options": [{"name": o.name, "option": o.option,
                         "is_correct": cint(o.is_correct), "idx": o.idx} for o in opts]})
    return {"quiz": quiz, "questions": questions}


# ---------------------------------------------------------------------------
# 5. mark_lesson_complete  (Authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def mark_lesson_complete(course, lesson):
    """
    Mark a lesson as complete for the current user.

    If an ``LMS Course Progress`` record already exists for this
    course/lesson/member combination it is updated to ``Complete``;
    otherwise a new record is created.

    After marking the lesson, the endpoint checks whether *all* lessons in
    the course are now complete and, if so, triggers the certificate
    generation check automatically (best-effort — failures are swallowed so
    they never block the primary action).

    Args:
        course: LMS Course name.
        lesson: Lesson name.

    Returns:
        dict with message, lesson, course, progress percentage,
        completed_count, total_lessons, all_complete flag, certificate info.
    """
    _require_login()
    member = frappe.session.user
    if not course or not lesson:
        frappe.throw(_("course and lesson are required"))
    if not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course not found"), frappe.DoesNotExistError)

    existing = frappe.db.get_value("LMS Course Progress",
        {"course": course, "lesson": lesson, "member": member}, "name")
    if existing:
        frappe.db.set_value("LMS Course Progress", existing, "status", "Complete")
    else:
        d = frappe.new_doc("LMS Course Progress")
        d.update({"course": course, "lesson": lesson, "member": member, "status": "Complete"})
        d.insert(ignore_permissions=True)
    frappe.db.commit()

    all_ls = _all_lessons(course)
    done = _completed_set(course, member)
    total = len(all_ls)
    done_count = sum(1 for l in all_ls if l["lesson"] in done)
    all_done = done_count == total and total > 0

    cert = None
    if all_done:
        try:
            cert = check_and_generate_certificate(course, member)
        except Exception:
            pass

    return {"message": _("Lesson marked as complete"), "lesson": lesson, "course": course,
            "progress": math.floor(done_count / total * 100) if total else 0,
            "completed_count": done_count, "total_lessons": total,
            "all_complete": all_done, "certificate": cert}


# ---------------------------------------------------------------------------
# 6. check_lesson_access  (Authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def check_lesson_access(course, lesson):
    """
    Sequential gating check.

    The student must complete every lesson that precedes the requested one
    (ordered by chapter idx then lesson idx) before they are granted access.
    System Managers bypass the gate entirely.

    Args:
        course: LMS Course name.
        lesson: Lesson name the student wants to access.

    Returns:
        ``{"access": true/false, "reason": "..."}`` and, when denied,
        ``incomplete_lessons`` (up to 5 titles) and ``incomplete_count``.
    """
    _require_login()
    member = frappe.session.user
    if not course or not lesson:
        frappe.throw(_("course and lesson are required"))
    if not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course not found"), frappe.DoesNotExistError)
    if _is_admin():
        return {"access": True, "reason": _("Admin bypass")}

    all_ls = _all_lessons(course)
    target = next((l for l in all_ls if l["lesson"] == lesson), None)
    if not target:
        frappe.throw(_("Lesson not in this course"), frappe.DoesNotExistError)
    if target["idx"] == 1:
        return {"access": True, "reason": _("First lesson")}

    done = _completed_set(course, member)
    incomplete = [l for l in all_ls if l["idx"] < target["idx"] and l["lesson"] not in done]
    if incomplete:
        return {"access": False, "reason": _("Complete all previous lessons first."),
                "incomplete_lessons": [l["lesson_title"] for l in incomplete[:5]],
                "incomplete_count": len(incomplete)}
    return {"access": True, "reason": _("All prerequisites met.")}


# ---------------------------------------------------------------------------
# 7. check_final_quiz_access  (Authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def check_final_quiz_access(course):
    """
    Check whether the student may attempt the final course quiz.

    The final quiz is locked until every lesson in the course is marked
    complete (100% progress).  System Managers bypass the gate.

    Args:
        course: LMS Course name.

    Returns:
        dict with ``access`` (bool), ``reason``, ``progress`` (int 0-100),
        and when denied: ``completed_count``, ``total_lessons``, ``remaining``.
    """
    _require_login()
    member = frappe.session.user
    if not course or not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course not found"), frappe.DoesNotExistError)
    if _is_admin():
        return {"access": True, "reason": _("Admin bypass"), "progress": 100}

    fq = _course_quiz(course)
    if not fq:
        return {"access": False, "reason": _("No final quiz configured."), "progress": 0}

    all_ls = _all_lessons(course)
    total = len(all_ls)
    if not total:
        return {"access": True, "reason": _("No lessons — quiz open."), "progress": 100}

    done = _completed_set(course, member)
    dc = sum(1 for l in all_ls if l["lesson"] in done)
    pct = math.floor(dc / total * 100)
    if dc < total:
        return {"access": False, "reason": _("Complete all lessons first."),
                "progress": pct, "completed_count": dc,
                "total_lessons": total, "remaining": total - dc}
    return {"access": True, "reason": _("All lessons complete — quiz unlocked."),
            "progress": 100, "completed_count": dc, "total_lessons": total}


# ---------------------------------------------------------------------------
# 8. submit_quiz  (Authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def submit_quiz(quiz, answers):
    """
    Server-side quiz grading.

    ``answers`` is a JSON object (or string) mapping question names to the
    student's selected option(s)::

        {
            "QUESTION-001": "Option A",                 # single choice
            "QUESTION-002": ["Option B", "Option C"],   # multiple choice
        }

    Grading rules
    ~~~~~~~~~~~~~
    - **Single choice**: exact text match against the correct option.
    - **Multiple choice**: the selected set must equal the correct set.
    - **Negative marking**: when enabled on the quiz, wrong answers deduct
      either a quiz-level percentage of the question's marks or the
      per-question ``negative_marks`` value.
    - **Pass threshold**: configurable per quiz (default 70%).
    - **Max attempts**: enforced by counting previous submissions.

    Side effects
    ~~~~~~~~~~~~
    - Creates an ``LMS Quiz Submission`` record.
    - If passed, auto-marks the associated lesson (if any) as complete via
      :func:`_auto_complete_quiz_lesson`.

    Args:
        quiz: LMS Quiz name.
        answers: JSON string or dict of answers.

    Returns:
        dict with score, passed, total_questions, correct_count,
        wrong_count, earned_marks, total_marks, attempt_number,
        max_attempts, passing_percentage.
    """
    _require_login()
    member = frappe.session.user
    if not quiz:
        frappe.throw(_("quiz is required"))

    if isinstance(answers, str):
        try: answers = json.loads(answers)
        except Exception: frappe.throw(_("Invalid answers JSON"))
    if not isinstance(answers, dict):
        frappe.throw(_("answers must be a JSON object"))

    qf = frappe.db.get_value("LMS Quiz", quiz,
        ["name", "title", "max_attempts", "passing_percentage",
         "negative_marking", "negative_marking_percentage"], as_dict=True)
    if not qf:
        frappe.throw(_("Quiz not found"), frappe.DoesNotExistError)

    max_att = cint(qf.max_attempts)
    pass_pct = flt(qf.passing_percentage) or 70
    neg_on = cint(qf.negative_marking)
    neg_pct = flt(qf.negative_marking_percentage)

    att = _quiz_attempts(quiz, member)
    if max_att > 0 and att >= max_att:
        frappe.throw(_("Max attempts ({0}) reached.").format(max_att))

    raw_qs = frappe.db.get_all("LMS Quiz Question", filters={"parent": quiz},
        fields=["name", "question", "type", "marks", "negative_marks", "idx"],
        order_by="idx asc")

    total_marks, earned, correct_count, wrong_count = 0, 0, 0, 0
    q_results = []

    for q in raw_qs:
        qm = flt(q.marks) or 1
        total_marks += qm
        qt = q.get("type", "SingleChoice")
        cor_raw = frappe.db.get_all("LMS Quiz Option",
            filters={"parent": q.name, "is_correct": 1}, fields=["option"])
        cor_set = {o.option.strip() for o in cor_raw}
        sa = answers.get(q.name)
        ok = False

        if qt in ("SingleChoice", "Single Choice"):
            ok = isinstance(sa, str) and sa.strip() in cor_set
        else:
            ss = ({a.strip() for a in sa if isinstance(a, str)} if isinstance(sa, list)
                  else {sa.strip()} if isinstance(sa, str) else set())
            ok = ss == cor_set and len(ss) > 0

        if ok:
            earned += qm; correct_count += 1
        else:
            wrong_count += 1
            if neg_on and neg_pct > 0:
                earned -= qm * (neg_pct / 100)
            elif neg_on and flt(q.get("negative_marks", 0)) > 0:
                earned -= flt(q.negative_marks)

        q_results.append({"question": q.name, "is_correct": ok})

    earned = max(earned, 0)
    score = round(earned / total_marks * 100, 2) if total_marks else 0
    passed = score >= pass_pct
    att_num = att + 1

    sub = frappe.new_doc("LMS Quiz Submission")
    sub.update({"quiz": quiz, "member": member, "score": score,
                "passing_percentage": pass_pct,
                "result": "Pass" if passed else "Fail",
                "attempt_number": att_num, "time": now_datetime()})
    if hasattr(sub, "answers"):
        for qr in q_results:
            ag = answers.get(qr["question"], "")
            if isinstance(ag, list): ag = ", ".join(ag)
            sub.append("answers", {"question": qr["question"],
                                   "answer": ag, "is_correct": cint(qr["is_correct"])})
    try:
        sub.insert(ignore_permissions=True); frappe.db.commit()
    except Exception as e:
        frappe.log_error(title="Quiz Submission Error", message=str(e))
        frappe.throw(_("Failed to save submission."))

    if passed:
        _auto_complete_quiz_lesson(quiz, member)

    return {"quiz": quiz, "score": score, "passed": passed,
            "total_questions": len(raw_qs), "correct_count": correct_count,
            "wrong_count": wrong_count, "earned_marks": round(earned, 2),
            "total_marks": round(total_marks, 2), "attempt_number": att_num,
            "max_attempts": max_att, "passing_percentage": pass_pct}


def _auto_complete_quiz_lesson(quiz, member):
    """
    Auto-mark the lesson that owns *quiz* as complete for *member*.

    Tries two lookup strategies:
      1. ``Lesson`` doctype with a ``quiz`` field matching the quiz name.
      2. ``LMS Quiz`` doctype with a ``lesson`` back-reference field.

    If neither yields a lesson, the function silently returns (the quiz
    may not be attached to any specific lesson — e.g. a standalone final
    course quiz).
    """
    lesson = frappe.db.get_value("Lesson", {"quiz": quiz}, "name")
    if not lesson:
        lesson = frappe.db.get_value("LMS Quiz", quiz, "lesson")
    if not lesson:
        return
    chapter = frappe.db.get_value("Lesson", lesson, "chapter")
    if not chapter:
        return
    course = frappe.db.get_value("Course Chapter", chapter, "course")
    if not course:
        return

    ex = frappe.db.get_value("LMS Course Progress",
        {"course": course, "lesson": lesson, "member": member}, "name")
    if ex:
        frappe.db.set_value("LMS Course Progress", ex, "status", "Complete")
    else:
        d = frappe.new_doc("LMS Course Progress")
        d.update({"course": course, "lesson": lesson, "member": member, "status": "Complete"})
        d.insert(ignore_permissions=True)
    frappe.db.commit()


# ---------------------------------------------------------------------------
# 9. check_and_generate_certificate  (Authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def check_and_generate_certificate(course, member=None):
    """
    Auto-generate a certificate if the student is eligible.

    Eligibility criteria (all must be true):
      1. Every lesson in the course is marked complete (100% progress).
      2. Every lesson-level quiz has at least one passing submission whose
         score meets or exceeds the quiz's ``passing_percentage``.
      3. The final course quiz (if configured) has been passed.
      4. No certificate has already been issued for this course/member pair.

    When all criteria are met an ``LMS Certificate`` record is created with
    a unique ``certificate_id`` (format ``DELTA-SPMU-XXXXXXXXXXXX``).

    The response includes the ``course_price`` field so the front-end can
    display paid-course certificate badges without a second round-trip.

    Args:
        course: LMS Course name.
        member: (optional) User email.  Defaults to current session user.

    Returns:
        dict with certificate info when issued, eligibility failure reason
        otherwise, or existing certificate details if already issued.
    """
    _require_login()
    member = member or frappe.session.user
    if not course or not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course not found"), frappe.DoesNotExistError)

    # Already issued?
    ec = frappe.db.get_value("LMS Certificate", {"course": course, "member": member},
        ["name", "certificate_id", "creation"], as_dict=True)
    if ec:
        return {"already_issued": True, "certificate_name": ec.name,
                "certificate_id": ec.certificate_id, "issue_date": str(ec.creation)}

    # All lessons done?
    all_ls = _all_lessons(course)
    total = len(all_ls)
    if not total:
        frappe.throw(_("No lessons — cannot issue certificate."))
    done = _completed_set(course, member)
    dc = sum(1 for l in all_ls if l["lesson"] in done)
    if dc < total:
        return {"eligible": False, "reason": _("Not all lessons complete."),
                "progress": math.floor(dc / total * 100), "remaining_lessons": total - dc}

    # Lesson quizzes passed?
    for li in all_ls:
        lq = frappe.db.get_value("Course Lesson", li["lesson"], "quiz_id")
        if not lq:
            continue
        pp = flt(frappe.db.get_value("LMS Quiz", lq, "passing_percentage")) or 70
        bs = frappe.db.get_value("LMS Quiz Submission",
            filters={"quiz": lq, "member": member, "result": "Pass"},
            fieldname="score", order_by="score desc")
        if not bs or flt(bs) < pp:
            return {"eligible": False,
                    "reason": _("Quiz for '{0}' not passed.").format(li["lesson_title"]),
                    "failed_quiz": lq, "lesson": li["lesson"]}

    # Final quiz passed?
    fq = _course_quiz(course)
    if fq:
        fp = flt(frappe.db.get_value("LMS Quiz", fq, "passing_percentage")) or 70
        bfs = frappe.db.get_value("LMS Quiz Submission",
            filters={"quiz": fq, "member": member, "result": "Pass"},
            fieldname="score", order_by="score desc")
        if not bfs or flt(bfs) < fp:
            return {"eligible": False, "reason": _("Final quiz not passed."),
                    "failed_quiz": fq}

    # Issue certificate
    ct = frappe.db.get_value("LMS Course", course, "title") or course
    mn = frappe.db.get_value("User", member, "full_name") or member
    cp = frappe.db.get_value("LMS Course", course, "course_price")
    cid = _cert_id()

    cert = frappe.new_doc("LMS Certificate")
    cert.update({"course": course, "member": member, "member_name": mn,
                 "course_title": ct, "certificate_id": cid, "issue_date": nowdate()})
    try:
        cert.insert(ignore_permissions=True); frappe.db.commit()
    except Exception as e:
        frappe.log_error(title="Certificate Error", message=str(e))
        frappe.throw(_("Failed to generate certificate."))

    # Notify the student that their certificate is ready
    try:
        from lms.lms.email_templates import certificate_ready
        frappe.sendmail(
            recipients=[member],
            subject=_("Your Certificate is Ready — Delta SPMU Academy"),
            message=certificate_ready(student_name=mn, course_title=ct, certificate_id=cid),
            now=True,
            retry=3,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "certificate_ready_email_failed")

    return {"eligible": True, "certificate_name": cert.name, "certificate_id": cid,
            "course": course, "course_title": ct, "member": member,
            "member_name": mn, "issue_date": str(cert.issue_date), "course_price": cp}


# ---------------------------------------------------------------------------
# 10. add_quiz_question  (Admin)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def add_quiz_question(quiz, question, question_type="SingleChoice", options=None,
                      correct_option=None, correct_options=None, marks=1, negative_marks=0):
    """
    Admin endpoint: add a new question (with options) to a quiz.

    Requires System Manager role.  Validates that every value listed in
    ``correct_option`` / ``correct_options`` actually appears in the
    ``options`` list before persisting anything.

    Args:
        quiz: LMS Quiz name.
        question: Question text (plain text or HTML).
        question_type: ``"SingleChoice"`` or ``"MultipleChoice"``.
        options: JSON array of option strings.
        correct_option: The correct option text (single choice).
        correct_options: JSON array of correct option texts (multiple choice).
        marks: Marks awarded for a correct answer (default 1).
        negative_marks: Marks deducted for a wrong answer (default 0).

    Returns:
        dict with message, question_name, quiz, idx, options_count.
    """
    _require_admin()
    if not quiz or not question:
        frappe.throw(_("quiz and question required"))
    if not frappe.db.exists("LMS Quiz", quiz):
        frappe.throw(_("Quiz not found"), frappe.DoesNotExistError)

    if isinstance(options, str):
        try: options = json.loads(options)
        except Exception: frappe.throw(_("options must be valid JSON array"))
    if not options or not isinstance(options, list):
        frappe.throw(_("options must be a non-empty list"))

    if isinstance(correct_options, str):
        try: correct_options = json.loads(correct_options)
        except Exception: correct_options = None

    if question_type in ("MultipleChoice", "Multiple Choice"):
        if not correct_options or not isinstance(correct_options, list):
            frappe.throw(_("correct_options required for multiple choice"))
        cor = set(correct_options)
    else:
        if not correct_option:
            frappe.throw(_("correct_option required for single choice"))
        cor = {correct_option}

    bad = cor - set(options)
    if bad:
        frappe.throw(_("Correct answers not in options: {0}").format(", ".join(bad)))

    mx = frappe.db.sql("SELECT MAX(idx) FROM `tabLMS Quiz Question` WHERE parent=%s", quiz)
    nidx = (cint(mx[0][0]) if mx and mx[0][0] else 0) + 1

    qd = frappe.new_doc("LMS Quiz Question")
    qd.update({"parent": quiz, "parenttype": "LMS Quiz", "parentfield": "questions",
               "question": question, "type": question_type,
               "marks": flt(marks) or 1, "negative_marks": flt(negative_marks), "idx": nidx})
    try:
        qd.insert(ignore_permissions=True)
    except Exception as e:
        frappe.log_error(title="Add Question Error", message=str(e))
        frappe.throw(_("Failed to add question."))

    for oi, ot in enumerate(options, 1):
        od = frappe.new_doc("LMS Quiz Option")
        od.update({"parent": qd.name, "parenttype": "LMS Quiz Question",
                   "parentfield": "options", "option": ot,
                   "is_correct": 1 if ot in cor else 0, "idx": oi})
        try: od.insert(ignore_permissions=True)
        except Exception as e:
            frappe.log_error(title="Add Option Error", message=str(e))
    frappe.db.commit()

    return {"message": _("Question added"), "question_name": qd.name,
            "quiz": quiz, "idx": nidx, "options_count": len(options)}


# ---------------------------------------------------------------------------
# 11. delete_quiz_question  (Admin)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def delete_quiz_question(question_name):
    """
    Admin endpoint: delete a quiz question and all its child options.

    After deletion the remaining questions in the same quiz are re-indexed
    so that ``idx`` values stay contiguous (1, 2, 3, ...).

    Args:
        question_name: ``LMS Quiz Question`` name.

    Returns:
        dict with message, question_name, quiz, remaining_questions count.
    """
    _require_admin()
    if not question_name or not frappe.db.exists("LMS Quiz Question", question_name):
        frappe.throw(_("Question not found"), frappe.DoesNotExistError)

    quiz = frappe.db.get_value("LMS Quiz Question", question_name, "parent")
    for o in frappe.db.get_all("LMS Quiz Option", filters={"parent": question_name}, fields=["name"]):
        frappe.db.delete("LMS Quiz Option", o.name)
    frappe.db.delete("LMS Quiz Question", question_name)
    frappe.db.commit()

    rem = frappe.db.get_all("LMS Quiz Question", filters={"parent": quiz},
        fields=["name"], order_by="idx asc")
    for i, q in enumerate(rem, 1):
        frappe.db.set_value("LMS Quiz Question", q.name, "idx", i)
    frappe.db.commit()

    return {"message": _("Question deleted"), "question_name": question_name,
            "quiz": quiz, "remaining_questions": len(rem)}


# ---------------------------------------------------------------------------
# 12. save_instructor_profile  (Admin)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def save_instructor_profile(user, title=None, bio=None):
    """
    Admin endpoint: create or update an instructor profile.

    Updates the ``User.bio`` field directly and, if an ``Instructor``
    doctype exists in the system, creates or updates the matching
    Instructor record as well.

    Args:
        user: User email / ID.
        title: Display title (e.g. "Senior Instructor").
        bio: Biography / description text.

    Returns:
        dict with message, user, title, bio, instructor_record_updated flag.
    """
    _require_admin()
    if not user or not frappe.db.exists("User", user):
        frappe.throw(_("User not found"), frappe.DoesNotExistError)

    if bio is not None:
        frappe.db.set_value("User", user, "bio", bio)

    inst_ok = False
    if frappe.db.exists("DocType", "Instructor"):
        ex = frappe.db.get_value("Instructor", {"user": user}, "name")
        if ex:
            if title is not None: frappe.db.set_value("Instructor", ex, "title", title)
            if bio is not None: frappe.db.set_value("Instructor", ex, "bio", bio)
            inst_ok = True
        else:
            d = frappe.new_doc("Instructor")
            d.update({"user": user})
            if title: d.title = title
            if bio: d.bio = bio
            try: d.insert(ignore_permissions=True); inst_ok = True
            except Exception as e:
                frappe.log_error(title="Instructor Profile Error", message=str(e))
    frappe.db.commit()

    return {"message": _("Profile saved"), "user": user,
            "title": title, "bio": bio, "instructor_record_updated": inst_ok}


# ---------------------------------------------------------------------------
# 13. get_student_progress_report  (Admin)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_student_progress_report(course):
    """
    Admin endpoint: comprehensive progress report for every student in a course.

    For each enrolled student the report includes:
      - Member info (name, email, enrollment date)
      - Overall progress percentage
      - Per-lesson completion status and quiz scores
      - Final quiz attempts, best score, and result
      - Certificate issuance status

    Students are sorted by progress (highest first) so administrators can
    quickly identify who is falling behind.

    Falls back to ``LMS Course Progress`` records when no ``LMS Enrollment``
    records are found (supports legacy data).

    Uses the ``course_price`` field in the response for admin dashboards.

    Args:
        course: LMS Course name.

    Returns:
        dict with course info, total_students, total_lessons, final_quiz,
        and a ``students`` list with detailed per-student data.
    """
    _require_admin()
    if not course or not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course not found"), frappe.DoesNotExistError)

    ct = frappe.db.get_value("LMS Course", course, "title") or course
    cp = frappe.db.get_value("LMS Course", course, "course_price")

    enrollments = frappe.db.get_all("LMS Enrollment", filters={"course": course},
        fields=["member", "member_name", "creation"])
    if not enrollments:
        pms = frappe.db.sql(
            "SELECT DISTINCT member FROM `tabLMS Course Progress` WHERE course=%s",
            course, as_dict=True)
        enrollments = [{"member": p.member,
            "member_name": frappe.db.get_value("User", p.member, "full_name") or p.member,
            "creation": None} for p in pms]

    all_ls = _all_lessons(course)
    total = len(all_ls)
    fq = _course_quiz(course)
    students = []

    for en in enrollments:
        m = en.member
        mn = en.member_name or frappe.db.get_value("User", m, "full_name") or m
        done = _completed_set(course, m)
        dc = sum(1 for l in all_ls if l["lesson"] in done)
        pct = math.floor(dc / total * 100) if total else 0

        lds = []
        for l in all_ls:
            ld = {"lesson": l["lesson"], "lesson_title": l["lesson_title"],
                  "chapter_title": l["chapter_title"], "completed": l["lesson"] in done,
                  "quiz": None, "quiz_score": None, "quiz_result": None}
            lq = frappe.db.get_value("Lesson", l["lesson"], "quiz")
            if lq:
                bs = frappe.db.get_value("LMS Quiz Submission",
                    filters={"quiz": lq, "member": m},
                    fieldname=["score", "result"], order_by="score desc", as_dict=True)
                ld.update({"quiz": lq,
                    "quiz_score": flt(bs.score) if bs else None,
                    "quiz_result": bs.result if bs else None})
            lds.append(ld)

        fqi = None
        if fq:
            bf = frappe.db.get_value("LMS Quiz Submission",
                filters={"quiz": fq, "member": m},
                fieldname=["score", "result"], order_by="score desc", as_dict=True)
            fqi = {"quiz": fq, "attempts": _quiz_attempts(fq, m),
                   "best_score": flt(bf.score) if bf else None,
                   "result": bf.result if bf else None}

        cr = frappe.db.get_value("LMS Certificate", {"course": course, "member": m},
            ["name", "certificate_id", "issue_date"], as_dict=True)

        students.append({"member": m, "member_name": mn,
            "enrolled_on": str(en.get("creation") or ""),
            "progress": pct, "completed_lessons": dc, "total_lessons": total,
            "lessons": lds, "final_quiz": fqi,
            "certificate": {"issued": bool(cr),
                "certificate_id": cr.certificate_id if cr else None,
                "issue_date": str(cr.issue_date) if cr else None} if cr else {"issued": False}})

    students.sort(key=lambda s: s["progress"], reverse=True)

    return {"course": course, "course_title": ct, "course_price": cp,
            "total_students": len(students), "total_lessons": total,
            "final_quiz": fq, "students": students}
