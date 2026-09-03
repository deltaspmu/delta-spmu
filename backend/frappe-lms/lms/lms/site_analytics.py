"""Marketing-site analytics: event collection + the admin acquisition dashboard.

The marketing site (deltaspmu.com) is a static single-page React app with no
backend of its own, so it has never been measurable: visitors arrive, some click
through to learn.deltaspmu.com, and the rest is invisible. This module adds the
smallest first-party collector that answers "how many visit, where from, and how
many convert", and joins those counts to the User / Payment Transaction rows the
platform already writes.

Three whitelisted surfaces:
    track()                     guest, GET  — one event from the marketing site
    admin_get_site_analytics()  admin       — the acquisition dashboard payload
    purge_old()                 scheduler   — retention sweep

Setup (once per environment, after the .py files are deployed):
    bench --site <site> execute lms.lms.site_analytics.setup
"""

from datetime import datetime, timedelta

import frappe
from frappe import _


# Retention for raw events. Long enough for year-over-year-ish comparison on a
# young site, short enough that the table stays small on a t3.small.
RETENTION_DAYS = 180

PURGE_JOB_METHOD = "lms.lms.site_analytics.purge_old"

# Events the collector accepts. Anything else is dropped — this is a public
# endpoint and the label/source columns feed GROUP BYs, so the vocabulary is
# closed rather than open.
ALLOWED_EVENTS = ("page_view", "cta_click", "scroll_depth", "contact_submit")

ALLOWED_DEVICES = ("mobile", "tablet", "desktop")

# Column length for every Data field below. Frappe's default Data length is 140.
MAX_LEN = 140

# Referrer hosts we care to name. Everything else collapses to its bare
# registrable-ish host, and a missing referrer becomes "direct" — otherwise the
# sources breakdown is a long tail of one-visit hosts nobody reads.
KNOWN_SOURCES = {
    "google": "google",
    "bing": "bing",
    "duckduckgo": "duckduckgo",
    "yahoo": "yahoo",
    "instagram": "instagram",
    "facebook": "facebook",
    "fb": "facebook",
    "messenger": "facebook",
    "tiktok": "tiktok",
    "youtube": "youtube",
    "t": "twitter",
    "twitter": "twitter",
    "x": "twitter",
    "linkedin": "linkedin",
    "telegram": "telegram",
    "whatsapp": "whatsapp",
}


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested in test_site_analytics.py — keep them frappe-free)
# ---------------------------------------------------------------------------

def _now():
    """Frappe's clock — the one that WRITES expiry_time.

    Never compare a Frappe-written datetime against SQL ``NOW()``: Frappe stamps
    rows in the site's timezone (System Settings) while the database clock is
    the DB server's, which is UTC on our hosts. On staging that skew is hours,
    so `expiry_time < NOW()` silently reports far fewer abandoned checkouts than
    there really are. Bind this value as a query parameter instead.
    """
    try:
        return frappe.utils.now_datetime()
    except Exception:
        return datetime.now()


def _clip(value, max_length=MAX_LEN):
    """Coerce to a trimmed string bounded by the column width."""
    if value is None:
        return ""
    text = str(value).strip()
    return text[:max_length]


def normalize_source(referrer, utm_source=None):
    """Collapse a raw referrer URL into a small, readable source label.

    An explicit ``utm_source`` always wins — that's the campaign the marketer
    tagged. Otherwise the referrer host is matched against KNOWN_SOURCES by its
    most significant label, so ``www.google.co.uk`` and ``news.google.com`` both
    land on ``google``. No referrer at all means the visitor typed the URL,
    used a bookmark, or came from an app that strips it: "direct".

    Returns:
        str: lowercase source label, never empty.
    """
    if utm_source:
        return _clip(utm_source).lower() or "direct"

    referrer = _clip(referrer, 500)
    if not referrer:
        return "direct"

    # Strip scheme, then take the authority up to the first /?#.
    host = referrer.split("://", 1)[-1]
    for sep in ("/", "?", "#"):
        host = host.split(sep, 1)[0]
    host = host.split("@")[-1].split(":")[0].strip().lower()
    if not host:
        return "direct"

    # Our own site (and its www/staging variants) is not a traffic source.
    if "deltaspmu" in host:
        return "internal"

    labels = [part for part in host.split(".") if part and part != "www"]
    for label in labels:
        if label in KNOWN_SOURCES:
            return KNOWN_SOURCES[label]

    # Unknown host: keep it, minus the leading www, so the long tail is at least
    # identifiable when someone goes looking.
    return _clip(".".join(labels) or host)


