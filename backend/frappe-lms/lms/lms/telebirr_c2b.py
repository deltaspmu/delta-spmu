"""
telebirr C2B (CPS-Biller) inbound SOAP integration for Delta SPMU Academy.

Implements the Biller side of Ethio Telecom's "CPS - Biller Integration
Specification Document v0.2". Ethio Telecom's CPS (Mobile Money System) calls
THREE SOAP operations on us (the Biller) when a customer pays our short code via
telebirr "Pay Bill":

    1. C2BPaymentQuery        (ISD 5.2) -> return the bill (name + amount)
    2. C2BPaymentValidation   (ISD 5.3) -> authorise the payment in real time
    3. C2BPaymentConfirmation (ISD 5.4) -> money moved; complete + grant access

Service-flow facts that drive the design (ISD 4, step 8 + E6, and 5.4.2)
------------------------------------------------------------------------
* **The money moves on VALIDATION, not Confirmation.** ISD 4 step 8: *"If the
  correct response (ResultCode 0) is received from the third-party system [our
  Validation reply], the CPS Debits the initiator, Credits the biller ... and
  completes the payment."* So a Validation for which we return 0 is, to the CPS,
  a completed sale.
* **Validation is time-critical (~5 s).** ISD E6: if the biller does not reply
  within ~5 s the CPS keeps the txn "Authorized" and requires *offline
  reconciliation*. So Validation must be fast (DB writes only, no email/enrol).
* **Confirmation is an unreliable, post-completion notification.** ISD 5.4.2:
  its result *"is free text that does not have functional usage ... simply
  recorded in the back-end log for traceability."* It may be delayed or lost.

Therefore we run a real state machine and NEVER lose a paid student's access:

    Pending --(Validation ok)--> Authorized --(Confirmation)--> Completed
                                     |
                                     +--(no Confirmation within grace)-->
                                        reconciliation: alert admin, and
                                        optionally auto-complete (Validation
                                        success already means money moved).

Access is granted on Confirmation (money definitely moved) OR by reconciliation
of a stuck "Authorized" bill — so a lost Confirmation can never silently deny a
paying student their course.

Dispatch, transport, security
-----------------------------
* **Dispatch by SOAP root element**, never TransType (the samples prove it is
  inconsistent: "QueryBill"/"PayBill" vs numeric 11124/12104/20032, and absent
  from the Validation sample). See telebirr_c2b_xml.
* **Content-Type text/xml; charset=utf-8**; namespace
  http://cps.huawei.com/cpsinterface/c2bpayment.
* **Auth**: source-IP allow-list + BusinessShortCode match (the CPS sends no
  SOAP-header credentials — the sample <soapenv:Header/> is empty). Both checks
  are config-gated and skipped while unset, so the endpoint is self-testable
  before go-live and locked down after.

Config keys (frappe.conf / site_config.json):
    telebirr_c2b_short_code               our registered BusinessShortCode
    telebirr_c2b_allowed_ips              comma-separated CPS source IPs
    telebirr_c2b_utility_name             merchant name shown to the payer
    telebirr_c2b_auto_complete_authorized auto-complete stuck Authorized bills
                                          (default off; on = trust Validation)
    telebirr_c2b_authorized_grace_minutes grace before an Authorized bill is
                                          considered stuck (default 30)
    telebirr_c2b_alert_email              recipient(s) for reconciliation alerts

Endpoint the CPS is registered to call:
    /api/method/lms.lms.telebirr_c2b.c2b
"""

import json
import random
from datetime import datetime, timedelta

import frappe
from frappe import _
from frappe.utils import cint, now_datetime

# ---------------------------------------------------------------------------
# Result codes (ISD: "0" == success; any other value is an error the CPS treats
# as E2/E5 failure and cancels/releases the reservation).
# ---------------------------------------------------------------------------
RESULT_OK = "0"
ERR_BILL_NOT_FOUND = "1"
ERR_ALREADY_PAID = "2"
ERR_EXPIRED = "3"
ERR_AMOUNT_MISMATCH = "4"
ERR_BAD_SHORTCODE = "5"
ERR_INTERNAL = "6"
ERR_IN_PROGRESS = "7"

