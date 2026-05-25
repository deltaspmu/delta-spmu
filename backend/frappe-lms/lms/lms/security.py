"""
Security utilities for Delta SPMU Academy LMS.

Provides Redis-based rate limiting, user banning, and admin user-management
endpoints.
"""

import frappe
from frappe.utils import now, cint

# Redis cache key for banned email list
BANNED_EMAILS_KEY = "deltaspmu_banned_emails"


def is_email_banned(email):
    """Check if an email is in the banned list."""
    if not email:
        return False
    banned = frappe.cache().get_value(BANNED_EMAILS_KEY) or []
    return email.lower() in [e.lower() for e in banned]


# ---------------------------------------------------------------------------
# Internal — rate limiting
# ---------------------------------------------------------------------------


def check_rate_limit(action, identifier, max_attempts=5, window_seconds=3600):
    """Check and increment a Redis-backed rate-limit counter atomically.

    Not whitelisted — intended for internal server-side use only.

    Implementation: uses Redis ``INCR`` to atomically read-and-increment in a
    single round-trip. The first hit also sets the TTL so the counter expires
    after ``window_seconds``. This closes the read-then-write race where two
    concurrent calls could both observe ``current < max_attempts`` and both
    write ``current + 1``.

    Args:
        action (str): Action label, e.g. ``"sign_up"`` or ``"reset_password"``.
        identifier (str): Unique key, typically an email or IP address.
        max_attempts (int): Maximum allowed attempts within the window.
        window_seconds (int): Rolling window size in seconds.

    Returns:
        True if the request is within limits.

    Raises:
        frappe.TooManyRequestsError: If the limit has been exceeded.
    """
    cache = frappe.cache()
    cache_key = f"rate_limit:{action}:{identifier}"

    # Try the atomic Redis path first (Frappe's cache wraps redis-py).
    try:
        redis_conn = getattr(cache, "redis", None) or getattr(cache, "_conn", None)
        if redis_conn is not None:
            # Frappe namespaces every key with the site name; replicate the
            # transformation so INCR hits the same physical key get_value reads.
            key_for_redis = cache.make_key(cache_key) if hasattr(cache, "make_key") else cache_key
            current = redis_conn.incr(key_for_redis)
            if current == 1:
                # First hit in this window — set the TTL.
                redis_conn.expire(key_for_redis, window_seconds)
            if current > max_attempts:
                frappe.throw(
                    f"Too many attempts for '{action}'. "
                    f"Please wait before trying again (limit: {max_attempts}/{window_seconds}s).",
                    frappe.TooManyRequestsError,
                )
            return True
    except frappe.TooManyRequestsError:
        raise
    except Exception:
        # Fall through to the legacy non-atomic path (still better than crashing)
        pass

    # Legacy fallback (non-atomic) — used only if the Redis connection isn't
    # reachable or the API surface changed. Race is rare in practice because
    # rate-limit identifiers are per-user / per-IP.
    current = cint(cache.get_value(cache_key) or 0)
    if current >= max_attempts:
        frappe.throw(
            f"Too many attempts for '{action}'. "
            f"Please wait before trying again (limit: {max_attempts}/{window_seconds}s).",
            frappe.TooManyRequestsError,
        )
    cache.set_value(cache_key, current + 1, expires_in_sec=window_seconds)
    return True


def _get_client_ip():
    """Return the client's IP address from the current request.

    Falls back to ``127.0.0.1`` when running outside an HTTP context
    (e.g. tests, background jobs).

    Returns:
        str: Client IP address.
    """
    if frappe.request:
        return (
            frappe.request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or frappe.request.remote_addr
            or "127.0.0.1"
        )
    return "127.0.0.1"


# ---------------------------------------------------------------------------
# Guest endpoints — rate-limited wrappers
# ---------------------------------------------------------------------------


@frappe.whitelist(allow_guest=True)
def rate_limited_sign_up(email, full_name, redirect_to=""):
    """Rate-limited user sign-up wrapper.

    Limits:
    - 5 attempts per hour per email address.
    - 10 attempts per hour per client IP.

    After passing the rate check the call is delegated to the standard
    Frappe ``frappe.core.doctype.user.user.sign_up`` pipeline.

    Args:
        email (str): User email address.
        full_name (str): User's full name.

    Returns:
        tuple: Result from Frappe's ``sign_up`` (message, status).
    """
    if not email:
        frappe.throw("Email is required.", frappe.ValidationError)
    if not full_name:
        frappe.throw("Full name is required.", frappe.ValidationError)

    email = email.strip().lower()
    full_name = full_name.strip()
    client_ip = _get_client_ip()

    # Rate checks — will raise on excess
    check_rate_limit("sign_up_email", email, max_attempts=5, window_seconds=3600)
    check_rate_limit("sign_up_ip", client_ip, max_attempts=10, window_seconds=3600)

    # Check if user already exists (use db call, not get_doc)
    existing = frappe.db.get_value("User", {"email": email}, "name")
    if existing:
        frappe.throw("An account with this email already exists.", frappe.ValidationError)

    # Delegate to Frappe's built-in sign_up
    from frappe.core.doctype.user.user import sign_up

    return sign_up(email, full_name, redirect_to=None)