def normalize_device(device):
    """Constrain the client-reported device class to the known set."""
    device = _clip(device).lower()
    return device if device in ALLOWED_DEVICES else "desktop"


def is_abandoned(status, expiry_time, now=None):
    """True when a Payment Transaction represents a checkout the user walked away from.

    Status alone is not enough. Nothing sweeps stale rows on a schedule — a
    transaction is only flipped to ``Expired`` lazily, when the same user starts
    a *new* payment (payments_api._expire_stale_pending). So a genuinely
    abandoned cart from last month is still sitting at ``Pending``, and counting
    only ``Expired`` would undercount abandonment badly.

    ``Failed`` is excluded on purpose: those are provider-initiation errors, not
    a user changing their mind. They're reported separately.

    Args:
        status (str): Payment Transaction status.
        expiry_time (datetime | str | None): the row's expiry_time.
        now (datetime, optional): injectable clock; defaults to Frappe's.

    Returns:
        bool
    """
    if status == "Expired":
        return True
    if status != "Pending":
        return False
    if not expiry_time:
        return False

    now = now or _now()
    if isinstance(expiry_time, str):
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                expiry_time = datetime.strptime(expiry_time, fmt)
                break
            except ValueError:
                continue
    if not isinstance(expiry_time, datetime):
        return False
    return now > expiry_time


def conversion_rate(numerator, denominator):
    """Percentage of denominator that reached numerator, 0 when there's no traffic."""
    if not denominator:
        return 0.0
    return round(numerator / denominator * 100, 1)


# ---------------------------------------------------------------------------
# Schema — created programmatically, because this repo doesn't own the app's
# hooks.py or any doctype JSON (see _migrate_doctypes.py for the same pattern).
# ---------------------------------------------------------------------------

def _f(fieldname, fieldtype, label=None, options=None, index=0):
    d = {
        "fieldname": fieldname,
        "label": label or fieldname.replace("_", " ").title(),
        "fieldtype": fieldtype,
    }
    if options is not None:
        d["options"] = options
    if index:
        d["search_index"] = 1
    return d


SITE_EVENT_FIELDS = [
    _f("event", "Data", index=1),
    _f("visitor_id", "Data", index=1),
    _f("session_id", "Data", index=1),
    _f("label", "Data"),
    _f("path", "Data"),
    _f("source", "Data"),
    _f("medium", "Data"),
    _f("campaign", "Data"),
    _f("device", "Data"),
]


def setup():
    """Create the Site Event DocType and register the retention job. Idempotent.

    Run once per environment after deploying the .py files:
        bench --site <site> execute lms.lms.site_analytics.setup
    """
    if not frappe.db.exists("DocType", "Site Event"):
        module = "LMS" if frappe.db.exists("Module Def", "LMS") else "Custom"
        frappe.get_doc({
            "doctype": "DocType",
            "name": "Site Event",
            "module": module,
            "custom": 1,
            "naming_rule": "Random",
            "autoname": "hash",
            # Raw telemetry: versioning every row would double the write cost
            # and the table is append-only anyway.
            "track_changes": 0,
            "fields": SITE_EVENT_FIELDS,
            "permissions": [{
                "role": "System Manager",
                "read": 1, "write": 1, "create": 1, "delete": 1,
            }],
        }).insert(ignore_permissions=True)
        frappe.db.commit()
        created = "CREATED Site Event"
    else:
        created = "EXISTS Site Event"

    return "%s; %s" % (created, setup_purge_job())