# C2B state machine (stored in telebirr_c2b_state; distinct from the generic
# Payment Transaction.status so we never fight its Select options).
STATE_PENDING = "Pending"
STATE_AUTHORIZED = "Authorized"
STATE_COMPLETED = "Completed"

RECONCILE_JOB_METHOD = "lms.lms.telebirr_c2b.scheduled_reconcile_authorized"
ALERT_THROTTLE_KEY = "telebirr_c2b_stuck_alert_sent"
ALERT_THROTTLE_SEC = 6 * 60 * 60
DEFAULT_GRACE_MINUTES = 30

_TX_FIELDS = [
    "name", "transaction_id", "user", "course", "course_title",
    "amount", "currency", "status", "telebirr_bill_ref", "expiry_time",
    "telebirr_c2b_state", "telebirr_cps_trans_id", "telebirr_authorized_at",
]


# ---------------------------------------------------------------------------
# Config / logging helpers
# ---------------------------------------------------------------------------

def _conf(key, default=None):
    value = frappe.conf.get(key)
    return value if value not in (None, "") else default


def _bool_conf(key, default=False):
    value = frappe.conf.get(key)
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def _our_short_code():
    return str(_conf("telebirr_c2b_short_code") or "").strip()


def _utility_name():
    # Merchant/bill-issuer name shown to the payer in telebirr (ISD 5.2.2
    # UtilityName). telebirr-specific config ONLY — no cross-integration fallback.
    return _conf("telebirr_c2b_utility_name") or "Delta SPMU Academy"


def _grace_minutes():
    return cint(_conf("telebirr_c2b_authorized_grace_minutes")) or DEFAULT_GRACE_MINUTES


def _log(event, data=None, level="info"):
    logger = frappe.logger("telebirr_c2b", allow_site=True)
    msg = "[telebirr_c2b:{0}] ".format(event) + (
        json.dumps(data, default=str) if isinstance(data, dict) else str(data or "")
    )
    getattr(logger, level, logger.info)(msg)


# ---------------------------------------------------------------------------
# Inbound security  (both checks skipped while unset -> safe to test pre-go-live)
# ---------------------------------------------------------------------------

def _client_ip():
    try:
        return frappe.local.request_ip
    except Exception:
        return None


def _ip_allowed():
    allow = _conf("telebirr_c2b_allowed_ips")
    if not allow:
        return True  # not configured yet -> allow (build/test phase)
    allowed = {x.strip() for x in str(allow).split(",") if x.strip()}
    return _client_ip() in allowed


def _short_code_ok(short_code):
    ours = _our_short_code()
    if not ours:
        return True  # not configured yet -> don't block (build/test phase)
    return str(short_code or "").strip() == ours


def _auth_configured():
    """At least one inbound auth factor must be set before we honour a
    STATE-CHANGING op (Validation/Confirmation). The per-request checks skip
    when unset for convenience, but completing a payment while wholly
    unconfigured would let a forged request unlock a course for free (bill refs
    are non-secret). Read-only Query stays lenient; money paths do not."""
    return bool(_our_short_code()) or bool(_conf("telebirr_c2b_allowed_ips"))


# ---------------------------------------------------------------------------
# Transaction lookup + value helpers
# ---------------------------------------------------------------------------

def _find_tx_by_bill_ref(bill_ref):
    if not bill_ref:
        return None
    name = frappe.db.get_value(
        "Payment Transaction", {"telebirr_bill_ref": str(bill_ref).strip()}, "name"
    )
    if not name:
        return None
    return frappe.db.get_value("Payment Transaction", name, _TX_FIELDS, as_dict=True)