@frappe.whitelist(allow_guest=True)
def rate_limited_reset_password(user):
    """Rate-limited password-reset wrapper.

    Limits: 3 attempts per hour per email.

    Args:
        user (str): The user's email / login ID.

    Returns:
        str: Success message.
    """
    if not user:
        frappe.throw("User email is required.", frappe.ValidationError)

    user = user.strip().lower()

    # Rate check
    check_rate_limit("reset_password", user, max_attempts=3, window_seconds=3600)

    # Verify user exists without loading the full document
    user_exists = frappe.db.get_value("User", {"email": user}, "name")
    if not user_exists:
        # Return a generic message to avoid user enumeration
        return "If an account with that email exists, a reset link has been sent."

    from frappe.core.doctype.user.user import reset_password

    reset_password(user)
    return "If an account with that email exists, a reset link has been sent."


# ---------------------------------------------------------------------------
# Admin helpers
# ---------------------------------------------------------------------------


def _check_system_manager():
    """Ensure the current user is a System Manager.

    Raises:
        frappe.PermissionError: If the user lacks the role.
    """
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(
            "Only System Managers can perform this action.",
            frappe.PermissionError,
        )


# ---------------------------------------------------------------------------
# Admin endpoints — authenticated, System Manager only
# ---------------------------------------------------------------------------


@frappe.whitelist()
def ban_user(email):
    """Disable a user account and clear all active sessions.

    Args:
        email (str): The user's email / User docname.

    Returns:
        dict: ``{"success": True, "email": str}``
    """
    _check_system_manager()

    if not email:
        frappe.throw("Email is required.", frappe.ValidationError)

    email = email.strip().lower()

    # Verify user exists via DB lookup
    user_name = frappe.db.get_value("User", {"email": email}, "name")
    if not user_name:
        frappe.throw(f"User '{email}' not found.", frappe.DoesNotExistError)

    # Prevent banning Administrator
    if user_name == "Administrator":
        frappe.throw("Cannot ban the Administrator account.", frappe.ValidationError)

    frappe.db.set_value("User", user_name, "enabled", 0)
    frappe.db.commit()

    # Clear all sessions for the user
    try:
        frappe.sessions.clear_sessions(email)
    except Exception:
        frappe.log_error(
            title="Session clear failed",
            message=f"Could not clear sessions for '{email}'.",
        )

    frappe.logger().info(f"User banned: {email} by {frappe.session.user}")

    return {"success": True, "email": email}


@frappe.whitelist()
def unban_user(email):
    """Re-enable a previously disabled user account.

    Args:
        email (str): The user's email / User docname.

    Returns:
        dict: ``{"success": True, "email": str}``
    """
    _check_system_manager()

    if not email:
        frappe.throw("Email is required.", frappe.ValidationError)

    email = email.strip().lower()

    user_name = frappe.db.get_value("User", {"email": email}, "name")
    if not user_name:
        frappe.throw(f"User '{email}' not found.", frappe.DoesNotExistError)

    frappe.db.set_value("User", user_name, "enabled", 1)
    frappe.db.commit()

    frappe.logger().info(f"User unbanned: {email} by {frappe.session.user}")

    return {"success": True, "email": email}


@frappe.whitelist()
def admin_delete_user(email):
    """Hard-delete a user and all related LMS data.

    Removes the User document plus any associated LMS Enrollment,
    Course Progress, and Transaction records.

    Args:
        email (str): The user's email.

    Returns:
        dict: ``{"success": True, "email": str, "deleted_records": dict}``
    """
    _check_system_manager()

    if not email:
        frappe.throw("Email is required.", frappe.ValidationError)

    email = email.strip().lower()

    user_name = frappe.db.get_value("User", {"email": email}, "name")
    if not user_name:
        frappe.throw(f"User '{email}' not found.", frappe.DoesNotExistError)

    # Prevent deleting Administrator
    if user_name == "Administrator":
        frappe.throw("Cannot delete the Administrator account.", frappe.ValidationError)

    deleted = {}

    # Delete related LMS records (best-effort — doctypes may not exist yet)
    related_doctypes = {
        "LMS Enrollment": "member",
        "Course Progress": "member",
        "LMS Certificate Request": "member",
    }

    for doctype, field in related_doctypes.items():
        try:
            records = frappe.db.get_list(doctype, filters={field: email}, pluck="name")
            for rec in records:
                frappe.db.delete(doctype, rec)
            deleted[doctype] = len(records)
        except Exception:
            # Doctype may not exist; skip gracefully
            deleted[doctype] = 0

    # Delete payment / transaction records if they exist
    try:
        txns = frappe.db.get_list(
            "LMS Payment", filters={"member": email}, pluck="name"
        )
        for txn in txns:
            frappe.db.delete("LMS Payment", txn)
        deleted["LMS Payment"] = len(txns)
    except Exception:
        deleted["LMS Payment"] = 0

    # Finally, delete the user
    try:
        frappe.delete_doc("User", user_name, force=True)
        deleted["User"] = 1
    except Exception as exc:
        frappe.log_error(
            title="User deletion failed",
            message=f"Could not delete user '{email}': {exc}",
        )
        frappe.throw(
            f"Failed to delete user '{email}': {exc}",
            frappe.ValidationError,
        )

    frappe.db.commit()
    frappe.logger().info(
        f"User hard-deleted: {email} by {frappe.session.user} — records: {deleted}"
    )

    return {"success": True, "email": email, "deleted_records": deleted}


@frappe.whitelist()
def get_banned_users():
    """List all disabled (banned) user accounts.

    Returns:
        list[dict]: Each entry contains ``email``, ``full_name``,
            ``creation``, and ``modified``.
    """
    _check_system_manager()

    users = frappe.db.get_list(
        "User",
        filters={"enabled": 0, "user_type": "Website User"},
        fields=["name", "email", "full_name", "creation", "modified"],
        order_by="modified desc",
        limit_page_length=0,
    )

    return users
