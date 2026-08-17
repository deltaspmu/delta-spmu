"""
Telegram bot integration for Delta SPMU Academy.

Lets students link their Telegram account to their LMS account (deep link from
the student portal), receive push notifications (payment receipt, enrollment
confirmation, certificate issued), query their status via chat commands
(/mycourses, /progress, /certificates), and lets admins broadcast an
announcement to every linked student from the admin portal.

Design notes
------------
* **Ships dark.** Everything is gated behind ``telegram_enabled`` +
  ``telegram_bot_token`` (default off). Deploying this file changes nothing
  until the bot is created and the config keys are set.
* **Never blocks payments / certificates.** All outbound notifications are
  enqueued after commit; the enqueue call sites are
  additionally wrapped in try/except.
* **Webhook always answers 200.** Telegram redelivers on non-200, so the
  webhook swallows + logs every error and dedupes on ``update_id``.
* **No hooks.py.** This repo only ships custom *.py files, so the User custom
  fields are created programmatically (setup_telegram_custom_fields) and the
  notify calls are inserted at explicit call sites in payments_api / api /
  custom_api.

Config keys (frappe.conf / site_config.json, set via ``bench set-config``):
    telegram_enabled          -- master switch (0/1)
    telegram_bot_token        -- from @BotFather
    telegram_bot_username     -- bot username WITHOUT @ (for t.me deep links)
    telegram_webhook_secret   -- random secret, echoed by Telegram in the
                                 X-Telegram-Bot-Api-Secret-Token header
    telegram_portal_url       -- optional; defaults to the learn portal

Activation (after deploy, as frappe user on the server):
    bench --site <site> set-config telegram_bot_token "<token>"
    bench --site <site> set-config telegram_bot_username "<BotUsername>"
    bench --site <site> set-config telegram_webhook_secret "$(openssl rand -hex 24)"
    bench --site <site> execute lms.lms.telegram_bot.setup_telegram_custom_fields
    bench --site <site> set-config telegram_enabled 1
    bench --site <site> execute lms.lms.telegram_bot.set_webhook
    bench --site <site> execute lms.lms.telegram_bot.set_bot_commands
    bench --site <site> execute lms.lms.telegram_bot.webhook_info
"""

import hmac
import html
import json
import time

import frappe
import requests
from frappe import _

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"
WEBHOOK_METHOD = "lms.lms.telegram_bot.webhook"

LINK_TOKEN_TTL = 600           # seconds a portal-issued link token stays valid
UPDATE_DEDUPE_TTL = 86400      # remember processed update_ids for 24 h
MAX_MESSAGE_LEN = 4096         # Telegram hard limit per message
LIST_ROW_CAP = 30              # cap course/cert rows per reply
BROADCAST_SLEEP = 0.05         # ~20 msg/s, safely under Telegram's ~30 msg/s

TELEGRAM_USER_FIELDS = ("telegram_chat_id", "telegram_username", "telegram_linked_on")


# ---------------------------------------------------------------------------
# Config / gating helpers
# ---------------------------------------------------------------------------

def _conf(key, required=False, default=None):
    """Read a value from frappe.conf; throw if required and missing."""
    value = frappe.conf.get(key)
    if value in (None, "") and required:
        frappe.throw(f"Telegram config key '{key}' is not set.")
    return value if value not in (None, "") else default


def _bool_conf(key, default=False):
    value = frappe.conf.get(key)
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def is_enabled():
    """Master switch — everything no-ops unless enabled AND a token exists."""
    return _bool_conf("telegram_enabled", default=False) and bool(_conf("telegram_bot_token"))


def _fields_ready():
    """True once setup_telegram_custom_fields has added the User columns.

    Keeps every DB-touching path inert even if ``telegram_enabled`` is
    somehow flipped before field setup has run.
    """
    return frappe.db.has_column("User", "telegram_chat_id")


def _portal_url():
    return (_conf("telegram_portal_url") or "https://learn.deltaspmu.com").rstrip("/")