def _c2b_state(tx):
    """Effective C2B state, tolerant of rows created before the state field
    existed and of completion via any other code path (status == Completed)."""
    if (tx.get("status") or "") == "Completed":
        return STATE_COMPLETED
    return tx.get("telebirr_c2b_state") or STATE_PENDING


def _money(value):
    """Two-decimal ETB string, as the CPS expects (ISD: e.g. 5000.00)."""
    try:
        return "{0:.2f}".format(float(value))
    except (TypeError, ValueError):
        return "0.00"


def _amount_matches(got, expected):
    try:
        return abs(float(got) - float(expected)) < 0.01
    except (TypeError, ValueError):
        return False


def _expired(tx):
    """True if a still-Pending bill's payment window (expiry_time) has passed.

    Only meaningful for Pending bills; an Authorized/Completed bill never
    "expires" because the money has already moved.
    """
    exp = tx.get("expiry_time")
    if not exp:
        return False
    if isinstance(exp, str):
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                exp = datetime.strptime(exp, fmt)
                break
            except ValueError:
                continue
        else:
            return False
    return datetime.now() > exp


# ---------------------------------------------------------------------------
# Inbound endpoint  (single URL; dispatches by SOAP root element)
# ---------------------------------------------------------------------------

def _respond_xml(xml_text):
    """Emit raw SOAP XML (text/xml) instead of Frappe's default JSON.

    Uses the "download" response type (Frappe's as_raw), which honours our
    content_type; display_content_as="inline" keeps it a normal body, not an
    attachment. content_type is the bare mimetype ("text/xml") because
    Frappe/werkzeug appends "; charset=utf-8" itself (passing the charset here
    doubles it).
    """
    frappe.local.response["type"] = "download"
    frappe.local.response["filecontent"] = xml_text.encode("utf-8")
    frappe.local.response["content_type"] = "text/xml"
    frappe.local.response["filename"] = "c2b.xml"
    frappe.local.response["display_content_as"] = "inline"


@frappe.whitelist(allow_guest=True, methods=["POST"])
def c2b():
    """Single inbound endpoint the CPS calls for all three C2B operations."""
    from lms.lms.telebirr_c2b_xml import (
        parse_request, SoapParseError, build_query_error, build_confirmation_result,
    )

    if not _ip_allowed():
        _log("ip_rejected", {"ip": _client_ip()}, level="warning")
        _respond_xml(build_confirmation_result("0"))  # opaque ack; do not leak
        return

    raw = ""
    try:
        raw = frappe.request.get_data(as_text=True)
    except Exception:
        pass

    try:
        parsed = parse_request(raw)
    except SoapParseError as exc:
        _log("parse_error", {"error": str(exc), "raw": (raw or "")[:500]}, level="error")
        _respond_xml(build_query_error(ERR_INTERNAL, "Bad request"))
        return

    handlers = {
        "query": _handle_query,
        "validation": _handle_validation,
        "confirmation": _handle_confirmation,
    }
    handler = handlers.get(parsed["msg_type"])
    try:
        xml_out = handler(parsed)
    except Exception:
        frappe.db.rollback()
        _log("handler_exception",
             {"type": parsed["msg_type"], "tb": frappe.get_traceback()}, level="error")
        xml_out = _error_for(parsed["msg_type"], ERR_INTERNAL, "Internal error")

    _respond_xml(xml_out)


def _error_for(msg_type, code, desc):
    from lms.lms.telebirr_c2b_xml import (
        build_query_error, build_validation_result, build_confirmation_result,
    )
    if msg_type == "query":
        return build_query_error(code, desc)
    if msg_type == "validation":
        return build_validation_result(result_code=code, result_desc=desc)
    return build_confirmation_result("0")  # free text; never signal failure


# ---------------------------------------------------------------------------
# 1. C2BPaymentQuery  (ISD 5.2)  -> show the payer the bill
# ---------------------------------------------------------------------------

