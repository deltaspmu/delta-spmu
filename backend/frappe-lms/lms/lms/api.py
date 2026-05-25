"""
Delta SPMU Academy - Frappe LMS Backend API Module

This module provides the main REST API endpoints for the Delta SPMU Academy
learning management system built on Frappe Framework. It exposes both
guest-accessible and authenticated endpoints for course management, user
profiles, enrollment tracking, billing, reviews, notifications, and more.

All endpoints use cookie-based sessions (withCredentials: true) and are
decorated with @frappe.whitelist(). Guest-accessible endpoints use
frappe.db.get_value() / frappe.get_all() instead of frappe.get_doc()
to avoid PermissionError for unauthenticated users.

Copyright (c) Delta SPMU Academy. All rights reserved.
"""

import json
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import (
    cint,
    cstr,
    flt,
    get_datetime,
    get_fullname,
    get_gravatar,
    getdate,
    now,
    now_datetime,
    nowdate,
    sanitize_html,
    strip_html,
    today,
    validate_email_address,
)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _get_current_user():
    """Return the current session user email."""
    return frappe.session.user


def _is_guest():
    """Return True if the current session belongs to a Guest user."""
    return _get_current_user() == "Guest"


def _require_login():
    """Throw an error if the user is not logged in."""
    if _is_guest():
        frappe.throw(_("You must be logged in to perform this action."), frappe.AuthenticationError)


def _sanitize(value, max_length=None):
    """Sanitize a string value for safe storage."""
    if not value:
        return value
    value = sanitize_html(cstr(value))
    if max_length and len(value) > max_length:
        value = value[:max_length]
    return value


def _parse_json_param(param):
    """Parse a parameter that may arrive as a JSON string or already a dict/list."""
    if param is None:
        return None
    if isinstance(param, (dict, list)):
        return param
    if isinstance(param, str):
        try:
            return json.loads(param)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def _validate_rating(rating):
    """Ensure rating is an integer between 1 and 5."""
    rating = cint(rating)
    if rating < 1 or rating > 5:
        frappe.throw(_("Rating must be between 1 and 5."))
    return rating


def _build_pagination(limit=20, offset=0):
    """Return sanitized pagination values."""
    limit = cint(limit) or 20
    offset = cint(offset) or 0
    if limit < 1:
        limit = 20
    if limit > 100:
        limit = 100
    if offset < 0:
        offset = 0
    return limit, offset


def _get_user_avatar(user_email):
    """Return user avatar URL or gravatar fallback."""
    user_image = frappe.db.get_value("User", user_email, "user_image")
    if user_image:
        return user_image
    return get_gravatar(user_email)


def _has_role(user, role):
    """Check if a user has a specific role."""
    roles = frappe.get_roles(user)
    return role in roles


# ---------------------------------------------------------------------------
# 1. get_csrf_token  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_csrf_token():
    """
    Return the current CSRF token for the session.

    This endpoint is called by the frontend on initial load to obtain
    the CSRF token required for subsequent POST/PUT/DELETE requests.
    Works for both authenticated and guest sessions.

    Returns:
        dict: {"csrf_token": "<token_string>"}
    """
    try:
        token = frappe.sessions.get_csrf_token()
        return {"csrf_token": token}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_csrf_token failed")
        frappe.throw(_("Unable to retrieve CSRF token. Please try again."))


# ---------------------------------------------------------------------------
# 2. get_user_info  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_user_info():
    """
    Return profile information for the current session user.

    For guest users, returns a minimal Guest profile stub.
    For authenticated users, returns full profile data including
    name, email, avatar, roles, and enrollment statistics.

    Returns:
        dict: User profile data.
    """
    try:
        user = _get_current_user()

        if user == "Guest":
            return {
                "user": "Guest",
                "full_name": "Guest",
                "email": None,
                "user_image": None,
                "roles": ["Guest"],
                "is_guest": True,
                "enrolled_courses_count": 0,
                "completed_courses_count": 0,
            }

        user_data = frappe.db.get_value(
            "User",
            user,
            [
                "name",
                "email",
                "first_name",
                "last_name",
                "full_name",
                "user_image",
                "bio",
                "location",
                "phone",
                "mobile_no",
                "birth_date",
                "gender",
                "language",
                "time_zone",
                "last_login",
                "creation",
            ],
            as_dict=True,
        )

        if not user_data:
            frappe.throw(_("User record not found."), frappe.DoesNotExistError)

        roles = frappe.get_roles(user)

        # Enrollment stats
        enrolled_count = frappe.db.count(
            "LMS Enrollment",
            filters={"member": user},
        )
        completed_count = frappe.db.count(
            "LMS Enrollment",
            filters={"member": user, "progress": (">=", 100)},
        )

        user_data.update(
            {
                "roles": roles,
                "is_guest": False,
                "is_instructor": "Course Creator" in roles or "Instructor" in roles,
                "is_admin": "System Manager" in roles or "LMS Manager" in roles,
                "enrolled_courses_count": enrolled_count,
                "completed_courses_count": completed_count,
                "user_image": user_data.get("user_image") or get_gravatar(user),
            }
        )

        return user_data

    except frappe.AuthenticationError:
        raise
    except frappe.DoesNotExistError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_user_info failed")
        frappe.throw(_("Unable to retrieve user information."))