def setup_purge_job():
    """Register the retention sweep as a Scheduled Job Type (data-level, since
    this repo doesn't own the app hooks.py). Requires the site scheduler enabled."""
    if frappe.db.exists("Scheduled Job Type", {"method": PURGE_JOB_METHOD}):
        return "EXISTS purge job"
    frappe.get_doc({
        "doctype": "Scheduled Job Type",
        "method": PURGE_JOB_METHOD,
        "frequency": "Daily",
        "create_log": 0,
    }).insert(ignore_permissions=True)
    frappe.db.commit()
    return "CREATED purge job"


def purge_old():
    """Delete raw events past the retention window. Called daily by the scheduler."""
    cutoff = _now() - timedelta(days=RETENTION_DAYS)
    frappe.db.sql(
        "DELETE FROM `tabSite Event` WHERE creation < %s",
        (cutoff.strftime("%Y-%m-%d %H:%M:%S"),),
    )
    frappe.db.commit()


# ---------------------------------------------------------------------------
# Collection — guest endpoint called by the marketing site
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def track(event=None, visitor_id=None, session_id=None, label=None, path=None,
          referrer=None, utm_source=None, utm_medium=None, utm_campaign=None,
          device=None):
    """Record one marketing-site event. Guest, GET, fire-and-forget.

    GET is deliberate, not an oversight. The browser sends these during page
    unload, where the only reliable transports are `fetch(..., {keepalive:true})`
    and sendBeacon — neither of which can set the header a POST would require.
    This matches the existing guest callback endpoints (see CLAUDE.md). Do not
    "fix" this into a POST; it will silently stop recording on the events that
    matter most.

    Accordingly this endpoint is treated as untrusted input and kept inert: it
    writes nothing but telemetry, reads nothing, reaches no money, access, or
    account state, accepts only the values in ALLOWED_EVENTS / ALLOWED_DEVICES,
    truncates every field, and is rate limited per IP.

    No IP address is persisted. The client IP is used for rate limiting only.

    Returns:
        dict: {"ok": True} once accepted, or {"ok": False} when dropped. The
        caller ignores this; it exists for manual verification.
    """
    event = _clip(event).lower()
    if event not in ALLOWED_EVENTS:
        return {"ok": False}

    # Rate limit per IP. Generous: a real session legitimately fires a page_view,
    # a scroll_depth and several cta_clicks, and Addis traffic is heavily NATed
    # behind a handful of mobile gateways, so this is a flood guard rather than
    # a per-user quota.
    try:
        from lms.lms.security import check_rate_limit, _get_client_ip

        check_rate_limit(
            action="site_event",
            identifier=_get_client_ip(),
            max_attempts=600,
            window_seconds=3600,
        )
    except ImportError:
        pass  # security module missing — record anyway rather than lose the event
    except frappe.TooManyRequestsError:
        return {"ok": False}

    # NOTE: never frappe.get_doc(<doctype>, <name>) to *read* in a guest
    # endpoint — it raises PermissionError for Guest (see CLAUDE.md). Inserting
    # a fresh doc with ignore_permissions is fine and is what payments_api does.
    #
    # ponytail: one row per event, inserted through the full Document lifecycle.
    # Fine at this site's volume (hundreds of visits/day) and it keeps the read
    # queries trivial. If writes ever show up in slow-query logs, roll page_view
    # up into a daily counter table and keep raw rows for the rarer events.
    frappe.get_doc({
        "doctype": "Site Event",
        "event": event,
        "visitor_id": _clip(visitor_id),
        "session_id": _clip(session_id),
        "label": _clip(label),
        "path": _clip(path),
        "source": normalize_source(referrer, utm_source),
        "medium": _clip(utm_medium),
        "campaign": _clip(utm_campaign),
        "device": normalize_device(device),
    }).insert(ignore_permissions=True)
    frappe.db.commit()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------

def _require_admin():
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(_("Only administrators can view site analytics."), frappe.PermissionError)