def _handle_query(parsed):
    from lms.lms.telebirr_c2b_xml import build_query_result, build_query_error

    f = parsed["fields"]
    cps_trans_id = f.get("TransID", "")
    bill_ref = f.get("BillRefNumber", "")

    if not _short_code_ok(f.get("BusinessShortCode")):
        return build_query_error(ERR_BAD_SHORTCODE, "Invalid short code", cps_trans_id, bill_ref)

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        return build_query_error(ERR_BILL_NOT_FOUND, "Bill not found", cps_trans_id, bill_ref)

    state = _c2b_state(tx)
    if state == STATE_COMPLETED:
        return build_query_error(ERR_ALREADY_PAID, "Bill already paid", cps_trans_id, bill_ref)
    if state == STATE_PENDING and _expired(tx):
        return build_query_error(ERR_EXPIRED, "Bill expired", cps_trans_id, bill_ref)
    # Pending or Authorized -> the bill is payable; show it.

    customer = frappe.db.get_value("User", tx.user, "full_name") or tx.user
    _log("query_ok", {"bill_ref": bill_ref, "tx": tx.transaction_id, "state": state})
    return build_query_result(
        result_code=RESULT_OK, result_desc="Success",
        trans_id=cps_trans_id, bill_ref=bill_ref,
        utility_name=_utility_name(),
        customer_name=customer,
        amount=_money(tx.amount),
    )


# ---------------------------------------------------------------------------
# 2. C2BPaymentValidation  (ISD 5.3)  -> authorise; ResultCode 0 == "debit now"
# ---------------------------------------------------------------------------

def _handle_validation(parsed):
    from lms.lms.telebirr_c2b_xml import build_validation_result

    f = parsed["fields"]
    cps_trans_id = (f.get("TransID") or "").strip()
    bill_ref = f.get("BillRefNumber", "")
    msisdn = f.get("MSISDN", "")

    def _ok(tx):
        return build_validation_result(
            result_code=RESULT_OK, result_desc="Success",
            third_party_trans_id=tx.transaction_id,
        )

    if not _auth_configured():
        _log("validation_not_configured", {"bill_ref": bill_ref}, level="error")
        return build_validation_result(result_code=ERR_BAD_SHORTCODE, result_desc="Biller not configured")
    if not _short_code_ok(f.get("BusinessShortCode")):
        return build_validation_result(result_code=ERR_BAD_SHORTCODE, result_desc="Invalid short code")

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        return build_validation_result(result_code=ERR_BILL_NOT_FOUND, result_desc="Bill not found")

    state = _c2b_state(tx)
    existing_cps = (tx.get("telebirr_cps_trans_id") or "").strip()

    # Idempotency: the CPS may retry Validation. A retry from the SAME CPS TransID
    # is a success ack; a DIFFERENT CPS TransID against an already
    # authorised/paid bill is a second payment attempt -> reject.
    if state in (STATE_AUTHORIZED, STATE_COMPLETED):
        if existing_cps and cps_trans_id and existing_cps == cps_trans_id:
            return _ok(tx)
        return build_validation_result(
            result_code=(ERR_ALREADY_PAID if state == STATE_COMPLETED else ERR_IN_PROGRESS),
            result_desc=("Bill already paid" if state == STATE_COMPLETED else "Payment already in progress"),
        )

    # Pending path.
    if _expired(tx):
        return build_validation_result(result_code=ERR_EXPIRED, result_desc="Bill expired")
    if not _amount_matches(f.get("TransAmount"), tx.amount):
        _log("validation_amount_mismatch",
             {"bill_ref": bill_ref, "expected": tx.amount, "got": f.get("TransAmount")}, level="warning")
        return build_validation_result(result_code=ERR_AMOUNT_MISMATCH, result_desc="Amount mismatch")

    # Authorise: from here the CPS will debit the customer and credit us. Persist
    # everything the reconciliation path needs, fast (no email/enrolment here so
    # we stay well under the ~5 s ISD E6 window).
    frappe.db.set_value("Payment Transaction", tx.name, {
        "telebirr_c2b_state": STATE_AUTHORIZED,
        "telebirr_cps_trans_id": cps_trans_id,
        "telebirr_msisdn": msisdn,
        "telebirr_paid_amount": _money(f.get("TransAmount")),
        "telebirr_authorized_at": now_datetime(),
        "provider_reference": cps_trans_id,
    }, update_modified=True)
    frappe.db.commit()
    _log("validation_ok", {"bill_ref": bill_ref, "tx": tx.transaction_id, "cps_trans_id": cps_trans_id})
    return _ok(tx)