# ---------------------------------------------------------------------------
# Message strings (English). Amharic later = a second dict + a language
# switch inside _msg(); no other code changes.
# ---------------------------------------------------------------------------

MESSAGES = {
    "welcome": (
        "👋 Welcome to <b>Delta SPMU Academy</b>!\n\n"
        "Tap the button below to open the academy right here in Telegram — "
        "browse courses, create your account, enroll and learn.\n\n"
        "I'll also send you payment receipts, enrollment confirmations and "
        "certificate alerts once you connect your account "
        "(Profile → Connect Telegram inside the app).\n\n"
        "Type /help to see what I can do."
    ),
    "welcome_linked": (
        "👋 Hi {name}! Your account is connected.\n\n"
        "Tap the button below to open the academy, or type /help to see "
        "what I can do here in the chat."
    ),
    "linked_ok": (
        "✅ Done, {name}! Your Telegram is now connected to your "
        "Delta SPMU Academy account.\n\n"
        "You'll receive payment receipts, enrollment confirmations and "
        "certificate alerts here.\n\nTry /mycourses to see your courses."
    ),
    "link_expired": (
        "⌛ That link has expired or was already used.\n\n"
        "Open your profile at {portal}/profile and press "
        "<b>Connect Telegram</b> to get a fresh link."
    ),
    "not_linked": (
        "🔗 Your Telegram isn't connected to an account yet.\n\n"
        "Open your profile at {portal}/profile and press <b>Connect Telegram</b>."
    ),
    "help": (
        "Here's what I can do:\n\n"
        "/start — open the academy app\n"
        "/mycourses — list your enrolled courses\n"
        "/progress — your progress in each course\n"
        "/certificates — your earned certificates\n"
        "/unlink — disconnect Telegram from your account\n"
        "/help — show this message\n\n"
        "The full academy (register, enroll, watch lessons, take quizzes) "
        "opens with the button below or the menu button next to the "
        "message box."
    ),
    "mycourses_header": "📚 <b>Your courses</b>\n",
    "mycourses_empty": "You're not enrolled in any course yet.\nBrowse courses at {portal}/courses",
    "certificates_header": "🏆 <b>Your certificates</b>\n",
    "certificates_empty": (
        "No certificates yet — finish all lessons and pass the quizzes to earn one!\n"
        "Track your progress with /progress"
    ),
    "unlinked": (
        "✅ Telegram disconnected. You'll no longer receive notifications here.\n"
        "You can reconnect anytime from your profile at {portal}/profile."
    ),
    "unknown": "🤔 I didn't understand that. Type /help to see what I can do.",
    "more_rows": "\n…and {n} more.",
    "payment_received": (
        "✅ <b>Payment received — thank you!</b>\n\n"
        "Course: <b>{course_title}</b>\n"
        "Amount: {amount} {currency}\n"
        "Receipt No: {transaction_id}\n\n"
        "You're enrolled! Start learning at {portal}/my-courses 🎓"
    ),
    "enrollment_confirmed": (
        "🎓 <b>You're enrolled!</b>\n\n"
        "You now have access to <b>{course_title}</b>.\n"
        "Start learning at {portal}/my-courses"
    ),
    "certificate_issued": (
        "🏆 <b>Congratulations — your certificate is ready!</b>\n\n"
        "Course: <b>{course_title}</b>\n"
        "{certificate_line}"
        "Download it at {portal}/certificates"
    ),
}


def _msg(key, **kwargs):
    kwargs.setdefault("portal", _portal_url())
    return MESSAGES[key].format(**kwargs)


def _esc(value):
    """HTML-escape dynamic values interpolated into parse_mode=HTML messages."""
    return html.escape(str(value or ""), quote=False)


# ---------------------------------------------------------------------------
# Telegram Bot API transport
# ---------------------------------------------------------------------------

