"""Course bundle catalogue and administration APIs.

Bundles deliberately snapshot their courses into a payment transaction at
checkout.  Editing a bundle therefore changes future offers only; it never
changes what an earlier buyer paid for.
"""

import json

import frappe
from frappe import _


def _require_admin():
    if frappe.session.user == "Guest" or "System Manager" not in frappe.get_roles():
        frappe.throw(_("Administrator access is required."), frappe.PermissionError)


def _parse_courses(courses):
    if isinstance(courses, str):
        courses = frappe.parse_json(courses)
    names = [str(item.get("course") if isinstance(item, dict) else item).strip() for item in (courses or [])]
    names = [name for name in names if name]
    if len(names) < 2:
        frappe.throw(_("A bundle must contain at least two courses."))
    if len(set(names)) != len(names):
        frappe.throw(_("A course can only appear once in a bundle."))
    unpublished = [name for name in names if not frappe.db.exists("LMS Course", {"name": name, "published": 1})]
    if unpublished:
        frappe.throw(_("Bundles may contain published courses only."))
    return names


def _serialize_bundle(doc, include_courses=True):
    courses = []
    if include_courses:
        names = [row.course for row in doc.get("courses", [])]
        filters = {"name": ["in", names]}
        if doc.published:
            filters["published"] = 1
        details = {
            row.name: row
            for row in frappe.get_all(
                "LMS Course",
                filters=filters,
                fields=["name", "title", "image", "short_introduction", "course_price", "currency", "published"],
            )
        } if names else {}
        # A published offer cannot leak an unpublished course when a course is
        # later taken offline. The admin can update the draft and republish it.
        if doc.published and len(details) != len(names):
            return None
        courses = [details[name] for name in names if name in details]
    price = float(doc.price or 0)
    discount = float(doc.discount_percentage or 0)
    compare_at = round(price / (1 - discount / 100), 2) if 0 < discount < 100 else None
    return {
        "name": doc.name,
        "title": doc.title,
        "description": doc.description or "",
        "image": doc.image,
        "price": price,
        "currency": doc.currency or "ETB",
        "discount_percentage": discount,
        "original_price": compare_at,
        "published": int(doc.published or 0),
        "course_count": len(courses) if include_courses else len(doc.get("courses", [])),
        "courses": courses,
    }


def get_bundle_courses(bundle_name):
    """Return the immutable course list used when a bundle is purchased."""
    doc = frappe.get_doc("Course Bundle", bundle_name)
    names = [row.course for row in doc.get("courses", [])]
    if len(names) < 2:
        frappe.throw(_("This bundle is not available."))
    if len(frappe.get_all("LMS Course", filters={"name": ["in", names], "published": 1}, pluck="name")) != len(names):
        frappe.throw(_("This bundle contains a course that is no longer available."))
    return names


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_public_bundles():
    bundles = []
    for name in frappe.get_all("Course Bundle", filters={"published": 1}, pluck="name", order_by="modified desc"):
        item = _serialize_bundle(frappe.get_doc("Course Bundle", name))
        if item:
            bundles.append(item)
    return bundles


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_bundle_detail(bundle_name):
    if not frappe.db.exists("Course Bundle", {"name": bundle_name, "published": 1}):
        frappe.throw(_("Bundle not found."), frappe.DoesNotExistError)
    item = _serialize_bundle(frappe.get_doc("Course Bundle", bundle_name))
    if not item:
        frappe.throw(_("Bundle is not available."))
    return item


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_bundles_for_course(course_name):
    return [item for item in get_public_bundles() if any(course["name"] == course_name for course in item["courses"])]


@frappe.whitelist()
def admin_get_bundles():
    _require_admin()
    return [item for item in (
        _serialize_bundle(frappe.get_doc("Course Bundle", name))
        for name in frappe.get_all("Course Bundle", pluck="name", order_by="modified desc")
    ) if item]


def _save_bundle(doc, title, description, image, price, currency, discount_percentage, published, courses):
    names = _parse_courses(courses)
    price = float(price or 0)
    discount = float(discount_percentage or 0)
    if not str(title or "").strip():
        frappe.throw(_("Bundle title is required."))
    if price < 0 or not 0 <= discount < 100:
        frappe.throw(_("Enter a valid sale price and discount percentage."))
    doc.title = str(title).strip()
    doc.description = description or ""
    doc.image = image or None
    doc.price = price
    doc.currency = currency if currency in ("ETB", "USD") else "ETB"
    doc.discount_percentage = discount
    doc.published = 1 if int(published or 0) else 0
    doc.set("courses", [{"course": name} for name in names])
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return _serialize_bundle(doc)


@frappe.whitelist()
def admin_create_bundle(title, description="", image=None, price=0, currency="ETB", discount_percentage=0, published=0, courses=None):
    _require_admin()
    doc = frappe.get_doc({"doctype": "Course Bundle"})
    doc.insert(ignore_permissions=True)
    return _save_bundle(doc, title, description, image, price, currency, discount_percentage, published, courses)


@frappe.whitelist()
def admin_update_bundle(name, title, description="", image=None, price=0, currency="ETB", discount_percentage=0, published=0, courses=None):
    _require_admin()
    return _save_bundle(frappe.get_doc("Course Bundle", name), title, description, image, price, currency, discount_percentage, published, courses)


@frappe.whitelist()
def admin_delete_bundle(name):
    _require_admin()
    frappe.delete_doc("Course Bundle", name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True}
