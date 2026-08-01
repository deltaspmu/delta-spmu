"""Remove stock Frappe LMS sample content from Delta environments."""

import frappe


DEMO_COURSES = ("a-guide-to-frappe-learning",)
DEMO_QUIZ_TITLES = ("Do you know Frappe Learning?",)

# Stock categories shipped by the upstream Frappe LMS fixture. A category is
# removed only when no course references it, so a future real course can use
# one of these names without being damaged by this maintenance task.
DEMO_CATEGORIES = (
    "Web Development",
    "Business",
    "Design",
    "Personal Development",
    "Finance",
    "Frontend",
    "Framework",
)


def get_frappe_demo_content_status():
    """Return the exact stock demo records that still exist on this site."""
    courses = frappe.get_all(
        "LMS Course",
        filters={"name": ("in", DEMO_COURSES)},
        fields=["name", "title", "published", "category"],
        order_by="name asc",
        limit_page_length=0,
    )
    quizzes = frappe.get_all(
        "LMS Quiz",
        filters={"title": ("in", DEMO_QUIZ_TITLES)},
        fields=["name", "title", "course"],
        order_by="name asc",
        limit_page_length=0,
    )
    categories = frappe.get_all(
        "LMS Category",
        filters={"name": ("in", DEMO_CATEGORIES)},
        fields=["name", "category"],
        order_by="name asc",
        limit_page_length=0,
    )
    for category in categories:
        category["course_count"] = frappe.db.count(
            "LMS Course", {"category": category["name"]}
        )

    return {
        "courses": courses,
        "quizzes": quizzes,
        "categories": categories,
    }


def cleanup_frappe_demo_content():
    """Delete the known Frappe sample records and commit atomically.

    Courses are deleted before quizzes so the LMS course controller can remove
    its chapter/lesson graph first. The quiz list is then fetched again because
    some LMS versions also remove linked quizzes as part of course deletion.
    """
    before = get_frappe_demo_content_status()
    deleted = {"courses": [], "quizzes": [], "categories": []}
    skipped = {"categories_in_use": []}

    try:
        for course in before["courses"]:
            frappe.delete_doc(
                "LMS Course", course["name"], ignore_permissions=True
            )
            deleted["courses"].append(course["name"])

        remaining_quizzes = frappe.get_all(
            "LMS Quiz",
            filters={"title": ("in", DEMO_QUIZ_TITLES)},
            fields=["name", "title"],
            order_by="name asc",
            limit_page_length=0,
        )
        for quiz in remaining_quizzes:
            frappe.delete_doc("LMS Quiz", quiz["name"], ignore_permissions=True)
            deleted["quizzes"].append(quiz["name"])

        remaining_categories = frappe.get_all(
            "LMS Category",
            filters={"name": ("in", DEMO_CATEGORIES)},
            fields=["name"],
            order_by="name asc",
            limit_page_length=0,
        )
        for category in remaining_categories:
            name = category["name"]
            course_count = frappe.db.count("LMS Course", {"category": name})
            if course_count:
                skipped["categories_in_use"].append({
                    "name": name,
                    "course_count": course_count,
                })
                continue
            frappe.delete_doc("LMS Category", name, ignore_permissions=True)
            deleted["categories"].append(name)

        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        raise

    frappe.clear_cache()
    return {
        "before": before,
        "deleted": deleted,
        "skipped": skipped,
        "after": get_frappe_demo_content_status(),
    }
