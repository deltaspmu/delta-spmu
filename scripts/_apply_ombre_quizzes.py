# -*- coding: utf-8 -*-
"""Attach the per-lesson Ombré exam-bank quizzes to the LIVE course WITHOUT
re-seeding (lessons + attached videos preserved).

The user removed 5 lessons from the live course; per their instruction, those
lessons' quiz questions are folded into the LAST surviving lesson of the same
chapter (see REDIRECT). All 253 questions stay live, paired to real lessons.

Idempotent: clears quizzes currently on the course's lessons + any quiz with a
title we manage, then recreates. Run once, then delete this file.
"""
import os
import sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frappe
from ombre_quiz_bank import OMBRE_QUIZZES

SITE = "api.deltaspmu.com"
BENCH = "/home/frappe/deltaspmu"
COURSE = "professional-certificate-in-ombre-brows-artistry"
PASSING = 70
ATTEMPTS = 3

# Removed lesson (chapter, lesson) -> surviving lesson title in the SAME chapter
# that should absorb its questions (the chapter's last remaining lesson).
REDIRECT = {
    ("Hygiene & Infection Control Protocol", "Infection Control Protocol"): "Hygiene Fundamentals",
    ("Color Theory & Pigment Selection", "Pigment Selection"): "Color Theory",
    ("Face Shape & Brow Mapping", "Personalization & Facial Asymmetry Correction"): "The Golden Ratio Mapping System",
    ("Face Shape & Brow Mapping", "Mapping Tools & Pre-Drawing Process"): "The Golden Ratio Mapping System",
    ("Live Demo Procedures", "Healing & Touch-Up Protocol"): "Live Model Procedure Guide",
}
# Title for lessons that end up with merged content.
TITLE_OVERRIDE = {
    ("Hygiene & Infection Control Protocol", "Hygiene Fundamentals"): "Ombré — Hygiene & Infection Control Quiz",
    ("Color Theory & Pigment Selection", "Color Theory"): "Ombré — Colour Theory & Pigment Selection Quiz",
    ("Face Shape & Brow Mapping", "The Golden Ratio Mapping System"): "Ombré — Brow Mapping, Asymmetry & Tools Quiz",
    ("Live Demo Procedures", "Live Model Procedure Guide"): "Ombré — Live Procedure, Healing & Touch-Up Quiz",
}

os.chdir(os.path.join(BENCH, "sites"))
frappe.init(site=SITE, sites_path=os.path.join(BENCH, "sites"))
frappe.connect()


def delete_quiz(qid):
    if not qid or not frappe.db.exists("LMS Quiz", qid):
        return
    for row in frappe.get_all("LMS Quiz Question", filters={"parent": qid}, fields=["question"]):
        if row.get("question") and frappe.db.exists("LMS Question", row.question):
            frappe.db.delete("LMS Question", row.question)
    frappe.db.sql("DELETE FROM `tabLMS Quiz Question` WHERE parent=%s", qid)
    frappe.db.delete("LMS Quiz", qid)


def create_quiz(title, questions):
    quiz = frappe.get_doc({
        "doctype": "LMS Quiz", "title": title,
        "passing_percentage": PASSING, "max_attempts": ATTEMPTS,
        "show_answers": 1, "show_submission_history": 1,
    })
    quiz.insert(ignore_permissions=True)
    frappe.db.commit()
    for q_idx, q in enumerate(questions, 1):
        opts = (q.get("options") or [])[:4]
        payload = {"doctype": "LMS Question", "question": q["question"], "type": "Choices",
                   "multiple": 1 if q.get("type") == "MultipleChoice" else 0}
        for i, opt in enumerate(opts, 1):
            payload["option_%d" % i] = opt["option"]
            payload["is_correct_%d" % i] = 1 if opt.get("is_correct") else 0
        qd = frappe.get_doc(payload)
        qd.insert(ignore_permissions=True)
        frappe.get_doc({
            "doctype": "LMS Quiz Question", "parent": quiz.name, "parenttype": "LMS Quiz",
            "parentfield": "questions", "question": qd.name, "marks": 1, "idx": q_idx,
        }).insert(ignore_permissions=True)
    frappe.db.commit()
    return quiz.name


assert frappe.db.exists("LMS Course", COURSE), "Ombré course not found"

# (chapter_title, lesson_title) -> lesson_name
lesson_by = {}
all_lessons = []
for ch in frappe.get_all("Course Chapter", filters={"course": COURSE}, fields=["name", "title"]):
    for ls in frappe.get_all("Course Lesson", filters={"chapter": ch.name},
                             fields=["name", "title", "quiz_id"]):
        lesson_by[(ch.title, ls.title)] = ls.name
        all_lessons.append(ls)

# Group bank quizzes onto their target (surviving) lesson, preserving order.
groups = OrderedDict()
for qz in OMBRE_QUIZZES:
    ch, ls = qz["chapter"], qz["lesson"]
    target = REDIRECT.get((ch, ls), ls)
    g = groups.setdefault((ch, target), {"questions": []})
    g["questions"].extend(qz["questions"])
for (ch, target), g in groups.items():
    g["title"] = TITLE_OVERRIDE.get((ch, target)) or next(
        (q["title"] for q in OMBRE_QUIZZES if q["chapter"] == ch and q["lesson"] == target), None)

# --- cleanup (idempotent) ---
removed = 0
for ls in all_lessons:
    if ls.get("quiz_id"):
        delete_quiz(ls.quiz_id)
        frappe.db.set_value("Course Lesson", ls.name, "quiz_id", None)
        removed += 1
managed_titles = {q["title"] for q in OMBRE_QUIZZES} | set(TITLE_OVERRIDE.values())
for t in managed_titles:
    for nm in frappe.get_all("LMS Quiz", filters={"title": t}, pluck="name"):
        delete_quiz(nm)
frappe.db.commit()
print("cleared old quiz_id from %d lessons" % removed)

# --- apply ---
applied = 0
missing = []
for (ch, target), g in groups.items():
    lesson_name = lesson_by.get((ch, target))
    if not lesson_name:
        missing.append((ch, target))
        continue
    qid = create_quiz(g["title"], g["questions"])
    frappe.db.set_value("Course Lesson", lesson_name, "quiz_id", qid)
    applied += 1
frappe.db.commit()

print("applied %d quizzes (%d total questions)" % (applied, sum(len(g["questions"]) for g in groups.values())))
if missing:
    print("!! MISSING target lessons:", missing)

print("\n=== lessons now carrying a quiz ===")
for ch in frappe.get_all("Course Chapter", filters={"course": COURSE}, fields=["name", "title"], order_by="idx asc"):
    for ls in frappe.get_all("Course Lesson", filters={"chapter": ch.name},
                             fields=["title", "quiz_id"], order_by="idx asc"):
        if ls.get("quiz_id"):
            nq = frappe.db.count("LMS Quiz Question", {"parent": ls.quiz_id})
            qt = frappe.db.get_value("LMS Quiz", ls.quiz_id, "title")
            print("  [%s] %-34s  %2dQ  %s" % (ch.title[:16], ls.title[:34], nq, qt))
frappe.destroy()