# ---------------------------------------------------------------------------
# 3. C2BPaymentConfirmation  (ISD 5.4)  -> money moved; complete + grant access
# ---------------------------------------------------------------------------

def _handle_confirmation(parsed):
    """The result is free text the CPS only logs (ISD 5.4.2), so we ALWAYS ack
    "0" and handle any internal error via logs + reconciliation — the debit has
    already happened, so signalling failure here would be wrong."""
    from lms.lms.telebirr_c2b_xml import build_confirmation_result

    f = parsed["fields"]
    cps_trans_id = (f.get("TransID") or "").strip()
    bill_ref = f.get("BillRefNumber", "")
    msisdn = f.get("MSISDN", "")
    trans_amount = f.get("TransAmount")

    if not _auth_configured():
        _log("confirm_not_configured", {"bill_ref": bill_ref}, level="error")
        return build_confirmation_result("0")  # ack, but never complete unconfigured
    if not _short_code_ok(f.get("BusinessShortCode")):
        _log("confirm_bad_shortcode",
             {"bill_ref": bill_ref, "short_code": f.get("BusinessShortCode")}, level="error")
        return build_confirmation_result("0")

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        _log("confirm_no_tx", {"bill_ref": bill_ref, "cps_trans_id": cps_trans_id}, level="error")
        return build_confirmation_result("0")

    if _c2b_state(tx) == STATE_COMPLETED:
        return build_confirmation_result("0")  # idempotent

    # Defense-in-depth: a Confirmation on a still-Pending bill never passed the
    # Validation amount-gate, so verify the amount before granting access. (An
    # Authorized bill was already amount-checked at Validation.) Always ack "0".
    if _c2b_state(tx) == STATE_PENDING and trans_amount and not _amount_matches(trans_amount, tx.amount):
        _log("confirm_amount_mismatch",
             {"bill_ref": bill_ref, "expected": tx.amount, "got": trans_amount}, level="error")
        return build_confirmation_result("0")

    _complete_transaction(tx.name, cps_trans_id=cps_trans_id, msisdn=msisdn,
                          amount=trans_amount, source="confirmation")
    return build_confirmation_result("0")


# ---------------------------------------------------------------------------
# Completion (shared by Confirmation + reconciliation)  -> grant access
# ---------------------------------------------------------------------------