def _tg_api(method, payload=None, timeout=15):
    """POST to the Bot API and return the parsed JSON response (may raise)."""
    token = _conf("telegram_bot_token", required=True)
    resp = requests.post(
        TELEGRAM_API.format(token=token, method=method),
        json=payload or {},
        timeout=timeout,
    )
    try:
        return resp.json()
    except ValueError:
        return {"ok": False, "error_code": resp.status_code, "description": resp.text[:500]}


def _webapp_keyboard():
    """Inline button that opens the student portal as a Telegram Mini App
    (in-Telegram webview), so visitors can register / enroll / learn without
    leaving Telegram."""
    return {"inline_keyboard": [[
        {"text": "🎓 Open Delta SPMU Academy", "web_app": {"url": _portal_url()}}
    ]]}


def _send_message(chat_id, text, parse_mode="HTML", disable_preview=True,
                  reply_markup=None):
    """Send one message. Never raises.

    Returns (ok, error_code, description) so callers can react to 403
    (user blocked the bot) and 429 (rate limited) — plus the raw
    ``retry_after`` seconds tucked into description on 429.
    """
    try:
        payload = {
            "chat_id": chat_id,
            "text": (text or "")[:MAX_MESSAGE_LEN],
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_preview,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        data = _tg_api("sendMessage", payload)
        if data.get("ok"):
            return True, None, ""
        code = data.get("error_code")
        desc = data.get("description") or ""
        if code == 429:
            retry_after = (data.get("parameters") or {}).get("retry_after", 2)
            return False, 429, str(retry_after)
        if code != 403:  # 403 = blocked/deactivated: expected churn, not an error
            frappe.log_error(
                title="telegram_send_failed",
                message=json.dumps({"chat_id": str(chat_id), "code": code, "desc": desc}),
            )
        return False, code, desc
    except Exception as exc:
        frappe.log_error(title="telegram_send_failed", message=frappe.get_traceback())
        return False, None, str(exc)


# ---------------------------------------------------------------------------
# Account linking (portal -> deep link -> /start <token>)
# ---------------------------------------------------------------------------

def _link_token_key(token):
    return f"tg_link:{token}"


def _link_user_key(email):
    return f"tg_link_user:{email}"


def _user_for_chat(chat_id):
    """Return {name, full_name, first_name} of the User linked to chat_id, or None."""
    if not _fields_ready():
        return None
    return frappe.db.get_value(
        "User", {"telegram_chat_id": str(chat_id)},
        ["name", "full_name", "first_name"], as_dict=True,
    )


def _clear_link(user_email):
    frappe.db.set_value(
        "User", user_email,
        {field: None for field in TELEGRAM_USER_FIELDS},
        update_modified=False,
    )


def _consume_link_token(token, message):
    """Handle /start <token>: bind this chat to the User the token was minted for."""
    email = frappe.cache().get_value(_link_token_key(token))
    if not email or not frappe.db.exists("User", email):
        return _msg("link_expired")

    # Single use — burn both directions before writing.
    frappe.cache().delete_value(_link_token_key(token))
    frappe.cache().delete_value(_link_user_key(email))

    chat_id = str(message["chat"]["id"])
    tg_username = (message.get("from") or {}).get("username") or ""

    # One human, one chat: if this chat is already bound to a different User
    # (e.g. the student re-registered with a new email), the latest link wins.
    for other in frappe.get_all("User", filters={"telegram_chat_id": chat_id}, pluck="name"):
        if other != email:
            _clear_link(other)

    frappe.db.set_value("User", email, {
        "telegram_chat_id": chat_id,
        "telegram_username": tg_username,
        "telegram_linked_on": frappe.utils.now_datetime(),
    }, update_modified=False)
    # Explicit commit: the webhook swallows exceptions upstream, so we can't
    # rely on the end-of-request auto-commit.
    frappe.db.commit()

    name = frappe.db.get_value("User", email, "first_name") \
        or frappe.db.get_value("User", email, "full_name") or "there"
    return _msg("linked_ok", name=_esc(name))


# ---------------------------------------------------------------------------
# Webhook  (POST /api/method/lms.lms.telegram_bot.webhook)
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True, methods=["POST"])
def webhook():
    """Telegram update receiver. ALWAYS returns 200 — Telegram redelivers on
    non-200, and a retry storm helps nobody. Errors are logged instead."""
    if not is_enabled() or not _fields_ready():
        return "ok"

    # Telegram echoes the secret we registered in set_webhook() on every call.
    given = frappe.request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    expected = _conf("telegram_webhook_secret") or ""
    if not expected or not hmac.compare_digest(given, expected):
        frappe.log_error(title="telegram_webhook_bad_secret",
                         message=f"ip={frappe.local.request_ip}")
        return "ok"

    try:
        update = json.loads(frappe.request.get_data(as_text=True) or "{}")
    except Exception:
        frappe.log_error(title="telegram_webhook_bad_payload", message=frappe.get_traceback())
        return "ok"

    # Dedupe: nginx-level 502s during deploys make Telegram redeliver even
    # though we always answer 200 ourselves.
    update_id = update.get("update_id")
    if update_id is not None:
        dedupe_key = f"tg_upd:{update_id}"
        if frappe.cache().get_value(dedupe_key):
            return "ok"
        frappe.cache().set_value(dedupe_key, 1, expires_in_sec=UPDATE_DEDUPE_TTL)

    try:
        _route_update(update)
    except Exception:
        frappe.log_error(title="telegram_webhook_error", message=frappe.get_traceback())

    return "ok"