# ---------------------------------------------------------------------------
# 3. get_branding  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_branding():
    """
    Return site branding configuration for the frontend.

    Reads branding values from Website Settings and LMS Settings
    doctypes using frappe.db.get_single_value to avoid permission
    issues for guest users.

    Returns:
        dict: Branding data including site name, logo, favicon, etc.
    """
    try:
        site_name = (
            frappe.db.get_single_value("Website Settings", "app_name")
            or frappe.db.get_single_value("System Settings", "app_name")
            or "Delta SPMU Academy"
        )
        logo = frappe.db.get_single_value("Website Settings", "app_logo") or None
        favicon = frappe.db.get_single_value("Website Settings", "favicon") or None
        banner_image = frappe.db.get_single_value("Website Settings", "banner_image") or None
        splash_image = frappe.db.get_single_value("Website Settings", "splash_image") or None
        brand_html = frappe.db.get_single_value("Website Settings", "brand_html") or ""
        copyright_text = frappe.db.get_single_value("Website Settings", "copyright") or ""
        footer_powered = frappe.db.get_single_value("Website Settings", "footer_powered") or ""
        top_bar_items = frappe.db.get_single_value("Website Settings", "top_bar_items") or ""
        disable_signup = cint(
            frappe.db.get_single_value("Website Settings", "disable_signup")
        )

        # LMS-specific branding — some fields may not exist on stock LMS
        # Settings, so read safely via try/except per field.
        def _safe_single(doctype, field, default=None):
            try:
                return frappe.db.get_single_value(doctype, field) or default
            except Exception:
                return default

        lms_title = _safe_single("LMS Settings", "lms_title", site_name)
        lms_description = _safe_single("LMS Settings", "meta_description", "")
        hero_title = site_name
        hero_subtitle = lms_description
        hero_image = None
        primary_color = "#D1BFAE"
        secondary_color = "#121212"
        custom_css = ""

        return {
            "site_name": site_name,
            "lms_title": lms_title,
            "lms_description": lms_description,
            "logo": logo,
            "favicon": favicon,
            "banner_image": banner_image,
            "splash_image": splash_image,
            "brand_html": brand_html,
            "copyright": copyright_text,
            "footer_powered": footer_powered,
            "disable_signup": bool(disable_signup),
            "hero_title": hero_title,
            "hero_subtitle": hero_subtitle,
            "hero_image": hero_image,
            "primary_color": primary_color,
            "secondary_color": secondary_color,
            "custom_css": custom_css,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_branding failed")
        frappe.throw(_("Unable to load branding information."))


# ---------------------------------------------------------------------------
# 4. get_translations  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_translations(language=None):
    """
    Return i18n translation strings for the given language.

    If no language is specified, falls back to the user's preferred
    language or the system default language.

    Args:
        language (str, optional): Language code (e.g. "de", "nl", "fr").

    Returns:
        dict: {"language": "<code>", "translations": {key: value, ...}}
    """
    try:
        if not language:
            if not _is_guest():
                language = frappe.db.get_value("User", _get_current_user(), "language")
            if not language:
                language = frappe.db.get_single_value("System Settings", "language") or "en"

        language = cstr(language).strip().lower()

        try:
            translations = frappe.get_lang_dict("messages", language)
        except Exception:
            translations = {}

        return {
            "language": language,
            "translations": translations,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_translations failed")
        return {"language": language or "en", "translations": {}}


# ---------------------------------------------------------------------------
# 5. validate_billing_access  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def validate_billing_access(billing_type=None, name=None):
    """
    Check whether the current user has purchased or been granted access
    to a specific course or resource.

    Queries the 'Course Access' doctype to determine if a valid,
    non-expired access record exists for the current user.

    Args:
        billing_type (str): The type of resource — e.g. "Course", "Bundle".
        name (str): The name/ID of the resource to check.

    Returns:
        dict: {"has_access": bool, "access_type": str or None,
               "valid_until": date or None}
    """
    try:
        user = _get_current_user()

        if not billing_type or not name:
            return {"has_access": False, "access_type": None, "valid_until": None}

        if user == "Guest":
            return {"has_access": False, "access_type": None, "valid_until": None}

        billing_type = _sanitize(billing_type, max_length=100)
        name = _sanitize(name, max_length=200)

        access_records = frappe.get_all(
            "Course Access",
            filters={
                "user": user,
                "billing_type": billing_type,
                "reference_name": name,
                "is_active": 1,
            },
            fields=["name", "access_type", "valid_until", "creation"],
            order_by="creation desc",
            limit_page_length=1,
        )

        if not access_records:
            return {"has_access": False, "access_type": None, "valid_until": None}

        record = access_records[0]

        # Check expiry
        if record.get("valid_until"):
            if getdate(record["valid_until"]) < getdate(today()):
                return {
                    "has_access": False,
                    "access_type": record.get("access_type"),
                    "valid_until": record.get("valid_until"),
                    "expired": True,
                }

        return {
            "has_access": True,
            "access_type": record.get("access_type"),
            "valid_until": record.get("valid_until"),
            "expired": False,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "validate_billing_access failed")
        return {"has_access": False, "access_type": None, "valid_until": None}


# ---------------------------------------------------------------------------
# 6. get_categories  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_categories(doctype=None, filters=None):
    """
    Return a list of categories or tags for the specified doctype.

    Commonly used to fetch Course Category, Course Tag, or similar
    classification lists for filter dropdowns on the frontend.

    Args:
        doctype (str, optional): Doctype to query. Defaults to "Course Category".
        filters (str|dict, optional): Additional filters as JSON or dict.

    Returns:
        list: List of category dicts with name, title, image, etc.
    """
    try:
        allowed_doctypes = [
            "Course Category",
            "LMS Category",
        ]

        doctype = cstr(doctype).strip() if doctype else "Course Category"

        if doctype not in allowed_doctypes:
            frappe.throw(
                _("Invalid category doctype: {0}").format(doctype),
                frappe.ValidationError,
            )

        parsed_filters = _parse_json_param(filters) or {}

        # Ensure we only pass safe filter keys
        safe_filters = {}
        if isinstance(parsed_filters, dict):
            for key, val in parsed_filters.items():
                if isinstance(key, str) and len(key) < 100:
                    safe_filters[key] = val

        # The real `LMS Category` doctype only has `name` (PK) and a
        # `category` Data field. There is no title/image/description.
        # We expose `title` as an alias of `category` so the React
        # portals don't need to know about the rename.
        # frappe.get_all bypasses permissions which is what guests need.
        rows = frappe.get_all(
            doctype,
            filters=safe_filters,
            fields=["name", "category", "creation"],
            order_by="category asc",
            limit_page_length=0,
        )

        categories = []
        for r in rows:
            cat = {
                "name": r["name"],
                "title": r.get("category") or r["name"],
                "image": None,
                "description": None,
                "creation": r.get("creation"),
                "course_count": frappe.db.count(
                    "LMS Course",
                    filters={"category": r["name"], "published": 1},
                ),
            }
            categories.append(cat)

        return categories

    except frappe.ValidationError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_categories failed")
        frappe.throw(_("Unable to retrieve categories."))


# ---------------------------------------------------------------------------
# 7. get_lms_settings  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_lms_settings():
    """
    Return platform-wide LMS configuration settings.

    Reads from the 'LMS Settings' singleton doctype. Only exposes
    fields that are safe for public consumption — no secrets or
    internal configuration.

    Returns:
        dict: Platform configuration values.
    """
    try:
        fields_map = {
            "lms_title": "lms_title",
            "description": "description",
            "force_published_on_creation": "force_published_on_creation",
            "allow_self_enrollment": "allow_self_enrollment",
            "send_enrollment_email": "send_enrollment_email",
            "show_reviews": "show_reviews",
            "allow_reviews": "allow_reviews",
            "show_progress": "show_progress",
            "enable_certificates": "enable_certificates",
            "certificate_template": "certificate_template",
            "enable_gamification": "enable_gamification",
            "max_rating": "max_rating",
            "payment_gateway": "payment_gateway",
            "currency": "currency",
            "enable_payments": "enable_payments",
            "hero_title": "hero_title",
            "hero_subtitle": "hero_subtitle",
            "hero_image": "hero_image",
            "primary_color": "primary_color",
            "enrollment_requires_approval": "enrollment_requires_approval",
            "default_course_image": "default_course_image",
            "terms_of_use": "terms_of_use",
            "privacy_policy": "privacy_policy",
        }

        settings = {}
        for key, field_name in fields_map.items():
            try:
                value = frappe.db.get_single_value("LMS Settings", field_name)
                settings[key] = value
            except Exception:
                settings[key] = None

        # Normalise boolean fields
        bool_fields = [
            "force_published_on_creation",
            "allow_self_enrollment",
            "send_enrollment_email",
            "show_reviews",
            "allow_reviews",
            "show_progress",
            "enable_certificates",
            "enable_gamification",
            "enable_payments",
            "enrollment_requires_approval",
        ]
        for bf in bool_fields:
            settings[bf] = bool(cint(settings.get(bf)))

        return settings

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_lms_settings failed")
        frappe.throw(_("Unable to load LMS settings."))


# ---------------------------------------------------------------------------
# 8. get_courses  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_courses(filters=None, limit=20, offset=0, order_by=None):
    """
    Return a paginated list of published courses.

    Supports filtering by category, instructor, price range, search
    query, and custom filters passed as JSON. Only published courses
    are returned to guest users.

    Args:
        filters (str|dict, optional): JSON filter object.
            Supported keys: category, instructor, search, min_price,
            max_price, tags, is_free.
        limit (int): Number of results per page (default 20, max 100).
        offset (int): Pagination offset.
        order_by (str): Sort field — one of "creation", "title",
            "course_price", "avg_rating", "enrollment_count".

    Returns:
        dict: {"courses": [...], "total": int, "limit": int, "offset": int}
    """
    try:
        limit, offset = _build_pagination(limit, offset)
        parsed_filters = _parse_json_param(filters) or {}

        # Base filters — always restrict to published courses
        db_filters = {"published": 1}

        # Category filter
        category = parsed_filters.get("category")
        if category:
            db_filters["category"] = _sanitize(category, 200)

        # Instructor filter — instructors live in the `Course Instructor`
        # child table (Table MultiSelect), so we resolve to a list of
        # parent course names first, then filter by name.
        instructor = parsed_filters.get("instructor")
        instructor_course_names = None
        if instructor:
            instructor_safe = _sanitize(instructor, 200)
            rows = frappe.db.sql(
                """
                SELECT DISTINCT parent
                FROM `tabCourse Instructor`
                WHERE instructor = %(instructor)s
                  AND parenttype = 'LMS Course'
                """,
                {"instructor": instructor_safe},
                as_list=True,
            )
            instructor_course_names = [r[0] for r in rows] if rows else []
            if not instructor_course_names:
                return {"courses": [], "total": 0, "limit": limit, "offset": offset}
            db_filters["name"] = ("in", instructor_course_names)

        # Free courses filter
        is_free = parsed_filters.get("is_free")
        if is_free is not None:
            if cint(is_free):
                db_filters["course_price"] = 0
            else:
                db_filters["course_price"] = (">", 0)

        # Price range
        min_price = parsed_filters.get("min_price")
        max_price = parsed_filters.get("max_price")
        if min_price is not None and max_price is not None:
            db_filters["course_price"] = ("between", [flt(min_price), flt(max_price)])
        elif min_price is not None:
            db_filters["course_price"] = (">=", flt(min_price))
        elif max_price is not None:
            db_filters["course_price"] = ("<=", flt(max_price))

        # Tags filter — `tags` on LMS Course is a CSV Data field,
        # not a child table.  We OR a LIKE for each requested tag.
        tags = parsed_filters.get("tags")
        if tags:
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",") if t.strip()]
            if tags:
                # Prepend a name-restriction list if any earlier filter
                # already set one (instructor); otherwise plain LIKE OR
                tag_matches = frappe.db.sql(
                    """
                    SELECT name FROM `tabLMS Course`
                    WHERE published = 1
                      AND ({clauses})
                    """.format(
                        clauses=" OR ".join(
                            ["tags LIKE %s" for _ in tags]
                        )
                    ),
                    tuple(f"%{t}%" for t in tags),
                    as_list=True,
                )
                tag_course_names = [r[0] for r in tag_matches] if tag_matches else []
                if not tag_course_names:
                    return {"courses": [], "total": 0, "limit": limit, "offset": offset}
                # Intersect with any existing name filter
                if isinstance(db_filters.get("name"), tuple) and db_filters["name"][0] == "in":
                    db_filters["name"] = (
                        "in",
                        list(set(db_filters["name"][1]) & set(tag_course_names)),
                    )
                    if not db_filters["name"][1]:
                        return {"courses": [], "total": 0, "limit": limit, "offset": offset}
                else:
                    db_filters["name"] = ("in", tag_course_names)

        # Search query (title / short_introduction)
        search = parsed_filters.get("search")
        or_filters = None
        if search:
            search = _sanitize(search, 200)
            or_filters = {
                "title": ("like", f"%{search}%"),
                "short_introduction": ("like", f"%{search}%"),
            }

        # Order by — map our public sort keys to real LMS Course columns
        allowed_orders = {
            "creation": "creation desc",
            "title": "title asc",
            "course_price": "course_price asc",
            "course_price_desc": "course_price desc",
            "avg_rating": "rating desc",
            "rating": "rating desc",
            "enrollment_count": "enrollments desc",
            "enrollments": "enrollments desc",
            "modified": "modified desc",
        }
        order_clause = allowed_orders.get(cstr(order_by).strip(), "creation desc")

        # Total count.  frappe.db.count() does not accept or_filters in
        # Frappe v15, so when a search is active we count via get_all and
        # otherwise use the cheap COUNT(*) path.
        if or_filters:
            total = len(
                frappe.get_all(
                    "LMS Course",
                    filters=db_filters,
                    or_filters=or_filters,
                    pluck="name",
                    limit_page_length=0,
                )
            )
        else:
            total = frappe.db.count("LMS Course", filters=db_filters)

        # Fetch courses — only real columns on `tabLMS Course`.
        # Frontend-facing aliases (avg_rating, enrollment_count,
        # lesson_count, chapter_count, instructor, instructor_name,
        # instructor_image) are added in the enrichment loop below.
        courses = frappe.get_all(
            "LMS Course",
            filters=db_filters,
            or_filters=or_filters,
            fields=[
                "name",
                "title",
                "short_introduction",
                "image",
                "course_price",
                "currency",
                "category",
                "published",
                "rating",
                "enrollments",
                "lessons",
                "creation",
                "modified",
                "paid_course",
                "upcoming",
                "disable_self_learning",
            ],
            order_by=order_clause,
            limit_page_length=limit,
            limit_start=offset,
        )

        # Bulk-load primary instructor for each course in one query
        course_names = [c["name"] for c in courses]
        instructors_by_course = {}
        if course_names:
            inst_rows = frappe.db.sql(
                """
                SELECT parent, instructor
                FROM `tabCourse Instructor`
                WHERE parenttype = 'LMS Course'
                  AND parent IN %(names)s
                ORDER BY idx ASC
                """,
                {"names": tuple(course_names)},
                as_dict=True,
            )
            for row in inst_rows:
                # First instructor wins (lowest idx)
                instructors_by_course.setdefault(row["parent"], row["instructor"])

        # Bulk-load chapter counts in one query
        chapter_counts = {}
        if course_names:
            chap_rows = frappe.db.sql(
                """
                SELECT course, COUNT(*) as cnt
                FROM `tabCourse Chapter`
                WHERE course IN %(names)s
                GROUP BY course
                """,
                {"names": tuple(course_names)},
                as_dict=True,
            )
            chapter_counts = {r["course"]: r["cnt"] for r in chap_rows}

        # Enrich each course with frontend-facing aliases
        for course in courses:
            instructor = instructors_by_course.get(course["name"])
            if instructor:
                instructor_name = frappe.db.get_value(
                    "User", instructor, "full_name"
                )
                course["instructor"] = instructor
                course["instructor_name"] = instructor_name or instructor
                course["instructor_image"] = _get_user_avatar(instructor)
            else:
                course["instructor"] = None
                course["instructor_name"] = ""
                course["instructor_image"] = None

            # Frontend aliases
            course["avg_rating"] = course.get("rating") or 0
            course["enrollment_count"] = course.get("enrollments") or 0
            course["lesson_count"] = course.get("lessons") or 0
            course["chapter_count"] = chapter_counts.get(course["name"], 0)

        return {
            "courses": courses,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_courses failed")
        frappe.throw(_("Unable to retrieve courses."))


# ---------------------------------------------------------------------------
# 9. get_course_detail  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_course_detail(course_name=None):
    """
    Return full details for a single course.

    Includes course metadata, chapters with lessons, instructor profile,
    review summary, and — for authenticated users — enrollment status
    and progress.

    Args:
        course_name (str): The name (ID) of the course.

    Returns:
        dict: Complete course data with nested chapters and lessons.
    """
    try:
        if not course_name:
            frappe.throw(_("Course name is required."), frappe.ValidationError)

        course_name = _sanitize(course_name, 200)

        # Fetch core course fields — only real LMS Course columns
        # (learning_outcomes is a Custom Field added via Frappe Custom Field
        #  doctype; safe to include since the DB column exists).
        course = frappe.db.get_value(
            "LMS Course",
            course_name,
            [
                "name",
                "title",
                "short_introduction",
                "description",
                "learning_outcomes",
                "image",
                "video_link",
                "course_price",
                "currency",
                "paid_course",
                "category",
                "published",
                "upcoming",
                "disable_self_learning",
                "rating",
                "enrollments",
                "lessons",
                "creation",
                "modified",
                "status",
            ],
            as_dict=True,
        )

        if not course:
            frappe.throw(
                _("Course {0} not found.").format(course_name),
                frappe.DoesNotExistError,
            )

        # Only allow viewing published courses for guests
        if _is_guest() and not cint(course.get("published")):
            frappe.throw(
                _("This course is not available."),
                frappe.PermissionError,
            )

        # Frontend aliases for renamed fields
        course["avg_rating"] = course.get("rating") or 0
        course["enrollment_count"] = course.get("enrollments") or 0
        course["lesson_count"] = course.get("lessons") or 0
        # chapter_count computed below after we fetch chapters

        # Instructor — resolve from Course Instructor child table
        instructor_user = frappe.db.sql(
            """SELECT instructor FROM `tabCourse Instructor`
            WHERE parent=%s AND parenttype='LMS Course'
            ORDER BY idx ASC LIMIT 1""",
            course_name,
            as_dict=True,
        )
        instructor_id = instructor_user[0]["instructor"] if instructor_user else None
        course["instructor"] = instructor_id

        if instructor_id:
            instructor_data = frappe.db.get_value(
                "User",
                instructor_id,
                ["full_name", "bio", "user_image", "email"],
                as_dict=True,
            )
            if instructor_data:
                course["instructor_name"] = instructor_data.get("full_name", "")
                course["instructor_bio"] = instructor_data.get("bio", "")
                course["instructor_image"] = (
                    instructor_data.get("user_image") or get_gravatar(instructor_id)
                )
                if not _is_guest():
                    course["instructor_email"] = instructor_data.get("email", "")

        # Chapters and lessons
        chapters = frappe.get_all(
            "Course Chapter",
            filters={"course": course_name},
            fields=["name", "title", "idx"],
            order_by="idx asc",
            limit_page_length=0,
        )

        for chapter in chapters:
            chapter_number = chapter.get("idx") or 1
            lessons = frappe.get_all(
                "Course Lesson",
                filters={"chapter": chapter["name"]},
                fields=[
                    "name",
                    "title",
                    "idx",
                    "include_in_preview",
                    "youtube",
                    "quiz_id",
                ],
                order_by="idx asc",
                limit_page_length=0,
            )

            # Add frontend aliases
            for lesson in lessons:
                lesson["lesson_number"] = lesson.get("idx") or 1
                lesson["is_preview"] = lesson.get("include_in_preview") or 0

            chapter["lessons"] = lessons
            chapter["lesson_count"] = len(lessons)

        course["chapters"] = chapters

        # Tags — stored as CSV in the `tags` Data field on LMS Course
        raw_tags = frappe.db.get_value("LMS Course", course_name, "tags") or ""
        course["tags"] = [t.strip() for t in raw_tags.split(",") if t.strip()]

        # Review summary
        review_summary = frappe.db.sql(
            """
            SELECT
                COUNT(*) as total_reviews,
                IFNULL(AVG(rating), 0) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM `tabLMS Course Review`
            WHERE course = %(course)s
            """,
            {"course": course_name},
            as_dict=True,
        )
        if review_summary:
            course["review_summary"] = review_summary[0]
        else:
            course["review_summary"] = {
                "total_reviews": 0,
                "average_rating": 0,
                "five_star": 0,
                "four_star": 0,
                "three_star": 0,
                "two_star": 0,
                "one_star": 0,
            }

        # Enrollment info for authenticated users
        if not _is_guest():
            user = _get_current_user()
            enrollment = frappe.db.get_value(
                "LMS Enrollment",
                {"member": user, "course": course_name},
                ["name", "progress", "current_lesson", "enrollment_date", "creation"],
                as_dict=True,
            )
            course["is_enrolled"] = bool(enrollment)
            course["enrollment"] = enrollment
        else:
            course["is_enrolled"] = False
            course["enrollment"] = None

        # Chapter count (now that we've fetched chapters)
        course["chapter_count"] = len(chapters)

        # Default image fallback
        if not course.get("image"):
            course["image"] = None

        return course

    except (frappe.ValidationError, frappe.DoesNotExistError, frappe.PermissionError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_course_detail failed")
        frappe.throw(_("Unable to retrieve course details."))


# ---------------------------------------------------------------------------
# 10. get_course_chapters  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_course_chapters(course_name=None):
    """
    Return a list of chapters for the given course.

    Each chapter includes its lesson list with basic metadata.
    For guest users, lesson content details are hidden for
    non-preview lessons.

    Args:
        course_name (str): The course name/ID.

    Returns:
        list: Chapter dicts with nested lesson lists.
    """
    try:
        if not course_name:
            frappe.throw(_("Course name is required."), frappe.ValidationError)

        course_name = _sanitize(course_name, 200)

        # Verify course exists and is published (for guests)
        course_exists = frappe.db.get_value(
            "LMS Course", course_name, ["name", "published"], as_dict=True
        )
        if not course_exists:
            frappe.throw(
                _("Course {0} not found.").format(course_name),
                frappe.DoesNotExistError,
            )
        if _is_guest() and not cint(course_exists.get("published")):
            frappe.throw(_("This course is not available."), frappe.PermissionError)

        chapters = frappe.get_all(
            "Course Chapter",
            filters={"course": course_name},
            fields=["name", "title", "idx"],
            order_by="idx asc",
            limit_page_length=0,
        )

        for chapter in chapters:
            lessons = frappe.get_all(
                "Course Lesson",
                filters={"chapter": chapter["name"]},
                fields=[
                    "name",
                    "title",
                    "idx",
                    "include_in_preview",
                    "youtube",
                    "quiz_id",
                ],
                order_by="idx asc",
                limit_page_length=0,
            )
            for lesson in lessons:
                lesson["lesson_number"] = lesson.get("idx") or 1
                lesson["is_preview"] = lesson.get("include_in_preview") or 0
            chapter["lessons"] = lessons
            chapter["lesson_count"] = len(lessons)

            # Progress per lesson for authenticated users
            if not _is_guest():
                user = _get_current_user()
                for lesson in lessons:
                    progress = frappe.db.get_value(
                        "LMS Course Progress",
                        {
                            "member": user,
                            "course": course_name,
                            "lesson": lesson["name"],
                        },
                        "status",
                    )
                    lesson["is_complete"] = progress == "Complete"

        return chapters

    except (frappe.ValidationError, frappe.DoesNotExistError, frappe.PermissionError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_course_chapters failed")
        frappe.throw(_("Unable to retrieve course chapters."))


# ---------------------------------------------------------------------------
# 11. get_lesson_details  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_lesson_details(course=None, chapter_number=None, lesson_number=None):
    """
    Return details for a specific lesson identified by course,
    chapter number, and lesson number.

    For guest users, only preview lessons return full content.
    Non-preview lesson content is redacted for guests.

    Args:
        course (str): Course name/ID.
        chapter_number (int): 1-based chapter index.
        lesson_number (int): 1-based lesson index within the chapter.

    Returns:
        dict: Lesson data including content (if permitted).
    """
    try:
        if not course or chapter_number is None or lesson_number is None:
            frappe.throw(
                _("Course, chapter number, and lesson number are required."),
                frappe.ValidationError,
            )

        course = _sanitize(course, 200)
        chapter_number = cint(chapter_number)
        lesson_number = cint(lesson_number)

        if chapter_number < 1 or lesson_number < 1:
            frappe.throw(_("Invalid chapter or lesson number."), frappe.ValidationError)

        # Verify course
        course_data = frappe.db.get_value(
            "LMS Course", course, ["name", "published"], as_dict=True
        )
        if not course_data:
            frappe.throw(
                _("Course {0} not found.").format(course),
                frappe.DoesNotExistError,
            )
        if _is_guest() and not cint(course_data.get("published")):
            frappe.throw(_("This course is not available."), frappe.PermissionError)

        # Find chapter by number/idx
        chapter = frappe.db.get_value(
            "Course Chapter",
            {"course": course, "idx": chapter_number},
            ["name", "title", "idx"],
            as_dict=True,
        )
        if not chapter:
            frappe.throw(
                _("Chapter {0} not found in course {1}.").format(chapter_number, course),
                frappe.DoesNotExistError,
            )

        # Find lesson by number/idx within chapter
        lesson = frappe.db.get_value(
            "Course Lesson",
            {"chapter": chapter["name"], "idx": lesson_number},
            [
                "name",
                "title",
                "idx",
                "body",
                "content",
                "youtube",
                "quiz_id",
                "include_in_preview",
                "creation",
                "modified",
            ],
            as_dict=True,
        )
        if not lesson:
            frappe.throw(
                _("Lesson {0} not found in chapter {1}.").format(lesson_number, chapter_number),
                frappe.DoesNotExistError,
            )

        # Frontend aliases
        lesson["lesson_number"] = lesson.get("idx") or 1
        lesson["is_preview"] = lesson.get("include_in_preview") or 0
        lesson["video_link"] = lesson.get("youtube") or ""

        # Access control: guests can only see preview lesson content
        is_preview = cint(lesson.get("is_preview"))
        has_access = is_preview

        if not _is_guest():
            user = _get_current_user()
            # Check enrollment
            enrolled = frappe.db.exists(
                "LMS Enrollment", {"member": user, "course": course}
            )
            if enrolled:
                has_access = True
            # Instructors and admins always have access
            if _has_role(user, "Course Creator") or _has_role(user, "System Manager"):
                has_access = True

        if not has_access:
            # Strip content for unauthorized access
            lesson["content"] = None
            lesson["video_link"] = None
            lesson["youtube_video_id"] = None
            lesson["quiz_id"] = None
            lesson["requires_enrollment"] = True
        else:
            lesson["requires_enrollment"] = False

        # Navigation: previous and next lessons
        lesson["chapter_title"] = chapter.get("title", "")
        lesson["chapter_number"] = chapter_number
        lesson["course"] = course

        # Previous lesson
        if lesson_number > 1:
            prev = frappe.db.get_value(
                "Course Lesson",
                {"chapter": chapter["name"], "idx": lesson_number - 1},
                ["name", "title"],
                as_dict=True,
            )
            lesson["prev_lesson"] = {
                "chapter_number": chapter_number,
                "lesson_number": lesson_number - 1,
                "title": prev.get("title") if prev else None,
            }
        else:
            # Check previous chapter's last lesson
            prev_chapter = frappe.db.get_value(
                "Course Chapter",
                {"course": course, "idx": chapter_number - 1},
                ["name", "title"],
                as_dict=True,
            )
            if prev_chapter:
                last_lesson_in_prev = frappe.db.sql(
                    """
                    SELECT name, title, idx
                    FROM `tabCourse Lesson`
                    WHERE chapter = %(chapter)s
                    ORDER BY idx DESC
                    LIMIT 1
                    """,
                    {"chapter": prev_chapter["name"]},
                    as_dict=True,
                )
                if last_lesson_in_prev:
                    lesson["prev_lesson"] = {
                        "chapter_number": chapter_number - 1,
                        "lesson_number": last_lesson_in_prev[0]["idx"],
                        "title": last_lesson_in_prev[0]["title"],
                    }
                else:
                    lesson["prev_lesson"] = None
            else:
                lesson["prev_lesson"] = None

        # Next lesson
        next_lesson = frappe.db.get_value(
            "Course Lesson",
            {"chapter": chapter["name"], "idx": lesson_number + 1},
            ["name", "title"],
            as_dict=True,
        )
        if next_lesson:
            lesson["next_lesson"] = {
                "chapter_number": chapter_number,
                "lesson_number": lesson_number + 1,
                "title": next_lesson.get("title"),
            }
        else:
            # Check next chapter's first lesson
            next_chapter = frappe.db.get_value(
                "Course Chapter",
                {"course": course, "idx": chapter_number + 1},
                ["name", "title"],
                as_dict=True,
            )
            if next_chapter:
                first_lesson_in_next = frappe.db.get_value(
                    "Course Lesson",
                    {"chapter": next_chapter["name"], "idx": 1},
                    ["name", "title"],
                    as_dict=True,
                )
                if first_lesson_in_next:
                    lesson["next_lesson"] = {
                        "chapter_number": chapter_number + 1,
                        "lesson_number": 1,
                        "title": first_lesson_in_next.get("title"),
                    }
                else:
                    lesson["next_lesson"] = None
            else:
                lesson["next_lesson"] = None

        # Completion status for authenticated users
        if not _is_guest():
            user = _get_current_user()
            progress_status = frappe.db.get_value(
                "LMS Course Progress",
                {
                    "member": user,
                    "course": course,
                    "lesson": lesson["name"],
                },
                "status",
            )
            lesson["is_complete"] = progress_status == "Complete"
        else:
            lesson["is_complete"] = False

        return lesson

    except (frappe.ValidationError, frappe.DoesNotExistError, frappe.PermissionError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_lesson_details failed")
        frappe.throw(_("Unable to retrieve lesson details."))


# ---------------------------------------------------------------------------
# 12. get_course_reviews  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_course_reviews(course_name=None, limit=10, offset=0):
    """
    Return paginated reviews for a course.

    Args:
        course_name (str): Course name/ID.
        limit (int): Reviews per page (default 10, max 100).
        offset (int): Pagination offset.

    Returns:
        dict: {"reviews": [...], "total": int, "average_rating": float}
    """
    try:
        if not course_name:
            frappe.throw(_("Course name is required."), frappe.ValidationError)

        course_name = _sanitize(course_name, 200)
        limit, offset = _build_pagination(limit, offset)

        # Verify course exists
        if not frappe.db.exists("LMS Course", course_name):
            frappe.throw(
                _("Course {0} not found.").format(course_name),
                frappe.DoesNotExistError,
            )

        total = frappe.db.count(
            "LMS Course Review",
            filters={"course": course_name},
        )

        reviews = frappe.get_all(
            "LMS Course Review",
            filters={"course": course_name},
            fields=[
                "name",
                "owner",
                "rating",
                "review",
                "creation",
                "modified",
            ],
            order_by="creation desc",
            limit_page_length=limit,
            limit_start=offset,
        )

        # Enrich with user info
        for review in reviews:
            reviewer = review.get("owner", "")
            reviewer_data = frappe.db.get_value(
                "User",
                reviewer,
                ["full_name", "user_image"],
                as_dict=True,
            )
            if reviewer_data:
                review["reviewer_name"] = reviewer_data.get("full_name", reviewer)
                review["reviewer_image"] = (
                    reviewer_data.get("user_image") or get_gravatar(reviewer)
                )
            else:
                review["reviewer_name"] = reviewer
                review["reviewer_image"] = get_gravatar(reviewer)

            # Flag own review for authenticated users
            if not _is_guest():
                review["is_own"] = reviewer == _get_current_user()
            else:
                review["is_own"] = False

        # Average
        avg = frappe.db.sql(
            """
            SELECT IFNULL(AVG(rating), 0) as avg_rating
            FROM `tabLMS Course Review`
            WHERE course = %(course)s
            """,
            {"course": course_name},
            as_dict=True,
        )
        average_rating = flt(avg[0]["avg_rating"], 2) if avg else 0

        return {
            "reviews": reviews,
            "total": total,
            "average_rating": average_rating,
            "limit": limit,
            "offset": offset,
        }

    except (frappe.ValidationError, frappe.DoesNotExistError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_course_reviews failed")
        frappe.throw(_("Unable to retrieve course reviews."))


# ---------------------------------------------------------------------------
# 13. save_current_lesson  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def save_current_lesson(course_name=None, lesson_name=None):
    """
    Save the user's current lesson position for resume functionality.

    Updates the 'current_lesson' field on the user's enrollment record
    so the frontend can redirect them to where they left off.

    Args:
        course_name (str): Course name/ID.
        lesson_name (str): Lesson name/ID.

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not course_name or not lesson_name:
            frappe.throw(
                _("Both course_name and lesson_name are required."),
                frappe.ValidationError,
            )

        course_name = _sanitize(course_name, 200)
        lesson_name = _sanitize(lesson_name, 200)

        # Verify enrollment
        enrollment = frappe.db.get_value(
            "LMS Enrollment",
            {"member": user, "course": course_name},
            "name",
        )
        if not enrollment:
            frappe.throw(
                _("You are not enrolled in this course."),
                frappe.ValidationError,
            )

        # Verify lesson exists
        if not frappe.db.exists("Course Lesson", lesson_name):
            frappe.throw(
                _("Lesson {0} not found.").format(lesson_name),
                frappe.DoesNotExistError,
            )

        frappe.db.set_value("LMS Enrollment", enrollment, "current_lesson", lesson_name)
        frappe.db.commit()

        return {"success": True}

    except (frappe.AuthenticationError, frappe.ValidationError, frappe.DoesNotExistError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "save_current_lesson failed")
        frappe.throw(_("Unable to save current lesson position."))


# ---------------------------------------------------------------------------
# 14. mark_lesson_progress  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def mark_lesson_progress(course=None, chapter_number=None, lesson_number=None):
    """
    Mark a lesson as complete for the current user.

    Creates or updates an LMS Course Progress record and recalculates
    the overall enrollment progress percentage.

    Args:
        course (str): Course name/ID.
        chapter_number (int): 1-based chapter index.
        lesson_number (int): 1-based lesson index.

    Returns:
        dict: {"success": True, "progress": float, "is_course_complete": bool}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not course or chapter_number is None or lesson_number is None:
            frappe.throw(
                _("Course, chapter number, and lesson number are required."),
                frappe.ValidationError,
            )

        course = _sanitize(course, 200)
        chapter_number = cint(chapter_number)
        lesson_number = cint(lesson_number)

        # Verify enrollment
        enrollment_name = frappe.db.get_value(
            "LMS Enrollment",
            {"member": user, "course": course},
            "name",
        )
        if not enrollment_name:
            frappe.throw(
                _("You are not enrolled in this course."),
                frappe.ValidationError,
            )

        # Find the chapter
        chapter_name = frappe.db.get_value(
            "Course Chapter",
            {"course": course, "idx": chapter_number},
            "name",
        )
        if not chapter_name:
            frappe.throw(
                _("Chapter {0} not found.").format(chapter_number),
                frappe.DoesNotExistError,
            )

        # Find the lesson
        lesson_name = frappe.db.get_value(
            "Course Lesson",
            {"chapter": chapter_name, "idx": lesson_number},
            "name",
        )
        if not lesson_name:
            frappe.throw(
                _("Lesson {0} not found.").format(lesson_number),
                frappe.DoesNotExistError,
            )

        # Create or update progress record
        existing_progress = frappe.db.get_value(
            "LMS Course Progress",
            {
                "member": user,
                "course": course,
                "lesson": lesson_name,
            },
            "name",
        )

        if existing_progress:
            frappe.db.set_value(
                "LMS Course Progress",
                existing_progress,
                {
                    "status": "Complete",
                    "completion_date": now_datetime(),
                },
            )
        else:
            progress_doc = frappe.get_doc(
                {
                    "doctype": "LMS Course Progress",
                    "member": user,
                    "course": course,
                    "lesson": lesson_name,
                    "chapter": chapter_name,
                    "status": "Complete",
                    "completion_date": now_datetime(),
                }
            )
            progress_doc.insert(ignore_permissions=True)

        # Recalculate overall progress
        total_lessons = frappe.db.count(
            "Course Lesson",
            filters={
                "chapter": ("in", frappe.get_all(
                    "Course Chapter",
                    filters={"course": course},
                    pluck="name",
                ))
            },
        )

        completed_lessons = frappe.db.count(
            "LMS Course Progress",
            filters={
                "member": user,
                "course": course,
                "status": "Complete",
            },
        )

        progress_pct = flt(
            (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0, 2
        )

        frappe.db.set_value("LMS Enrollment", enrollment_name, "progress", progress_pct)

        # Update current lesson
        frappe.db.set_value("LMS Enrollment", enrollment_name, "current_lesson", lesson_name)

        is_course_complete = progress_pct >= 100

        # If course is complete, generate certificate if enabled
        if is_course_complete:
            _maybe_generate_certificate(user, course, enrollment_name)

        frappe.db.commit()

        return {
            "success": True,
            "progress": progress_pct,
            "completed_lessons": completed_lessons,
            "total_lessons": total_lessons,
            "is_course_complete": is_course_complete,
        }

    except (frappe.AuthenticationError, frappe.ValidationError, frappe.DoesNotExistError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "mark_lesson_progress failed")
        frappe.throw(_("Unable to mark lesson progress."))


def _maybe_generate_certificate(user, course, enrollment_name):
    """
    Generate a certificate if certificates are enabled and one does not
    already exist for this user-course combination.
    """
    try:
        enable_certs = cint(
            frappe.db.get_single_value("LMS Settings", "enable_certificates")
        )
        if not enable_certs:
            return

        existing_cert = frappe.db.exists(
            "LMS Certificate",
            {"member": user, "course": course},
        )
        if existing_cert:
            return

        cert = frappe.get_doc(
            {
                "doctype": "LMS Certificate",
                "member": user,
                "course": course,
                "enrollment": enrollment_name,
                "issue_date": nowdate(),
            }
        )
        cert.insert(ignore_permissions=True)
        frappe.db.commit()

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Certificate generation failed")


# ---------------------------------------------------------------------------
# 15. get_enrollment_status  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_enrollment_status(course=None):
    """
    Check if the current user is enrolled in a course.

    Args:
        course (str): Course name/ID.

    Returns:
        dict: {"is_enrolled": bool, "progress": float, "current_lesson": str,
               "enrollment_date": date}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not course:
            frappe.throw(_("Course name is required."), frappe.ValidationError)

        course = _sanitize(course, 200)

        enrollment = frappe.db.get_value(
            "LMS Enrollment",
            {"member": user, "course": course},
            ["name", "progress", "current_lesson", "enrollment_date", "creation"],
            as_dict=True,
        )

        if enrollment:
            return {
                "is_enrolled": True,
                "progress": flt(enrollment.get("progress"), 2),
                "current_lesson": enrollment.get("current_lesson"),
                "enrollment_date": enrollment.get("enrollment_date") or enrollment.get("creation"),
                "enrollment_name": enrollment.get("name"),
            }

        return {
            "is_enrolled": False,
            "progress": 0,
            "current_lesson": None,
            "enrollment_date": None,
            "enrollment_name": None,
        }

    except (frappe.AuthenticationError, frappe.ValidationError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_enrollment_status failed")
        frappe.throw(_("Unable to check enrollment status."))


# ---------------------------------------------------------------------------
# 16. get_enrolled_courses  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_enrolled_courses():
    """
    Return all courses the current user is enrolled in, along with
    progress percentage, current lesson, and course metadata.

    Returns:
        list: Enrollment records enriched with course data.
    """
    try:
        _require_login()
        user = _get_current_user()

        enrollments = frappe.get_all(
            "LMS Enrollment",
            filters={"member": user},
            fields=[
                "name",
                "course",
                "progress",
                "current_lesson",
                "enrollment_date",
                "creation",
            ],
            order_by="creation desc",
            limit_page_length=0,
        )

        result = []
        for enrollment in enrollments:
            course_data = frappe.db.get_value(
                "LMS Course",
                enrollment["course"],
                [
                    "name",
                    "title",
                    "short_introduction",
                    "image",
                    "lessons",
                    "category",
                ],
                as_dict=True,
            )

            if not course_data:
                continue

            # Frontend aliases
            course_data["lesson_count"] = course_data.get("lessons") or 0
            chap_cnt = frappe.db.count(
                "Course Chapter",
                {"course": enrollment["course"]},
            )
            course_data["chapter_count"] = chap_cnt

            # Instructor — from child table
            inst = frappe.db.sql(
                """SELECT instructor FROM `tabCourse Instructor`
                WHERE parent=%s AND parenttype='LMS Course'
                ORDER BY idx ASC LIMIT 1""",
                enrollment["course"],
                as_dict=True,
            )
            instructor_id = inst[0]["instructor"] if inst else None
            course_data["instructor"] = instructor_id

            if instructor_id:
                course_data["instructor_name"] = frappe.db.get_value(
                    "User", instructor_id, "full_name"
                ) or instructor_id

            # Completed lesson count
            completed_lessons = frappe.db.count(
                "LMS Course Progress",
                filters={
                    "member": user,
                    "course": enrollment["course"],
                    "status": "Complete",
                },
            )

            enrollment.update(
                {
                    "course_data": course_data,
                    "completed_lessons": completed_lessons,
                    "is_complete": flt(enrollment.get("progress")) >= 100,
                }
            )
            result.append(enrollment)

        return result

    except frappe.AuthenticationError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_enrolled_courses failed")
        frappe.throw(_("Unable to retrieve enrolled courses."))


# ---------------------------------------------------------------------------
# 17. get_certificates  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_certificates():
    """
    Return all certificates earned by the current user.

    Returns:
        list: Certificate records with associated course data.
    """
    try:
        _require_login()
        user = _get_current_user()

        certificates = frappe.get_all(
            "LMS Certificate",
            filters={"member": user},
            fields=[
                "name",
                "course",
                "issue_date",
                "certificate_id",
                "creation",
            ],
            order_by="creation desc",
            limit_page_length=0,
        )

        for cert in certificates:
            course_data = frappe.db.get_value(
                "LMS Course",
                cert["course"],
                ["title", "image"],
                as_dict=True,
            )
            if course_data:
                cert["course_title"] = course_data.get("title", "")
                cert["course_image"] = course_data.get("image", "")
                # Instructor from child table
                inst = frappe.db.sql(
                    """SELECT instructor FROM `tabCourse Instructor`
                    WHERE parent=%s AND parenttype='LMS Course'
                    ORDER BY idx ASC LIMIT 1""",
                    cert["course"],
                    as_dict=True,
                )
                if inst:
                    cert["instructor_name"] = frappe.db.get_value(
                        "User", inst[0]["instructor"], "full_name"
                    ) or inst[0]["instructor"]
                else:
                    cert["instructor_name"] = None
            else:
                cert["course_title"] = cert["course"]
                cert["course_image"] = None
                cert["instructor_name"] = None

        return certificates

    except frappe.AuthenticationError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_certificates failed")
        frappe.throw(_("Unable to retrieve certificates."))


# ---------------------------------------------------------------------------
# 17b. get_certificate_pdf  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist(methods=["GET"])
def get_certificate_pdf(certificate=None):
    """Render a certificate as a downloadable PDF.

    The certificate must belong to the requesting user (or the requester must
    be a System Manager). Generates a simple branded HTML document and uses
    Frappe's wkhtmltopdf wrapper to convert it to PDF, then streams it as the
    response body.
    """
    try:
        _require_login()
        user = _get_current_user()

        if not certificate:
            frappe.throw(_("certificate is required"), frappe.ValidationError)

        certificate = _sanitize(certificate, 200)

        cert = frappe.db.get_value(
            "LMS Certificate",
            certificate,
            ["name", "member", "course", "certificate_id", "issue_date", "member_name", "course_title"],
            as_dict=True,
        )
        if not cert:
            frappe.throw(_("Certificate not found."), frappe.DoesNotExistError)

        is_admin = "System Manager" in frappe.get_roles(user)
        if cert.member != user and not is_admin:
            frappe.throw(_("You do not have permission to download this certificate."),
                         frappe.PermissionError)

        student_name = cert.member_name or frappe.db.get_value("User", cert.member, "full_name") or cert.member
        course_title = cert.course_title or frappe.db.get_value("LMS Course", cert.course, "title") or cert.course
        issue_date = cert.issue_date or ""

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Certificate — {frappe.utils.escape_html(student_name)}</title>
          <style>
            @page {{ size: A4 landscape; margin: 0; }}
            body {{
              font-family: Georgia, serif;
              margin: 0;
              padding: 60px;
              background: #F5F2EC;
              color: #1A2F23;
            }}
            .frame {{
              border: 4px double #C9A96E;
              padding: 50px 60px;
              text-align: center;
              min-height: 480px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              background: #fff;
            }}
            .academy {{
              font-size: 14px;
              letter-spacing: 6px;
              text-transform: uppercase;
              color: #C9A96E;
              margin-bottom: 8px;
            }}
            .subtitle {{
              font-size: 11px;
              letter-spacing: 4px;
              text-transform: uppercase;
              color: #888;
              margin-bottom: 50px;
            }}
            h1 {{ font-size: 42px; font-weight: 400; font-style: italic; margin: 24px 0; }}
            .student {{ font-size: 28px; font-weight: bold; margin: 12px 0; }}
            .course {{ font-size: 22px; margin: 24px 0; font-style: italic; }}
            .meta {{ margin-top: 50px; font-size: 12px; color: #555; }}
            .id {{ margin-top: 8px; font-size: 10px; font-family: monospace; color: #999; }}
          </style>
        </head>
        <body>
          <div class="frame">
            <p class="academy">Delta SPMU Academy</p>
            <p class="subtitle">Certificate of Completion</p>
            <h1>This is to certify that</h1>
            <p class="student">{frappe.utils.escape_html(student_name)}</p>
            <p>has successfully completed the program</p>
            <p class="course">{frappe.utils.escape_html(course_title)}</p>
            <p class="meta">Issued on {frappe.utils.escape_html(str(issue_date))}</p>
            <p class="id">Certificate ID: {frappe.utils.escape_html(cert.certificate_id or cert.name)}</p>
          </div>
        </body>
        </html>
        """

        from frappe.utils.pdf import get_pdf
        pdf_bytes = get_pdf(html, options={"orientation": "Landscape", "page-size": "A4"})

        frappe.local.response.filename = f"{cert.certificate_id or cert.name}.pdf"
        frappe.local.response.filecontent = pdf_bytes
        frappe.local.response.type = "pdf"
        return

    except (frappe.AuthenticationError, frappe.PermissionError, frappe.ValidationError, frappe.DoesNotExistError):
        raise
    except Exception:
        frappe.log_error(frappe.get_traceback(), "get_certificate_pdf failed")
        frappe.throw(_("Unable to generate certificate PDF."))


# ---------------------------------------------------------------------------
# 18. update_user_profile  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def update_user_profile(data=None):
    """
    Update the current user's profile information.

    Accepts a JSON object or dict with allowed profile fields. Only
    whitelisted fields can be updated to prevent privilege escalation.

    Args:
        data (str|dict): Profile fields to update. Allowed fields:
            first_name, last_name, bio, location, phone, mobile_no,
            birth_date, gender, language, time_zone, user_image.

    Returns:
        dict: {"success": True, "updated_fields": [...]}
    """
    try:
        _require_login()
        user = _get_current_user()

        data = _parse_json_param(data)
        if not data or not isinstance(data, dict):
            frappe.throw(_("Profile data is required."), frappe.ValidationError)

        allowed_fields = {
            "first_name",
            "last_name",
            "bio",
            "location",
            "phone",
            "mobile_no",
            "birth_date",
            "gender",
            "language",
            "time_zone",
            "user_image",
            "interest",
        }

        updates = {}
        for field, value in data.items():
            if field not in allowed_fields:
                continue
            if field == "bio":
                updates[field] = _sanitize(value, 5000)
            elif field == "birth_date":
                try:
                    updates[field] = getdate(value) if value else None
                except Exception:
                    frappe.throw(_("Invalid birth date format."), frappe.ValidationError)
            elif field == "user_image":
                updates[field] = _sanitize(value, 500)
            else:
                updates[field] = _sanitize(value, 200)

        if not updates:
            frappe.throw(_("No valid fields to update."), frappe.ValidationError)

        for field, value in updates.items():
            frappe.db.set_value("User", user, field, value)

        # Rebuild full_name if first/last changed
        if "first_name" in updates or "last_name" in updates:
            first = frappe.db.get_value("User", user, "first_name") or ""
            last = frappe.db.get_value("User", user, "last_name") or ""
            full = f"{first} {last}".strip()
            frappe.db.set_value("User", user, "full_name", full)

        frappe.db.commit()

        return {
            "success": True,
            "updated_fields": list(updates.keys()),
        }

    except (frappe.AuthenticationError, frappe.ValidationError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "update_user_profile failed")
        frappe.throw(_("Unable to update profile."))


# ---------------------------------------------------------------------------
# 19. get_user_bio  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_user_bio():
    """
    Return the current user's bio/about information.

    Returns:
        dict: {"bio": str, "full_name": str, "user_image": str}
    """
    try:
        _require_login()
        user = _get_current_user()

        user_data = frappe.db.get_value(
            "User",
            user,
            ["full_name", "bio", "user_image", "location", "interest"],
            as_dict=True,
        )

        if not user_data:
            frappe.throw(_("User not found."), frappe.DoesNotExistError)

        user_data["user_image"] = user_data.get("user_image") or get_gravatar(user)

        return user_data

    except (frappe.AuthenticationError, frappe.DoesNotExistError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_user_bio failed")
        frappe.throw(_("Unable to retrieve user bio."))


# ---------------------------------------------------------------------------
# 20. update_notification_preferences  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def update_notification_preferences(prefs=None):
    """
    Save the user's notification preference settings.

    Stores preferences in the User Settings doctype as a JSON blob.
    Supports toggles for email, push, in-app notification channels
    and per-category settings (enrollment, completion, review, etc.).

    Args:
        prefs (str|dict): Notification preferences.

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        prefs = _parse_json_param(prefs)
        if not prefs or not isinstance(prefs, dict):
            frappe.throw(
                _("Notification preferences data is required."),
                frappe.ValidationError,
            )

        allowed_keys = {
            "email_notifications",
            "push_notifications",
            "in_app_notifications",
            "enrollment_alerts",
            "completion_alerts",
            "review_alerts",
            "announcement_alerts",
            "marketing_emails",
            "weekly_digest",
            "daily_digest",
        }

        clean_prefs = {}
        for key, value in prefs.items():
            if key in allowed_keys:
                clean_prefs[key] = bool(cint(value))

        if not clean_prefs:
            frappe.throw(
                _("No valid notification preferences provided."),
                frappe.ValidationError,
            )

        # Store in User Settings as JSON
        existing = frappe.db.get_value(
            "User Settings",
            {"user": user},
            "name",
        )

        prefs_json = json.dumps(clean_prefs)

        if existing:
            frappe.db.set_value(
                "User Settings",
                existing,
                "notification_preferences",
                prefs_json,
            )
        else:
            try:
                settings = frappe.get_doc(
                    {
                        "doctype": "User Settings",
                        "user": user,
                        "notification_preferences": prefs_json,
                    }
                )
                settings.insert(ignore_permissions=True)
            except Exception:
                # Fallback: store directly on user meta
                frappe.db.set_value(
                    "User", user, "notification_preferences", prefs_json
                )

        frappe.db.commit()

        return {"success": True, "preferences": clean_prefs}

    except (frappe.AuthenticationError, frappe.ValidationError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "update_notification_preferences failed")
        frappe.throw(_("Unable to update notification preferences."))


# ---------------------------------------------------------------------------
# 21. delete_user_account  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def delete_user_account():
    """
    GDPR-compliant account deletion for the current user.

    This endpoint:
    1. Anonymizes personal data (name, email, bio, phone, etc.)
    2. Removes enrollment records
    3. Anonymizes reviews (keeps ratings, removes reviewer identity)
    4. Removes course progress records
    5. Disables the user account

    The actual user record is retained in anonymized form to maintain
    referential integrity in the database.

    Returns:
        dict: {"success": True, "message": str}
    """
    try:
        _require_login()
        user = _get_current_user()

        # Prevent admin self-deletion
        if _has_role(user, "System Manager"):
            frappe.throw(
                _("System Manager accounts cannot be deleted via this endpoint. "
                  "Please contact support."),
                frappe.ValidationError,
            )

        # Generate anonymized identifier
        anon_id = frappe.generate_hash(length=12)
        anon_email = f"deleted-{anon_id}@anonymized.local"
        anon_name = f"Deleted User {anon_id[:6]}"

        # 1. Anonymize user record
        frappe.db.set_value(
            "User",
            user,
            {
                "first_name": "Deleted",
                "last_name": "User",
                "full_name": anon_name,
                "bio": "",
                "location": "",
                "phone": "",
                "mobile_no": "",
                "birth_date": None,
                "user_image": "",
                "interest": "",
                "enabled": 0,
            },
        )

        # 2. Remove enrollments
        enrollments = frappe.get_all(
            "LMS Enrollment",
            filters={"member": user},
            fields=["name"],
            limit_page_length=0,
        )
        for enr in enrollments:
            frappe.db.delete("LMS Enrollment", enr["name"])

        # 3. Remove course progress
        progress_records = frappe.get_all(
            "LMS Course Progress",
            filters={"member": user},
            fields=["name"],
            limit_page_length=0,
        )
        for pr in progress_records:
            frappe.db.delete("LMS Course Progress", pr["name"])

        # 4. Anonymize reviews (keep the rating data, remove identity)
        reviews = frappe.get_all(
            "LMS Course Review",
            filters={"owner": user},
            fields=["name"],
            limit_page_length=0,
        )
        for rev in reviews:
            frappe.db.set_value(
                "LMS Course Review",
                rev["name"],
                {
                    "owner": anon_email,
                    "review": _("[Review removed — account deleted]"),
                },
            )

        # 5. Remove certificates
        certificates = frappe.get_all(
            "LMS Certificate",
            filters={"member": user},
            fields=["name"],
            limit_page_length=0,
        )
        for cert in certificates:
            frappe.db.delete("LMS Certificate", cert["name"])

        # 6. Remove notification preferences / user settings
        user_settings = frappe.get_all(
            "User Settings",
            filters={"user": user},
            fields=["name"],
            limit_page_length=0,
        )
        for us in user_settings:
            frappe.db.delete("User Settings", us["name"])

        # 7. Log the deletion for audit
        frappe.log_error(
            message=f"User account deleted and anonymized: {user} -> {anon_email}",
            title="GDPR Account Deletion",
        )

        frappe.db.commit()

        # Clear session
        frappe.local.login_manager.logout()

        return {
            "success": True,
            "message": _(
                "Your account has been deleted and personal data anonymized. "
                "You have been logged out."
            ),
        }

    except (frappe.AuthenticationError, frappe.ValidationError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "delete_user_account failed")
        frappe.throw(_("Unable to delete account. Please contact support."))


# ---------------------------------------------------------------------------
# 22. get_transaction_history  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_transaction_history(limit=20, offset=0):
    """
    Return the payment/transaction history for the current user.

    Queries payment-related doctypes for records associated with the
    current user's email.

    Args:
        limit (int): Results per page (default 20, max 100).
        offset (int): Pagination offset.

    Returns:
        dict: {"transactions": [...], "total": int}
    """
    try:
        _require_login()
        user = _get_current_user()
        limit, offset = _build_pagination(limit, offset)

        # Try LMS Payment doctype first
        total = 0
        transactions = []

        try:
            total = frappe.db.count(
                "LMS Payment",
                filters={"member": user},
            )

            transactions = frappe.get_all(
                "LMS Payment",
                filters={"member": user},
                fields=[
                    "name",
                    "course",
                    "amount",
                    "currency",
                    "payment_gateway",
                    "transaction_id",
                    "status",
                    "creation",
                    "modified",
                ],
                order_by="creation desc",
                limit_page_length=limit,
                limit_start=offset,
            )
        except Exception:
            # Fallback: try Payment Entry or custom payment doctype
            try:
                total = frappe.db.count(
                    "Payment Entry",
                    filters={"party": user, "party_type": "Customer"},
                )
                transactions = frappe.get_all(
                    "Payment Entry",
                    filters={"party": user, "party_type": "Customer"},
                    fields=[
                        "name",
                        "paid_amount as amount",
                        "paid_to_account_currency as currency",
                        "reference_no as transaction_id",
                        "status",
                        "creation",
                        "modified",
                    ],
                    order_by="creation desc",
                    limit_page_length=limit,
                    limit_start=offset,
                )
            except Exception:
                pass

        # Enrich with course title
        for txn in transactions:
            if txn.get("course"):
                txn["course_title"] = frappe.db.get_value(
                    "LMS Course", txn["course"], "title"
                ) or txn["course"]

        return {
            "transactions": transactions,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except frappe.AuthenticationError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_transaction_history failed")
        frappe.throw(_("Unable to retrieve transaction history."))


# ---------------------------------------------------------------------------
# 23. submit_review  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def submit_review(course=None, rating=None, review=None):
    """
    Submit a course review.

    Users can only submit one review per course. If a review already
    exists, it is updated. The user must be enrolled in the course.

    Args:
        course (str): Course name/ID.
        rating (int): Rating from 1 to 5.
        review (str): Review text.

    Returns:
        dict: {"success": True, "review_name": str}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not course or rating is None:
            frappe.throw(
                _("Course and rating are required."),
                frappe.ValidationError,
            )

        course = _sanitize(course, 200)
        rating = _validate_rating(rating)
        review_text = _sanitize(review, 5000) if review else ""

        # Verify course exists
        if not frappe.db.exists("LMS Course", course):
            frappe.throw(
                _("Course {0} not found.").format(course),
                frappe.DoesNotExistError,
            )

        # Verify enrollment
        enrolled = frappe.db.exists(
            "LMS Enrollment", {"member": user, "course": course}
        )
        if not enrolled:
            frappe.throw(
                _("You must be enrolled in this course to submit a review."),
                frappe.ValidationError,
            )

        # Check for existing review
        existing_review = frappe.db.get_value(
            "LMS Course Review",
            {"course": course, "owner": user},
            "name",
        )

        if existing_review:
            # Update existing review
            frappe.db.set_value(
                "LMS Course Review",
                existing_review,
                {
                    "rating": rating,
                    "review": review_text,
                    "modified": now_datetime(),
                },
            )
            review_name = existing_review
        else:
            # Create new review
            review_doc = frappe.get_doc(
                {
                    "doctype": "LMS Course Review",
                    "course": course,
                    "rating": rating,
                    "review": review_text,
                }
            )
            review_doc.insert(ignore_permissions=True)
            review_name = review_doc.name

        # Update course average rating
        _update_course_avg_rating(course)

        frappe.db.commit()

        return {
            "success": True,
            "review_name": review_name,
            "is_update": bool(existing_review),
        }

    except (frappe.AuthenticationError, frappe.ValidationError, frappe.DoesNotExistError):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "submit_review failed")
        frappe.throw(_("Unable to submit review."))


def _update_course_avg_rating(course):
    """Recalculate and update the average rating for a course."""
    try:
        result = frappe.db.sql(
            """
            SELECT
                IFNULL(AVG(rating), 0) as avg_rating,
                COUNT(*) as total_reviews
            FROM `tabLMS Course Review`
            WHERE course = %(course)s
            """,
            {"course": course},
            as_dict=True,
        )
        if result:
            frappe.db.set_value(
                "LMS Course",
                course,
                {
                    "rating": flt(result[0]["avg_rating"], 2),
                },
            )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Update avg rating failed")


# ---------------------------------------------------------------------------
# 24. delete_review  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def delete_review(review_name=None):
    """
    Delete a course review.

    Users can only delete their own reviews. Admins and LMS Managers
    can delete any review.

    Args:
        review_name (str): The name/ID of the review to delete.

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not review_name:
            frappe.throw(_("Review name is required."), frappe.ValidationError)

        review_name = _sanitize(review_name, 200)

        # Verify review exists and get its data
        review_data = frappe.db.get_value(
            "LMS Course Review",
            review_name,
            ["name", "owner", "course"],
            as_dict=True,
        )

        if not review_data:
            frappe.throw(
                _("Review {0} not found.").format(review_name),
                frappe.DoesNotExistError,
            )

        # Permission check: owner or admin
        is_owner = review_data["owner"] == user
        is_admin = _has_role(user, "System Manager") or _has_role(user, "LMS Manager")

        if not is_owner and not is_admin:
            frappe.throw(
                _("You do not have permission to delete this review."),
                frappe.PermissionError,
            )

        course = review_data["course"]

        # Delete the review
        frappe.db.delete("LMS Course Review", review_name)

        # Recalculate average rating
        _update_course_avg_rating(course)

        frappe.db.commit()

        return {"success": True}

    except (
        frappe.AuthenticationError,
        frappe.ValidationError,
        frappe.DoesNotExistError,
        frappe.PermissionError,
    ):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "delete_review failed")
        frappe.throw(_("Unable to delete review."))


# ---------------------------------------------------------------------------
# 25. delete_course  (admin, authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def delete_course(course=None):
    """
    Soft-delete a course (admin only).

    Sets the course as unpublished and marks it as archived rather than
    physically deleting it, preserving enrollment and progress data for
    audit purposes.

    Args:
        course (str): Course name/ID.

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not course:
            frappe.throw(_("Course name is required."), frappe.ValidationError)

        course = _sanitize(course, 200)

        # Permission check: only admins and course creators
        is_admin = _has_role(user, "System Manager") or _has_role(user, "LMS Manager")
        # Check if user is one of the course instructors (child table)
        course_instructor = frappe.db.sql(
            """SELECT instructor FROM `tabCourse Instructor`
            WHERE parent=%s AND parenttype='LMS Course' AND instructor=%s LIMIT 1""",
            (course, user),
            as_dict=True,
        )
        is_course_instructor = bool(course_instructor)

        if not is_admin and not is_course_instructor:
            frappe.throw(
                _("You do not have permission to delete this course."),
                frappe.PermissionError,
            )

        # Verify course exists
        if not frappe.db.exists("LMS Course", course):
            frappe.throw(
                _("Course {0} not found.").format(course),
                frappe.DoesNotExistError,
            )

        # Soft delete: unpublish and mark archived
        frappe.db.set_value(
            "LMS Course",
            course,
            {
                "published": 0,
                "status": "Archived",
                "archived_on": now_datetime(),
                "archived_by": user,
            },
        )

        frappe.db.commit()

        frappe.log_error(
            message=f"Course soft-deleted: {course} by {user}",
            title="Course Deletion Audit",
        )

        return {"success": True, "message": _("Course has been archived.")}

    except (
        frappe.AuthenticationError,
        frappe.ValidationError,
        frappe.DoesNotExistError,
        frappe.PermissionError,
    ):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "delete_course failed")
        frappe.throw(_("Unable to delete course."))


# ---------------------------------------------------------------------------
# 26. delete_lesson  (admin, authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def delete_lesson(lesson=None, chapter=None):
    """
    Delete a lesson from a chapter (admin/instructor only).

    Physically removes the lesson record and reindexes remaining
    lessons within the chapter to maintain sequential ordering.

    Args:
        lesson (str): Lesson name/ID.
        chapter (str): Parent chapter name/ID (for verification).

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not lesson:
            frappe.throw(_("Lesson name is required."), frappe.ValidationError)

        lesson = _sanitize(lesson, 200)
        chapter = _sanitize(chapter, 200) if chapter else None

        # Verify lesson exists
        lesson_data = frappe.db.get_value(
            "Course Lesson",
            lesson,
            ["name", "chapter", "idx"],
            as_dict=True,
        )
        if not lesson_data:
            frappe.throw(
                _("Lesson {0} not found.").format(lesson),
                frappe.DoesNotExistError,
            )

        # Verify chapter matches if provided
        if chapter and lesson_data["chapter"] != chapter:
            frappe.throw(
                _("Lesson does not belong to the specified chapter."),
                frappe.ValidationError,
            )

        actual_chapter = lesson_data["chapter"]

        # Get the course for permission check
        course_name = frappe.db.get_value("Course Chapter", actual_chapter, "course")
        if not course_name:
            frappe.throw(_("Associated course not found."), frappe.DoesNotExistError)

        # Permission check
        is_admin = _has_role(user, "System Manager") or _has_role(user, "LMS Manager")
        is_course_instructor = bool(frappe.db.sql(
            """SELECT 1 FROM `tabCourse Instructor`
            WHERE parent=%s AND parenttype='LMS Course' AND instructor=%s LIMIT 1""",
            (course_name, user),
        ))

        if not is_admin and not is_course_instructor:
            frappe.throw(
                _("You do not have permission to delete this lesson."),
                frappe.PermissionError,
            )

        # Remove any progress records for this lesson
        progress_records = frappe.get_all(
            "LMS Course Progress",
            filters={"lesson": lesson},
            fields=["name"],
            limit_page_length=0,
        )
        for pr in progress_records:
            frappe.db.delete("LMS Course Progress", pr["name"])

        # Delete the lesson
        frappe.db.delete("Course Lesson", lesson)

        # Reindex remaining lessons in the chapter
        remaining_lessons = frappe.get_all(
            "Course Lesson",
            filters={"chapter": actual_chapter},
            fields=["name"],
            order_by="idx asc",
            limit_page_length=0,
        )
        for new_idx, remaining in enumerate(remaining_lessons, start=1):
            frappe.db.set_value("Course Lesson", remaining["name"], "idx", new_idx)

        # Update course lesson count
        total_lessons = 0
        chapters = frappe.get_all(
            "Course Chapter",
            filters={"course": course_name},
            fields=["name"],
            limit_page_length=0,
        )
        for ch in chapters:
            total_lessons += frappe.db.count(
                "Course Lesson", filters={"chapter": ch["name"]}
            )

        frappe.db.set_value("LMS Course", course_name, "lessons", total_lessons)

        frappe.db.commit()

        return {"success": True}

    except (
        frappe.AuthenticationError,
        frappe.ValidationError,
        frappe.DoesNotExistError,
        frappe.PermissionError,
    ):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "delete_lesson failed")
        frappe.throw(_("Unable to delete lesson."))


# ---------------------------------------------------------------------------
# 27. get_notifications  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_notifications(limit=20, offset=0):
    """
    Return paginated notifications for the current user.

    Fetches from the Notification Log doctype, filtered to the
    current user as the recipient.

    Args:
        limit (int): Results per page (default 20, max 100).
        offset (int): Pagination offset.

    Returns:
        dict: {"notifications": [...], "total": int, "unread_count": int}
    """
    try:
        _require_login()
        user = _get_current_user()
        limit, offset = _build_pagination(limit, offset)

        total = frappe.db.count(
            "Notification Log",
            filters={"for_user": user},
        )

        unread_count = frappe.db.count(
            "Notification Log",
            filters={"for_user": user, "read": 0},
        )

        notifications = frappe.get_all(
            "Notification Log",
            filters={"for_user": user},
            fields=[
                "name",
                "subject",
                "type",
                "document_type",
                "document_name",
                "from_user",
                "email_content",
                "read",
                "creation",
            ],
            order_by="creation desc",
            limit_page_length=limit,
            limit_start=offset,
        )

        # Enrich with sender info
        for notif in notifications:
            if notif.get("from_user"):
                sender_name = frappe.db.get_value(
                    "User", notif["from_user"], "full_name"
                )
                notif["from_user_name"] = sender_name or notif["from_user"]
                notif["from_user_image"] = _get_user_avatar(notif["from_user"])
            notif["read"] = bool(cint(notif.get("read")))

        return {
            "notifications": notifications,
            "total": total,
            "unread_count": unread_count,
            "limit": limit,
            "offset": offset,
        }

    except frappe.AuthenticationError:
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_notifications failed")
        frappe.throw(_("Unable to retrieve notifications."))


# ---------------------------------------------------------------------------
# 28. mark_notification_read  (authenticated)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def mark_notification_read(notification=None):
    """
    Mark a specific notification as read.

    Also supports marking all notifications as read by passing
    notification="all".

    Args:
        notification (str): Notification Log name, or "all" to mark
            all notifications as read.

    Returns:
        dict: {"success": True}
    """
    try:
        _require_login()
        user = _get_current_user()

        if not notification:
            frappe.throw(
                _("Notification name is required."),
                frappe.ValidationError,
            )

        notification = _sanitize(notification, 200)

        if notification.lower() == "all":
            # Mark all unread notifications as read
            frappe.db.sql(
                """
                UPDATE `tabNotification Log`
                SET `read` = 1, `modified` = %(now)s
                WHERE `for_user` = %(user)s AND `read` = 0
                """,
                {"user": user, "now": now_datetime()},
            )
        else:
            # Verify notification exists and belongs to user
            notif_data = frappe.db.get_value(
                "Notification Log",
                notification,
                ["name", "for_user"],
                as_dict=True,
            )

            if not notif_data:
                frappe.throw(
                    _("Notification {0} not found.").format(notification),
                    frappe.DoesNotExistError,
                )

            if notif_data["for_user"] != user:
                frappe.throw(
                    _("You do not have permission to modify this notification."),
                    frappe.PermissionError,
                )

            frappe.db.set_value("Notification Log", notification, "read", 1)

        frappe.db.commit()

        return {"success": True}

    except (
        frappe.AuthenticationError,
        frappe.ValidationError,
        frappe.DoesNotExistError,
        frappe.PermissionError,
    ):
        raise
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "mark_notification_read failed")
        frappe.throw(_("Unable to mark notification as read."))


# ---------------------------------------------------------------------------
# Admin: change own password (authenticated, POST)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def admin_change_password(new_password=None, confirm_password=None):
    """Change the currently-logged-in user's password.

    Requires:
        - user is logged in
        - new_password matches confirm_password
        - new_password is at least 10 characters
    """
    user = _get_current_user()
    if not user or user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)

    new_password = (new_password or "").strip()
    confirm_password = (confirm_password or "").strip()

    if not new_password or not confirm_password:
        frappe.throw(_("Both password fields are required."), frappe.MandatoryError)

    if new_password != confirm_password:
        frappe.throw(_("Passwords do not match."), frappe.ValidationError)

    if len(new_password) < 10:
        frappe.throw(_("Password must be at least 10 characters."), frappe.ValidationError)

    # Use Frappe's built-in password setter (handles hashing + history)
    from frappe.utils.password import update_password as frappe_update_password
    frappe_update_password(user, new_password)
    frappe.db.commit()

    return {"success": True}


# ---------------------------------------------------------------------------
# Contact form submission (guest, POST)
# ---------------------------------------------------------------------------
CONTACT_RECIPIENT = "info@deltaspmu.com"
CONTACT_SUBJECTS = {
    "general": "General Inquiry",
    "courses": "Course Information",
    "technical": "Technical Support",
    "payment": "Payment Issue",
}


@frappe.whitelist(allow_guest=True)
def submit_contact_form(name=None, email=None, subject=None, message=None):
    """Receive a contact form submission from the marketing/student site and
    deliver it to the configured operations inbox.

    Rate-limited: 5 submissions per hour per remote IP (Redis-backed via the
    lms.lms.security module). Returns ``{"success": True}`` on delivery.
    """
    name = _sanitize(name, max_length=120)
    email = _sanitize(email, max_length=180)
    subject_key = _sanitize(subject, max_length=40)
    message = _sanitize(message, max_length=5000)

    if not (name and email and subject_key and message):
        frappe.throw(_("All fields are required."), frappe.MandatoryError)

    # Basic email validation
    import re
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        frappe.throw(_("Please provide a valid email address."), frappe.ValidationError)

    subject_label = CONTACT_SUBJECTS.get(subject_key, "Website Contact Form")

    # Jinja's "nl2br" filter isn't loaded by Frappe's environment, so do it in Python.
    from markupsafe import escape, Markup
    message_html = Markup("<br>".join(str(escape(line)) for line in message.split("\n")))

    # Rate limit: 5/hour per IP
    try:
        from lms.lms.security import check_rate_limit

        ip = (frappe.local.request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
              or frappe.local.request_ip
              or "unknown")
        check_rate_limit(
            action="contact_form",
            identifier=ip,
            max_attempts=5,
            window_seconds=3600,
        )
    except ImportError:
        pass  # security module missing — proceed without rate limit

    # Deliver to ops inbox
    body = frappe.render_template(
        "<p><strong>Name:</strong> {{ name }}</p>"
        "<p><strong>Email:</strong> {{ email }}</p>"
        "<p><strong>Subject:</strong> {{ subject_label }}</p>"
        "<p><strong>Message:</strong></p>"
        "<blockquote style='border-left:3px solid #C9A96E;padding-left:12px;color:#1A2F23'>"
        "{{ message_html }}"
        "</blockquote>",
        {
            "name": name,
            "email": email,
            "subject_label": subject_label,
            "message_html": message_html,
        },
    )

    try:
        frappe.sendmail(
            recipients=[CONTACT_RECIPIENT],
            sender=CONTACT_RECIPIENT,
            reply_to=email,
            subject=f"[Delta SPMU] {subject_label} — {name}",
            message=body,
            now=True,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "submit_contact_form failed")
        frappe.throw(_("Unable to deliver your message. Please try again later."))

    return {"success": True}


# ---------------------------------------------------------------------------
# 31. custom_sign_up  (guest)
# ---------------------------------------------------------------------------
# Replacement for frappe.core.doctype.user.user.sign_up that:
#   - accepts (and stores) the password the user typed in the form
#   - sends OUR branded verification email
#   - generates a verification link pointing at the SPA verify page
#     (learn.deltaspmu.com/verify?key=...) instead of the Frappe Desk
# Returns the same [code, message] tuple as Frappe's sign_up so the existing
# frontend doesn't need a contract change beyond the URL.

def _signup_portal_url():
    """Where the verify/reset links in outgoing emails should land.

    Reads from site_config first so we can swap targets during staging
    (e.g. point at delta-student-delta.vercel.app while DNS verification
    is pending) without redeploying. Falls back to the production
    domain when not configured.
    """
    return frappe.conf.get("signup_portal_url") or "https://learn.deltaspmu.com"

@frappe.whitelist(allow_guest=True, methods=["POST"])
def custom_sign_up(email=None, full_name=None, password=None, redirect_to=None):
    """Create a disabled user, set their password, and email a verification link.

    Returns:
        [code, message]
          code=0  → email already registered
          code=1  → account created, verification email queued
    """
    from frappe.utils import validate_email_address, escape_html
    from frappe.utils.password import update_password as set_password
    from lms.lms.email_templates import email_verification

    email = (email or "").strip().lower()
    full_name = (full_name or "").strip()
    password = (password or "").strip()

    if not email or not full_name or not password:
        frappe.throw(_("Email, full name, and password are required."), frappe.MandatoryError)
    if not validate_email_address(email):
        frappe.throw(_("Please enter a valid email address."), frappe.ValidationError)
    if len(password) < 8:
        frappe.throw(_("Password must be at least 8 characters."), frappe.ValidationError)

    # Already registered?
    if frappe.db.exists("User", email):
        existing_enabled = frappe.db.get_value("User", email, "enabled")
        if existing_enabled:
            return [0, _("Already Registered")]
        # User exists but isn't verified yet — re-send the verification email
        user = frappe.get_doc("User", email)
    else:
        # Split full name into first/last for Frappe
        parts = full_name.split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        user = frappe.get_doc({
            "doctype": "User",
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "enabled": 0,                # disabled until they verify
            "user_type": "Website User",
            "send_welcome_email": 0,     # we send our own branded email
        })
        user.flags.ignore_permissions = True
        user.flags.no_welcome_mail = True
        user.insert(ignore_permissions=True)

        # Set the password they typed in the form
        set_password(email, password)

    # Generate a verification key (uses Frappe's reset_password_key column —
    # repurposed for first-time verification since we treat them the same
    # mechanism: prove control of the email, then activate).
    key = frappe.generate_hash(length=32)
    frappe.db.set_value("User", email, "reset_password_key", key)
    frappe.db.commit()

    verify_url = f"{_signup_portal_url()}/verify?key={key}"

    try:
        frappe.sendmail(
            recipients=[email],
            subject=_("Verify your email — Delta SPMU Academy"),
            message=email_verification(student_name=full_name, verify_url=verify_url),
            now=True,
            retry=3,
        )
    except Exception:
        # Don't leak SMTP errors to the user — log + still return success
        # so the Register page progresses; they can use "Resend" if it
        # turns out the email never arrived.
        frappe.log_error(frappe.get_traceback(), "custom_sign_up sendmail failed")

    return [1, _("Please check your email for verification.")]


# ---------------------------------------------------------------------------
# 32. custom_verify_email  (guest)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True, methods=["GET"])
def custom_verify_email(key=None):
    """Activate a previously-created account using the key emailed to the user.

    On success: enables the user, clears the reset_password_key, sends a
    welcome email, and returns {"verified": True, "email": ...}.
    """
    from lms.lms.email_templates import welcome

    if not key:
        frappe.throw(_("Verification key is required."), frappe.ValidationError)

    key = (key or "").strip()
    email = frappe.db.get_value("User", {"reset_password_key": key}, "name")
    if not email:
        frappe.throw(
            _("This verification link is invalid or has already been used."),
            frappe.ValidationError,
        )

    user = frappe.get_doc("User", email)
    user.enabled = 1
    user.reset_password_key = ""
    user.flags.ignore_permissions = True
    user.flags.no_welcome_mail = True
    user.save(ignore_permissions=True)
    frappe.db.commit()

    # Welcome email — fire-and-forget; failure shouldn't block verification.
    try:
        frappe.sendmail(
            recipients=[email],
            subject=_("Welcome to Delta SPMU Academy"),
            message=welcome(student_name=user.full_name or email),
            now=True,
            retry=3,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "custom_verify_email welcome failed")

    return {"verified": True, "email": email}


# ---------------------------------------------------------------------------
# 33. custom_reset_password  (guest)
# ---------------------------------------------------------------------------
# Replacement for frappe.core.doctype.user.user.reset_password that:
#   - sends OUR branded password-reset email
#   - generates a link pointing at the SPA reset-password page
#     (learn.deltaspmu.com/reset-password?key=...) instead of Frappe Desk
# Always returns a generic success to avoid leaking which emails are
# registered (enumeration prevention) — matches the frontend's existing
# "we always show success" behavior.

@frappe.whitelist(allow_guest=True, methods=["POST"])
def custom_reset_password(user=None, email=None):
    """Email a password-reset link to the user (if they exist).

    Accepts either `user` or `email` for compatibility with stock Frappe
    callers. Always returns success — does not reveal whether the email
    is registered.
    """
    from lms.lms.email_templates import password_reset

    target = (email or user or "").strip().lower()
    if not target:
        # Don't 400 — still pretend success to avoid distinguishing
        # "valid request with no email" from "valid request with bad email".
        return {"sent": True}

    if not frappe.db.exists("User", target):
        return {"sent": True}

    # Don't send reset links to disabled-but-not-yet-verified accounts —
    # they should re-trigger signup instead. This also blocks reset spam
    # against half-created accounts.
    enabled = frappe.db.get_value("User", target, "enabled")
    if not enabled:
        return {"sent": True}

    key = frappe.generate_hash(length=32)
    frappe.db.set_value("User", target, "reset_password_key", key)
    frappe.db.commit()

    student_name = frappe.db.get_value("User", target, "full_name") or target
    reset_url = f"{_signup_portal_url()}/reset-password?key={key}"

    try:
        frappe.sendmail(
            recipients=[target],
            subject=_("Reset your password — Delta SPMU Academy"),
            message=password_reset(student_name=student_name, reset_url=reset_url),
            now=True,
            retry=3,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "custom_reset_password sendmail failed")

    return {"sent": True}


# ---------------------------------------------------------------------------
# 34. admin_get_enrollments  (admin only)
# ---------------------------------------------------------------------------
# Joins LMS Enrollment with LMS Course to return course_title alongside the
# enrollment row, plus formats progress as a percentage and provides a
# derived status (Active / Completed / Expired) since LMS Enrollment has no
# native status column on this fork.
#
# Used by admin Dashboard (recent enrollments widget) and Enrollments page.

@frappe.whitelist(methods=["GET"])
def admin_get_enrollments(limit=50, offset=0, search=None, course=None):
    """Return enrollment rows enriched with course_title + derived status."""
    user = frappe.session.user
    if "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("Only administrators can list enrollments."), frappe.PermissionError)

    try:
        limit = int(limit)
        offset = int(offset)
    except (TypeError, ValueError):
        limit, offset = 50, 0

    where = ["1=1"]
    params = {}

    if course:
        where.append("e.course = %(course)s")
        params["course"] = _sanitize(course, 200)

    if search:
        search = f"%{_sanitize(search, 200)}%"
        where.append("(e.member_name LIKE %(search)s OR e.member LIKE %(search)s OR c.title LIKE %(search)s)")
        params["search"] = search

    params["limit"] = limit
    params["offset"] = offset

    where_clause = " AND ".join(where)

    rows = frappe.db.sql(
        f"""
        SELECT
            e.name,
            e.member,
            e.member_name,
            e.course,
            c.title AS course_title,
            e.progress,
            e.current_lesson,
            e.enrollment_date,
            e.creation,
            ca.access_end,
            ca.is_active
        FROM `tabLMS Enrollment` e
        LEFT JOIN `tabLMS Course` c ON c.name = e.course
        LEFT JOIN `tabCourse Access` ca ON ca.user = e.member AND ca.course = e.course
        WHERE {where_clause}
        ORDER BY e.creation DESC
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        params,
        as_dict=True,
    )

    # Derive a friendly status string the frontend can render directly
    from datetime import date
    today = date.today()
    for r in rows:
        progress = float(r.get("progress") or 0)
        access_end = r.get("access_end")
        is_active = r.get("is_active")
        if progress >= 100:
            r["status"] = "Completed"
        elif access_end and access_end < today:
            r["status"] = "Expired"
        elif is_active == 0:
            r["status"] = "Inactive"
        else:
            r["status"] = "Active"
        # Stringify dates for JSON
        for fld in ("enrollment_date", "creation", "access_end"):
            if r.get(fld):
                r[fld] = str(r[fld])

    # Total count for pagination
    total_row = frappe.db.sql(
        f"""
        SELECT COUNT(*) AS total
        FROM `tabLMS Enrollment` e
        LEFT JOIN `tabLMS Course` c ON c.name = e.course
        WHERE {where_clause}
        """,
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
        as_dict=True,
    )

    return {
        "data": rows,
        "total": int(total_row[0].total) if total_row else len(rows),
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# 35. admin_get_dashboard_summary  (admin only)
# ---------------------------------------------------------------------------
# Single-shot dashboard stats — replaces N+1 client-side aggregation.
# Returns counts + most-recent rows for users / courses / enrollments / payments.

@frappe.whitelist(methods=["GET"])
def admin_get_dashboard_summary():
    """Return one consolidated dashboard payload."""
    user = frappe.session.user
    if "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("Only administrators can view the dashboard."), frappe.PermissionError)

    # Counts
    users_total = frappe.db.count("User", {"enabled": 1, "user_type": "Website User"})
    courses_total = frappe.db.count("LMS Course", {"published": 1})
    enrollments_total = frappe.db.count("LMS Enrollment")

    # Revenue (this month + lifetime)
    revenue_lifetime = frappe.db.sql(
        """SELECT COALESCE(SUM(final_amount), 0) AS t
           FROM `tabPayment Transaction`
           WHERE status = 'Completed' AND currency = 'ETB'""",
        as_dict=True,
    )[0].t

    revenue_month = frappe.db.sql(
        """SELECT COALESCE(SUM(final_amount), 0) AS t
           FROM `tabPayment Transaction`
           WHERE status = 'Completed' AND currency = 'ETB'
             AND completed_at >= DATE_FORMAT(NOW(), '%%Y-%%m-01')""",
        as_dict=True,
    )[0].t

    # Recent enrollments (joined with course title)
    recent_enrollments = frappe.db.sql(
        """SELECT e.name, e.member, e.member_name, e.course, c.title AS course_title,
                  e.progress, e.creation
           FROM `tabLMS Enrollment` e
           LEFT JOIN `tabLMS Course` c ON c.name = e.course
           ORDER BY e.creation DESC
           LIMIT 5""",
        as_dict=True,
    )
    for r in recent_enrollments:
        r["creation"] = str(r["creation"]) if r.get("creation") else None

    # Recent payments
    recent_payments = frappe.db.get_all(
        "Payment Transaction",
        fields=["name", "user", "course", "course_title", "final_amount", "currency",
                "payment_method", "status", "creation"],
        order_by="creation desc",
        page_length=5,
    )
    for p in recent_payments:
        if p.get("creation"):
            p["creation"] = str(p["creation"])

    return {
        "counts": {
            "users": users_total,
            "courses": courses_total,
            "enrollments": enrollments_total,
        },
        "revenue": {
            "lifetime_etb": float(revenue_lifetime or 0),
            "this_month_etb": float(revenue_month or 0),
        },
        "recent_enrollments": recent_enrollments,
        "recent_payments": recent_payments,
    }