def _complete_transaction(tx_name, *, cps_trans_id="", msisdn="", amount=None, source="confirmation"):
    """Mark a bill Completed and grant course access. Idempotent + safe to call
    concurrently from the Confirmation handler and the reconciliation job.

    A MariaDB named lock serialises callers so two concurrent Confirmation
    retries (or a Confirmation racing the reconcile job) cannot both fulfil the
    same bill (e.g. send two receipt emails)."""
    lock = ("telebirr_c2b_" + str(tx_name))[:64]
    got = frappe.db.sql("SELECT GET_LOCK(%s, 10)", (lock,))
    if not got or not got[0][0]:
        _log("complete_lock_busy", {"tx": tx_name}, level="warning")
        return
    try:
        row = frappe.db.get_value(
            "Payment Transaction", tx_name,
            ["status", "telebirr_c2b_state", "transaction_id"], as_dict=True
        ) or {}
        if (row.get("status") == "Completed") or (row.get("telebirr_c2b_state") == STATE_COMPLETED):
            return  # already done

        fields = {"telebirr_c2b_state": STATE_COMPLETED}
        if cps_trans_id:
            fields["telebirr_cps_trans_id"] = cps_trans_id
            fields["provider_reference"] = cps_trans_id
        if msisdn:
            fields["telebirr_msisdn"] = msisdn
        if amount is not None:
            fields["telebirr_paid_amount"] = _money(amount)
        frappe.db.set_value("Payment Transaction", tx_name, fields, update_modified=True)

        try:
            # Shared chokepoint after every provider: grants Course Access and
            # sends the receipt email.
            from lms.lms.payments_api import _process_successful_payment
            _process_successful_payment(tx_name)
            frappe.db.commit()
            _log("completed", {"tx": row.get("transaction_id") or tx_name,
                               "cps_trans_id": cps_trans_id, "source": source})
        except Exception:
            frappe.db.rollback()
            # Only demote back to Authorized if the completion did NOT durably
            # land (a mid-commit failure can leave status=Completed + access
            # granted; demoting that to Authorized would falsely resurface it in
            # reconciliation forever).
            if frappe.db.get_value("Payment Transaction", tx_name, "status") != "Completed":
                frappe.db.set_value("Payment Transaction", tx_name,
                                    "telebirr_c2b_state", STATE_AUTHORIZED, update_modified=False)
                frappe.db.commit()
            _log("complete_error", {"tx": tx_name, "tb": frappe.get_traceback()}, level="error")
    finally:
        frappe.db.sql("SELECT RELEASE_LOCK(%s)", (lock,))


# ---------------------------------------------------------------------------
# Reconciliation (ISD E6: Validation OK but Confirmation lost/late)
# ---------------------------------------------------------------------------

def _stuck_authorized(grace_minutes=None, limit=200):
    cutoff = now_datetime() - timedelta(minutes=grace_minutes or _grace_minutes())
    return frappe.db.get_all(
        "Payment Transaction",
        filters={"telebirr_c2b_state": STATE_AUTHORIZED,
                 "telebirr_authorized_at": ["<=", cutoff]},
        fields=["name", "transaction_id", "user", "course_title", "amount",
                "telebirr_bill_ref", "telebirr_cps_trans_id", "telebirr_authorized_at"],
        order_by="telebirr_authorized_at asc",
        limit=limit,
    )


def scheduled_reconcile_authorized():
    """Scheduler entry point. Bills that were Authorised (money moved per ISD
    step 8) but never Confirmed are either auto-completed (if the merchant trusts
    Validation == paid) or an admin is alerted to reconcile against the telebirr
    merchant statement (ISD E6 "offline reconciliation")."""
    if not frappe.db.has_column("Payment Transaction", "telebirr_c2b_state"):
        return
    stuck = _stuck_authorized()
    if not stuck:
        frappe.cache().delete_value(ALERT_THROTTLE_KEY)
        return

    if _bool_conf("telebirr_c2b_auto_complete_authorized", default=False):
        for row in stuck:
            _complete_transaction(row.name, cps_trans_id=row.get("telebirr_cps_trans_id") or "",
                                  source="reconcile_auto")
        _log("reconcile_auto_completed", {"count": len(stuck)})
        return

    _alert_stuck(stuck)