def _route_update(update):
    message = update.get("message")
    if not message or not message.get("text"):
        return
    chat = message.get("chat") or {}
    if chat.get("type") != "private":  # the bot is a DM bot; ignore groups
        return

    chat_id = chat["id"]
    text = message["text"].strip()
    parts = text.split()
    cmd = parts[0].split("@")[0].lower() if parts and parts[0].startswith("/") else None

    if cmd == "/start":
        reply = _cmd_start(parts, message)
    elif cmd == "/help":
        reply = _msg("help")
    elif cmd == "/mycourses":
        reply = _cmd_mycourses(chat_id)
    elif cmd == "/progress":
        reply = _cmd_progress(chat_id)
    elif cmd == "/certificates":
        reply = _cmd_certificates(chat_id)
    elif cmd == "/unlink":
        reply = _cmd_unlink(chat_id)
    else:
        reply = _msg("unknown")

    if reply:
        # /start and /help lead with the Mini App button so visitors can jump
        # straight into the portal (register, enroll, learn) inside Telegram.
        markup = _webapp_keyboard() if cmd in ("/start", "/help") else None
        _send_message(chat_id, reply, reply_markup=markup)


def _cmd_start(parts, message):
    if len(parts) > 1:
        return _consume_link_token(parts[1], message)
    user = _user_for_chat(message["chat"]["id"])
    if user:
        return _msg("welcome_linked", name=_esc(user.first_name or user.full_name or "there"))
    return _msg("welcome")


def _enrolled_courses(member):
    """[(course, title)] for every enrollment of *member* (title falls back to id)."""
    rows = frappe.get_all("LMS Enrollment", filters={"member": member},
                          fields=["course"], order_by="creation asc")
    out = []
    for row in rows:
        title = frappe.db.get_value("LMS Course", row.course, "title") or row.course
        out.append((row.course, title))
    return out


def _capped(lines):
    shown = lines[:LIST_ROW_CAP]
    text = "\n".join(shown)
    if len(lines) > LIST_ROW_CAP:
        text += _msg("more_rows", n=len(lines) - LIST_ROW_CAP)
    return text


def _cmd_mycourses(chat_id):
    user = _user_for_chat(chat_id)
    if not user:
        return _msg("not_linked")
    courses = _enrolled_courses(user.name)
    if not courses:
        return _msg("mycourses_empty")
    lines = [f"• {_esc(title)}" for _course, title in courses]
    return _msg("mycourses_header") + _capped(lines)