def _range(from_date=None, to_date=None, default_days=30):
    """Resolve the reporting window to [start, end_exclusive) datetime strings.

    ``to_date`` is inclusive as the user means it, so the exclusive end is the
    following midnight — otherwise everything that happened today after 00:00
    would be silently missing from a report ending today.
    """
    today = _now().date()

    def _parse(value, fallback):
        value = _clip(value, 32)
        if not value:
            return fallback
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return fallback

    end = _parse(to_date, today)
    start = _parse(from_date, end - timedelta(days=default_days - 1))
    if start > end:
        start, end = end, start

    return (
        start.strftime("%Y-%m-%d 00:00:00"),
        (end + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00"),
        start.strftime("%Y-%m-%d"),
        end.strftime("%Y-%m-%d"),
    )


@frappe.whitelist()
def admin_get_site_analytics(from_date=None, to_date=None):
    """Return the marketing-site acquisition dashboard payload (admin only).

    The funnel is *directional, not a strict subset*. Marketing-site visitors are
    counted by an anonymous first-party id on deltaspmu.com; signups and
    checkouts are real rows on learn.deltaspmu.com. We deliberately don't thread
    a visitor id across that domain hop, so a given signup can't be traced back
    to a given visit. Read the stages as "how many at each step in this window",
    not "how many of these exact people continued".

    Every figure is people-based (distinct visitors / distinct users) so the
    stages are comparable; per-button click totals are raw counts and live in
    ``cta_clicks``.

    Args:
        from_date (str, optional): ``YYYY-MM-DD``, inclusive. Defaults to 29 days
            before ``to_date``.
        to_date (str, optional): ``YYYY-MM-DD``, inclusive. Defaults to today.

    Returns:
        dict: traffic, sources, devices, cta_clicks, scroll_reach,
        contact_submits, funnel, abandoned, and the resolved date range.
    """
    _require_admin()
    start, end, start_date, end_date = _range(from_date, to_date)
    window = (start, end)

    has_events = frappe.db.exists("DocType", "Site Event")

    def events_sql(query, params=window):
        """Run a Site Event query, or return nothing when setup() hasn't run yet."""
        if not has_events:
            return []
        return frappe.db.sql(query, params, as_dict=True)

    # --- Traffic trend -----------------------------------------------------
    traffic = events_sql(
        """
        SELECT DATE(creation) AS date,
               COUNT(DISTINCT visitor_id) AS visitors,
               COUNT(DISTINCT session_id) AS sessions,
               SUM(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END) AS page_views
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s
        GROUP BY DATE(creation)
        ORDER BY date ASC
        """
    )
    for row in traffic:
        row["date"] = str(row["date"])
        row["page_views"] = int(row["page_views"] or 0)

    # --- Where they came from ---------------------------------------------
    sources = events_sql(
        """
        SELECT source, COUNT(DISTINCT visitor_id) AS visitors
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s AND source != ''
        GROUP BY source
        ORDER BY visitors DESC
        LIMIT 15
        """
    )

    devices = events_sql(
        """
        SELECT device, COUNT(DISTINCT visitor_id) AS visitors
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s AND device != ''
        GROUP BY device
        ORDER BY visitors DESC
        """
    )

    # --- Engagement --------------------------------------------------------
    cta_clicks = events_sql(
        """
        SELECT label, COUNT(*) AS clicks,
               COUNT(DISTINCT visitor_id) AS visitors
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s
          AND event = 'cta_click' AND label != ''
        GROUP BY label
        ORDER BY clicks DESC
        """
    )

    scroll_reach = events_sql(
        """
        SELECT label AS bucket, COUNT(DISTINCT session_id) AS sessions
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s
          AND event = 'scroll_depth' AND label != ''
        GROUP BY label
        ORDER BY sessions DESC
        """
    )

    totals = events_sql(
        """
        SELECT
            COUNT(DISTINCT visitor_id) AS visitors,
            COUNT(DISTINCT session_id) AS sessions,
            COUNT(DISTINCT CASE WHEN event = 'cta_click' THEN visitor_id END) AS cta_visitors,
            SUM(CASE WHEN event = 'contact_submit' THEN 1 ELSE 0 END) AS contact_submits
        FROM `tabSite Event`
        WHERE creation >= %s AND creation < %s
        """
    )
    totals = totals[0] if totals else {}
    visitors = int(totals.get("visitors") or 0)
    cta_visitors = int(totals.get("cta_visitors") or 0)
    contact_submits = int(totals.get("contact_submits") or 0)

    # --- Signups (already recorded; no collection needed) -------------------
    # custom_sign_up inserts the User with enabled=0 and mails a verification
    # link, so `enabled` is the verified flag. The gap between these two is the
    # drop-off that happens off-site in someone's inbox — usually the largest
    # single leak in the funnel and, until now, completely unmeasured.
    signup_row = frappe.db.sql(
        """
        SELECT COUNT(*) AS signups,
               SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS verified
        FROM `tabUser`
        WHERE user_type = 'Website User'
          AND creation >= %s AND creation < %s
        """,
        window,
        as_dict=True,
    )[0]
    signups = int(signup_row.signups or 0)
    verified_signups = int(signup_row.verified or 0)

    # --- Checkouts ---------------------------------------------------------
    checkout_row = frappe.db.sql(
        """
        SELECT COUNT(DISTINCT user) AS started,
               COUNT(DISTINCT CASE WHEN status = 'Completed' THEN user END) AS paid,
               COUNT(*) AS started_tx,
               SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS paid_tx,
               SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) AS failed_tx
        FROM `tabPayment Transaction`
        WHERE creation >= %s AND creation < %s
        """,
        window,
        as_dict=True,
    )[0]
    checkouts_started = int(checkout_row.started or 0)
    checkouts_paid = int(checkout_row.paid or 0)

    # --- Abandoned checkouts (actionable recovery list) --------------------
    # Mirrors is_abandoned(): status alone is unreliable because stale rows are
    # only flipped to Expired lazily, on the user's *next* payment attempt.
    # `expiry_time < %s` binds Frappe's clock, not SQL NOW() — see _now().
    abandoned_where = (
        "creation >= %s AND creation < %s "
        "AND (status = 'Expired' OR (status = 'Pending' AND expiry_time < %s))"
    )
    abandoned_params = (start, end, _now().strftime("%Y-%m-%d %H:%M:%S"))
    abandoned = frappe.db.sql(
        "SELECT transaction_id, user, course, course_title, amount, currency,"
        "       payment_method, status, creation "
        "FROM `tabPayment Transaction` WHERE " + abandoned_where +
        " ORDER BY creation DESC LIMIT 50",
        abandoned_params,
        as_dict=True,
    )
    for row in abandoned:
        row["creation"] = str(row["creation"])
        row["amount"] = float(row["amount"] or 0)

    abandoned_totals = frappe.db.sql(
        "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS value "
        "FROM `tabPayment Transaction` WHERE " + abandoned_where,
        abandoned_params,
        as_dict=True,
    )[0]

    return {
        "from_date": start_date,
        "to_date": end_date,
        # False until setup() has been run on this environment — the UI uses
        # this to explain empty traffic panels instead of showing a bare zero.
        "collector_ready": bool(has_events),
        "traffic": traffic,
        "sources": sources,
        "devices": devices,
        "cta_clicks": cta_clicks,
        "scroll_reach": scroll_reach,
        "contact_submits": contact_submits,
        "funnel": {
            "visitors": visitors,
            "cta_visitors": cta_visitors,
            "signups": signups,
            "verified_signups": verified_signups,
            "checkouts_started": checkouts_started,
            "checkouts_paid": checkouts_paid,
            "cta_rate": conversion_rate(cta_visitors, visitors),
            "verified_rate": conversion_rate(verified_signups, signups),
            "paid_rate": conversion_rate(checkouts_paid, checkouts_started),
        },
        "abandoned": abandoned,
        "abandoned_count": int(abandoned_totals["count"] or 0),
        "abandoned_value": float(abandoned_totals["value"] or 0),
        "failed_count": int(checkout_row.failed_tx or 0),
        "checkout_transactions": int(checkout_row.started_tx or 0),
        "paid_transactions": int(checkout_row.paid_tx or 0),
    }