def _alert_stuck(stuck):
    if frappe.cache().get_value(ALERT_THROTTLE_KEY):
        return
    recipients = _admin_recipients()
    if recipients:
        lines = "".join(
            "<li>{0} — {1} ETB — bill ref {2} — CPS {3}</li>".format(
                r.get("transaction_id"), r.get("amount"), r.get("telebirr_bill_ref"),
                r.get("telebirr_cps_trans_id") or "?")
            for r in stuck[:50]
        )
        try:
            frappe.sendmail(
                recipients=recipients,
                subject="[telebirr] {0} payment(s) awaiting reconciliation".format(len(stuck)),
                message=(
                    "<p>{0} telebirr Pay Bill payment(s) were authorised (the customer was "
                    "charged) but no confirmation arrived, so course access is pending.</p>"
                    "<p>Check the telebirr merchant statement and complete each verified "
                    "payment with <code>telebirr_c2b_complete_transaction</code>.</p>"
                    "<ul>{1}</ul>"
                ).format(len(stuck), lines),
                now=True,
            )
        except Exception as exc:
            _log("stuck_alert_failed", {"error": str(exc)}, level="warning")
    frappe.cache().set_value(ALERT_THROTTLE_KEY, 1, expires_in_sec=ALERT_THROTTLE_SEC)
    _log("reconcile_alert", {"count": len(stuck)})


def _admin_recipients():
    configured = _conf("telebirr_c2b_alert_email")
    if configured:
        return [e.strip() for e in str(configured).split(",") if e.strip()]
    managers = frappe.get_all(
        "Has Role", filters={"role": "System Manager", "parenttype": "User"}, pluck="parent")
    emails = []
    for u in set(managers):
        if u in ("Administrator", "Guest"):
            continue
        row = frappe.db.get_value("User", u, ["email", "enabled"], as_dict=True)
        if row and row.enabled and row.email:
            emails.append(row.email)
    return emails or ["administrator@deltaspmu.com"]


# ---------------------------------------------------------------------------
# Bill-reference generation  (used by payments_api.initiate_payment)
# ---------------------------------------------------------------------------

def generate_bill_ref():
    """Return a short, unique numeric bill reference for telebirr Pay Bill.

    8 digits, no leading zero — easy to key into the telebirr app and large
    enough (~9e7 values) that the IP-allow-listed CPS won't collide. The real
    access control is the IP allow-list + short-code + amount match, not the
    secrecy of this reference.
    """
    for _attempt in range(25):
        ref = str(random.randint(10_000_000, 99_999_999))
        if not frappe.db.exists("Payment Transaction", {"telebirr_bill_ref": ref}):
            return ref
    return str(random.randint(100_000_000, 999_999_999))


# ---------------------------------------------------------------------------
# One-time setup  (run via: bench --site <site> execute
#   lms.lms.telebirr_c2b.setup_telebirr_c2b_custom_fields)
# ---------------------------------------------------------------------------

def setup_telebirr_c2b_custom_fields():
    """Idempotently add the C2B fields to Payment Transaction + register the
    reconciliation scheduler."""
    from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

    fields = {
        "Payment Transaction": [
            {"fieldname": "telebirr_c2b_section", "label": "telebirr Pay Bill (C2B)",
             "fieldtype": "Section Break", "insert_after": "status", "collapsible": 1},
            {"fieldname": "telebirr_bill_ref", "label": "telebirr Bill Reference",
             "fieldtype": "Data", "insert_after": "telebirr_c2b_section",
             "read_only": 1, "search_index": 1,
             "description": "Reference the customer enters in telebirr Pay Bill (C2B match key)."},
            {"fieldname": "telebirr_c2b_state", "label": "telebirr C2B State",
             "fieldtype": "Select", "options": "\nPending\nAuthorized\nCompleted",
             "insert_after": "telebirr_bill_ref", "read_only": 1, "search_index": 1,
             "description": "Pending -> Authorized (Validation ok, money moved) -> Completed (access granted)."},
            {"fieldname": "telebirr_cps_trans_id", "label": "telebirr CPS TransID",
             "fieldtype": "Data", "insert_after": "telebirr_c2b_state", "read_only": 1,
             "description": "The CPS-side transaction id from Validation/Confirmation."},
            {"fieldname": "telebirr_msisdn", "label": "telebirr Payer MSISDN",
             "fieldtype": "Data", "insert_after": "telebirr_cps_trans_id", "read_only": 1},
            {"fieldname": "telebirr_authorized_at", "label": "telebirr Authorized At",
             "fieldtype": "Datetime", "insert_after": "telebirr_msisdn", "read_only": 1},
            {"fieldname": "telebirr_paid_amount", "label": "telebirr Paid Amount (CPS)",
             "fieldtype": "Data", "insert_after": "telebirr_authorized_at", "read_only": 1,
             "description": "The TransAmount the CPS reported at Validation/Confirmation (for reconciliation)."},
        ],
    }
    create_custom_fields(fields, ignore_validate=True)
    frappe.db.commit()
    setup_telebirr_c2b_scheduled_jobs()
    return "telebirr_c2b custom fields created."