def _cmd_progress(chat_id):
    user = _user_for_chat(chat_id)
    if not user:
        return _msg("not_linked")
    courses = _enrolled_courses(user.name)
    if not courses:
        return _msg("mycourses_empty")

    from lms.lms.custom_api import get_course_progress

    lines = []
    for course, title in courses:
        try:
            prog = get_course_progress(course, member=user.name)
            pct = prog.get("progress_percentage", 0)
            done = len(prog.get("completed_lessons") or [])
            total = prog.get("total_lessons", 0)
            lines.append(f"• {_esc(title)} — <b>{pct}%</b> ({done}/{total} lessons)")
        except Exception:
            lines.append(f"• {_esc(title)} — n/a")
    return "📈 <b>Your progress</b>\n" + _capped(lines)


def _cmd_certificates(chat_id):
    user = _user_for_chat(chat_id)
    if not user:
        return _msg("not_linked")
    certs = frappe.get_all(
        "LMS Certificate", filters={"member": user.name},
        fields=["course", "course_title", "certificate_id", "issue_date"],
        order_by="issue_date desc",
    )
    if not certs:
        return _msg("certificates_empty")
    lines = []
    for cert in certs:
        title = cert.course_title or frappe.db.get_value("LMS Course", cert.course, "title") or cert.course
        line = f"• {_esc(title)}"
        if cert.certificate_id:
            line += f" — <code>{_esc(cert.certificate_id)}</code>"
        if cert.issue_date:
            line += f" ({cert.issue_date})"
        lines.append(line)
    return _msg("certificates_header") + _capped(lines)


def _cmd_unlink(chat_id):
    user = _user_for_chat(chat_id)
    if not user:
        return _msg("not_linked")
    _clear_link(user.name)
    frappe.db.commit()
    return _msg("unlinked")


# ---------------------------------------------------------------------------
# Outbound notifications (called from payment / enrollment / certificate flows)
# ---------------------------------------------------------------------------

def _enqueue(job_method, **kwargs):
    """Gate + enqueue-after-commit. Call sites additionally wrap in try/except
    so a Telegram problem can never break payments or certificates."""
    if not is_enabled():
        return
    frappe.enqueue(job_method, queue="short", enqueue_after_commit=True, **kwargs)


def notify_user(user_email, text):
    """Send *text* to the user's linked chat. No-op when disabled/unlinked.
    On 403 (user blocked the bot) the stale link is cleared. Never raises."""
    if not is_enabled() or not _fields_ready() or not user_email:
        return False
    chat_id = frappe.db.get_value("User", user_email, "telegram_chat_id")
    if not chat_id:
        return False
    ok, code, _desc = _send_message(chat_id, text)
    if code == 403:
        _clear_link(user_email)
        frappe.db.commit()
    return ok


def _course_title(course):
    # The bundle is a virtual product with no LMS Course row.
    if course == "all-courses-bundle":
        return "All Courses Bundle"
    return frappe.db.get_value("LMS Course", course, "title") or course


def notify_payment_success(transaction_name):
    """Job body: combined 'payment received + enrolled' message."""
    tx = frappe.db.get_value(
        "Payment Transaction", transaction_name,
        ["user", "course", "amount", "currency", "transaction_id"], as_dict=True,
    )
    if not tx or not tx.user:
        return
    notify_user(tx.user, _msg(
        "payment_received",
        course_title=_esc(_course_title(tx.course)),
        amount=tx.amount,
        currency=_esc(tx.currency or "ETB"),
        transaction_id=_esc(tx.transaction_id or transaction_name),
    ))


def notify_enrollment(member, course):
    """Job body: enrollment confirmation (non-payment path, e.g. manual enroll)."""
    notify_user(member, _msg(
        "enrollment_confirmed", course_title=_esc(_course_title(course)),
    ))


def notify_certificate_issued(member, course_title, certificate_id=None):
    """Job body: certificate-ready alert."""
    cert_line = f"Certificate ID: <code>{_esc(certificate_id)}</code>\n\n" if certificate_id else "\n"
    notify_user(member, _msg(
        "certificate_issued",
        course_title=_esc(course_title),
        certificate_line=cert_line,
    ))


