"""Course-structure maintenance helpers for persisted LMS content."""

import frappe


OMBRE_COURSE = "professional-certificate-in-ombre-brows-artistry"


def chapter_index_changes(chapters):
    """Return the writes needed to make an ordered chapter list 1-based.

    Callers are responsible for supplying chapters in the intended display
    order. Keeping this calculation pure makes the repair easy to verify
    without a running Frappe site.
    """
    changes = []
    for new_idx, chapter in enumerate(chapters, start=1):
        try:
            old_idx = int(chapter.get("idx") or 0)
        except (TypeError, ValueError):
            old_idx = 0
        if old_idx != new_idx:
            changes.append({
                "name": chapter["name"],
                "title": chapter.get("title") or "",
                "old_idx": old_idx,
                "new_idx": new_idx,
            })
    return changes


def reindex_course_chapters(course):
    """Normalize one course's chapter indices without committing.

    Existing indices remain the primary ordering signal. Creation time and
    name make duplicate indices deterministic while preserving the order in
    which equally-positioned chapters were authored.
    """
    if not course or not frappe.db.exists("LMS Course", course):
        frappe.throw(f"Course {course or ''} does not exist.", frappe.DoesNotExistError)

    chapters = frappe.get_all(
        "Course Chapter",
        filters={"course": course},
        fields=["name", "title", "idx", "creation"],
        order_by="idx asc, creation asc, name asc",
        limit_page_length=0,
    )
    changes = chapter_index_changes(chapters)
    for change in changes:
        frappe.db.set_value(
            "Course Chapter",
            change["name"],
            "idx",
            change["new_idx"],
            update_modified=False,
        )
    return changes


def apply_ombre_chapter_order():
    """Idempotently repair the persisted ombre-course chapter numbering."""
    changes = reindex_course_chapters(OMBRE_COURSE)
    frappe.db.commit()
    frappe.clear_cache()
    return {
        "course": OMBRE_COURSE,
        "updated": len(changes),
        "changes": changes,
    }