def setup_telebirr_c2b_scheduled_jobs():
    """Register the reconciliation job as a Scheduled Job Type (data-level, since
    this repo doesn't own the app hooks.py). Requires the site scheduler enabled."""
    if frappe.db.exists("Scheduled Job Type", {"method": RECONCILE_JOB_METHOD}):
        return RECONCILE_JOB_METHOD
    doc = frappe.get_doc({
        "doctype": "Scheduled Job Type",
        "method": RECONCILE_JOB_METHOD,
        "frequency": "Cron",
        "cron_format": "*/15 * * * *",  # every 15 minutes
        "create_log": 0,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return RECONCILE_JOB_METHOD


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

def _check_admin():
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(_("Only System Managers can perform this action."), frappe.PermissionError)


@frappe.whitelist()
def telebirr_c2b_config_status():
    """Report C2B config + readiness (admin only)."""
    _check_admin()
    return {
        "short_code_set": bool(_our_short_code()),
        "allowed_ips": _conf("telebirr_c2b_allowed_ips") or "(not set — IP check skipped)",
        "utility_name": _utility_name(),
        "auto_complete_authorized": _bool_conf("telebirr_c2b_auto_complete_authorized", default=False),
        "grace_minutes": _grace_minutes(),
        "fields_ready": frappe.db.has_column("Payment Transaction", "telebirr_c2b_state"),
        "scheduler_registered": bool(frappe.db.exists("Scheduled Job Type", {"method": RECONCILE_JOB_METHOD})),
        "endpoint": "/api/method/lms.lms.telebirr_c2b.c2b",
        "counts": {
            "authorized": frappe.db.count("Payment Transaction", {"telebirr_c2b_state": STATE_AUTHORIZED}),
            "completed": frappe.db.count("Payment Transaction", {"telebirr_c2b_state": STATE_COMPLETED}),
        },
    }


@frappe.whitelist()
def telebirr_c2b_reconciliation():
    """List bills stuck in Authorized (charged but access pending), admin only."""
    _check_admin()
    if not frappe.db.has_column("Payment Transaction", "telebirr_c2b_state"):
        return {"ready": False, "message": "Run setup_telebirr_c2b_custom_fields first."}
    stuck = _stuck_authorized(grace_minutes=0)
    for r in stuck:
        r["telebirr_authorized_at"] = str(r.get("telebirr_authorized_at") or "")
    return {"ready": True, "stuck_count": len(stuck), "stuck": stuck}


@frappe.whitelist(methods=["POST"])
def telebirr_c2b_complete_transaction(transaction_id):
    """Manually complete a reconciled telebirr payment -> grant access (admin)."""
    _check_admin()
    name = frappe.db.get_value("Payment Transaction", {"transaction_id": transaction_id}, "name")
    if not name:
        frappe.throw(_("Transaction {0} not found.").format(transaction_id), frappe.DoesNotExistError)
    _complete_transaction(name, source="manual")
    state = frappe.db.get_value("Payment Transaction", name, "telebirr_c2b_state")
    return {"transaction_id": transaction_id, "telebirr_c2b_state": state,
            "ok": state == STATE_COMPLETED}