# ---------------------------------------------------------------------------
# Student-portal endpoints
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_telegram_status():
    """Linked/unlinked status for the logged-in student. When the integration
    is dark this returns {"enabled": False} and the portal hides the section."""
    from lms.lms.custom_api import _require_login
    _require_login()

    if not is_enabled() or not _fields_ready():
        return {"enabled": False}

    row = frappe.db.get_value(
        "User", frappe.session.user,
        ["telegram_chat_id", "telegram_username", "telegram_linked_on"], as_dict=True,
    ) or frappe._dict()
    return {
        "enabled": True,
        "linked": bool(row.telegram_chat_id),
        "telegram_username": row.telegram_username,
        "linked_on": str(row.telegram_linked_on) if row.telegram_linked_on else None,
        "bot_username": _conf("telegram_bot_username"),
    }


@frappe.whitelist()
def create_link_token():
    """Mint (or reuse) a single-use deep-link token for the logged-in student."""
    from lms.lms.custom_api import _require_login
    _require_login()

    if not is_enabled():
        frappe.throw(_("Telegram integration is not enabled."))
    bot_username = _conf("telegram_bot_username", required=True)
    email = frappe.session.user

    # Repeated clicks reuse the pending token instead of minting infinitely.
    token = frappe.cache().get_value(_link_user_key(email))
    if not token or frappe.cache().get_value(_link_token_key(token)) != email:
        token = frappe.generate_hash(length=32)
        frappe.cache().set_value(_link_token_key(token), email, expires_in_sec=LINK_TOKEN_TTL)
        frappe.cache().set_value(_link_user_key(email), token, expires_in_sec=LINK_TOKEN_TTL)

    return {
        "token": token,
        "deep_link": f"https://t.me/{bot_username}?start={token}",
        "expires_in": LINK_TOKEN_TTL,
    }


@frappe.whitelist()
def disconnect_telegram():
    """Unlink the logged-in student's Telegram."""
    from lms.lms.custom_api import _require_login
    _require_login()

    if _fields_ready():
        _clear_link(frappe.session.user)
        frappe.db.commit()
    return {"disconnected": True}


# ---------------------------------------------------------------------------
# Admin endpoints (broadcast)
# ---------------------------------------------------------------------------

def _linked_count():
    if not _fields_ready():
        return 0
    return frappe.db.count("User", {"telegram_chat_id": ["is", "set"], "enabled": 1})


@frappe.whitelist()
def admin_get_telegram_stats():
    from lms.lms.custom_api import _require_admin
    _require_admin()
    return {"enabled": is_enabled(), "linked_count": _linked_count()}


@frappe.whitelist()
def admin_broadcast(message=None):
    """Queue a broadcast to every linked student. Returns the recipient count;
    delivery happens on the long queue (see _run_broadcast)."""
    from lms.lms.custom_api import _require_admin
    _require_admin()

    if not is_enabled():
        frappe.throw(_("Telegram integration is not enabled."))

    message = (message or "").strip()
    if not message:
        frappe.throw(_("Message is required."))
    if len(message) > MAX_MESSAGE_LEN:
        frappe.throw(_("Message is too long (max {0} characters).").format(MAX_MESSAGE_LEN))

    recipients = _linked_count()
    if not recipients:
        frappe.throw(_("No students have connected Telegram yet."))

    frappe.enqueue(
        "lms.lms.telegram_bot._run_broadcast",
        queue="long",
        job_name=f"tg_broadcast_{frappe.generate_hash(length=8)}",
        message=message,
        initiated_by=frappe.session.user,
    )
    return {"queued": True, "recipients": recipients}


def _run_broadcast(message, initiated_by=None):
    """Deliver a broadcast, paced under Telegram's rate limit. Broadcasts are
    plain text (no parse_mode) so admin copy can't break on stray HTML."""
    users = frappe.get_all(
        "User",
        filters=[["telegram_chat_id", "is", "set"], ["enabled", "=", 1]],
        fields=["name", "telegram_chat_id"],
    )
    sent = blocked = failed = 0
    for user in users:
        ok, code, desc = _send_message(user.telegram_chat_id, message, parse_mode=None)
        if not ok and code == 429:
            try:
                time.sleep(min(int(desc or 2), 30))
            except (TypeError, ValueError):
                time.sleep(2)
            ok, code, desc = _send_message(user.telegram_chat_id, message, parse_mode=None)
        if ok:
            sent += 1
        elif code == 403:
            _clear_link(user.name)  # user blocked the bot: self-healing list
            blocked += 1
        else:
            failed += 1
        time.sleep(BROADCAST_SLEEP)

    frappe.db.commit()
    frappe.log_error(
        title="telegram_broadcast_summary",
        message=json.dumps({
            "sent": sent, "blocked": blocked, "failed": failed,
            "total": len(users), "initiated_by": initiated_by,
        }),
    )


# ---------------------------------------------------------------------------
# One-time setup / ops  (run via: bench --site <site> execute
#   lms.lms.telegram_bot.<function>)
# ---------------------------------------------------------------------------

def setup_telegram_custom_fields():
    """Idempotently add the Telegram link fields to User."""
    from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

    fields = {
        "User": [
            {"fieldname": "telegram_section", "label": "Telegram",
             "fieldtype": "Section Break", "insert_after": "bio", "collapsible": 1},
            {"fieldname": "telegram_chat_id", "label": "Telegram Chat ID",
             "fieldtype": "Data", "insert_after": "telegram_section",
             "read_only": 1, "search_index": 1, "no_copy": 1,
             "description": "Set when the student links Telegram from the portal."},
            {"fieldname": "telegram_username", "label": "Telegram Username",
             "fieldtype": "Data", "insert_after": "telegram_chat_id",
             "read_only": 1, "no_copy": 1},
            {"fieldname": "telegram_linked_on", "label": "Telegram Linked On",
             "fieldtype": "Datetime", "insert_after": "telegram_username",
             "read_only": 1, "no_copy": 1},
        ],
    }
    create_custom_fields(fields, ignore_validate=True)
    frappe.db.commit()
    return "telegram custom fields created."


def set_webhook():
    """Point the bot's webhook at this site. Run AFTER the config keys are set."""
    secret = _conf("telegram_webhook_secret", required=True)
    api_base = (_conf("api_base_url") or "https://api.deltaspmu.com").rstrip("/")
    url = f"{api_base}/api/method/{WEBHOOK_METHOD}"
    resp = _tg_api("setWebhook", {
        "url": url,
        "secret_token": secret,
        "allowed_updates": ["message"],
        "drop_pending_updates": True,
    })
    return {"url": url, "response": resp}


def delete_webhook():
    return _tg_api("deleteWebhook", {"drop_pending_updates": True})


def webhook_info():
    """Verify: url set, pending_update_count near 0, no last_error_message."""
    return _tg_api("getWebhookInfo")


def set_bot_commands():
    """Register the command menu shown in the Telegram UI."""
    return _tg_api("setMyCommands", {"commands": [
        {"command": "start", "description": "Open the academy app"},
        {"command": "mycourses", "description": "List my enrolled courses"},
        {"command": "progress", "description": "My progress in each course"},
        {"command": "certificates", "description": "My earned certificates"},
        {"command": "help", "description": "What this bot can do"},
        {"command": "unlink", "description": "Disconnect Telegram from my account"},
    ]})


def setup_menu_button():
    """Make the bot's menu button (next to the message box) open the student
    portal as a Telegram Mini App — the full web app inside Telegram."""
    return _tg_api("setChatMenuButton", {"menu_button": {
        "type": "web_app",
        "text": "Open Academy",
        "web_app": {"url": _portal_url()},
    }})
