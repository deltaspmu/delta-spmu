"""
telebirr C2B (CPS-Biller) inbound SOAP integration for Delta SPMU Academy.

Ethio Telecom's CPS (Mobile Money System) calls THREE SOAP operations on us
(the Biller) when a customer pays our short code via telebirr "Pay Bill":

    1. C2BPaymentQuery        -> we return the bill (course + amount + names)
    2. C2BPaymentValidation   -> we authorise the payment in real time
    3. C2BPaymentConfirmation -> money has moved; we grant access + invoice

Here we are the SERVER (the opposite of the Super-App flow in telebirr.py). The
customer-facing initiation (showing the short code + bill reference) lives in
payments_api.py; this module only handles the inbound CPS calls.

Design
------
* **Match key**: BillRefNumber == Payment Transaction.telebirr_bill_ref.
* **Dispatch**: by SOAP root element (NOT TransType — see telebirr_c2b_xml).
* **Auth**: source-IP allow-list + BusinessShortCode match. The CPS sends no
  SOAP-header credentials (confirmed against the sample XML), so there is no
  login/password to validate. Both checks are config-gated and *skipped while
  unset*, so the endpoint can be self-tested before go-live, then locked down.
* **Confirmation reuses _process_successful_payment** from payments_api, so a
* **Idempotent**: a Completed transaction re-confirmed is a no-op.

Config keys (frappe.conf / site_config.json):
    telebirr_c2b_short_code    - our registered BusinessShortCode (lock-down key)
    telebirr_c2b_allowed_ips   - comma-separated CPS source IPs (optional)
    telebirr_c2b_utility_name  - merchant name shown to the payer (optional;

Endpoint URL the CPS is registered to call:
    /api/method/lms.lms.telebirr_c2b.c2b
"""

import json
from datetime import datetime

import frappe
from frappe import _

from lms.lms.telebirr_c2b_xml import (
    parse_request,
    SoapParseError,
    build_query_result,
    build_query_error,
    build_validation_result,
    build_confirmation_result,
)

# Result codes returned to the CPS. "0" == success; any other value is an error
# the CPS treats as a failure (E2/E5 in the ISD service flow).
RESULT_OK = "0"
ERR_BILL_NOT_FOUND = "1"
ERR_ALREADY_PAID = "2"
ERR_EXPIRED = "3"
ERR_AMOUNT_MISMATCH = "4"
ERR_BAD_SHORTCODE = "5"
ERR_INTERNAL = "6"

_TX_FIELDS = [
    "name", "transaction_id", "user", "course", "course_title",
    "amount", "currency", "status", "telebirr_bill_ref", "expiry_time",
]


# ---------------------------------------------------------------------------
# Config / logging helpers
# ---------------------------------------------------------------------------

def _conf(key, default=None):
    value = frappe.conf.get(key)
    return value if value not in (None, "") else default


def _our_short_code():
    return str(_conf("telebirr_c2b_short_code") or "").strip()


def _utility_name():
    return (
        _conf("telebirr_c2b_utility_name")
        or "Delta SPMU Academy"
    )


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


# ---------------------------------------------------------------------------
# Transaction lookup + value helpers
# ---------------------------------------------------------------------------

def _find_tx_by_bill_ref(bill_ref):
    if not bill_ref:
        return None
    name = frappe.db.get_value(
        "Payment Transaction", {"telebirr_bill_ref": bill_ref}, "name"
    )
    if not name:
        return None
    return frappe.db.get_value("Payment Transaction", name, _TX_FIELDS, as_dict=True)


def _money(value):
    """Two-decimal ETB string, as the CPS expects (e.g. 5000.00)."""
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
    """True if the bill's payment window (expiry_time) has passed.

    No expiry_time set -> never expired (C2B bills may be left open
    deliberately; payments_api decides the window at initiation time).
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

    Uses the "binary" response type with NO filename, so as_raw() sets our
    content_type and adds no Content-Disposition header -> a clean text/xml body.
    """
    frappe.local.response["type"] = "binary"
    frappe.local.response["filecontent"] = xml_text.encode("utf-8")
    frappe.local.response["content_type"] = "text/xml; charset=utf-8"


@frappe.whitelist(allow_guest=True, methods=["POST"])
def c2b():
    """Single inbound endpoint the CPS calls for all three C2B operations."""
    frappe.flags.ignore_csrf = True

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
        _log("handler_exception", {"type": parsed["msg_type"], "tb": frappe.get_traceback()}, level="error")
        xml_out = _error_for(parsed["msg_type"], ERR_INTERNAL, "Internal error")

    _respond_xml(xml_out)


def _error_for(msg_type, code, desc):
    if msg_type == "query":
        return build_query_error(code, desc)
    if msg_type == "validation":
        return build_validation_result(result_code=code, result_desc=desc)
    # Confirmation result is free text only logged by the CPS.
    return build_confirmation_result("0")


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def _handle_query(parsed):
    """C2BPaymentQuery -> return the bill so the CPS can show it to the payer."""
    f = parsed["fields"]
    cps_trans_id = f.get("TransID", "")
    bill_ref = f.get("BillRefNumber", "")

    if not _short_code_ok(f.get("BusinessShortCode")):
        return build_query_error(ERR_BAD_SHORTCODE, "Invalid short code", cps_trans_id, bill_ref)

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        return build_query_error(ERR_BILL_NOT_FOUND, "Bill not found", cps_trans_id, bill_ref)
    if tx.status == "Completed":
        return build_query_error(ERR_ALREADY_PAID, "Bill already paid", cps_trans_id, bill_ref)
    if tx.status != "Pending":
        return build_query_error(ERR_BILL_NOT_FOUND, "Bill not payable ({0})".format(tx.status), cps_trans_id, bill_ref)
    if _expired(tx):
        return build_query_error(ERR_EXPIRED, "Bill expired", cps_trans_id, bill_ref)

    customer = frappe.db.get_value("User", tx.user, "full_name") or tx.user
    _log("query_ok", {"bill_ref": bill_ref, "tx": tx.transaction_id})
    return build_query_result(
        result_code=RESULT_OK, result_desc="Success",
        trans_id=cps_trans_id, bill_ref=bill_ref,
        utility_name=_utility_name(), customer_name=customer,
        amount=_money(tx.amount),
    )


def _handle_validation(parsed):
    """C2BPaymentValidation -> authorise (ResultCode 0) in real time."""
    f = parsed["fields"]
    cps_trans_id = f.get("TransID", "")
    bill_ref = f.get("BillRefNumber", "")

    if not _short_code_ok(f.get("BusinessShortCode")):
        return build_validation_result(result_code=ERR_BAD_SHORTCODE, result_desc="Invalid short code")

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        return build_validation_result(result_code=ERR_BILL_NOT_FOUND, result_desc="Bill not found")
    if tx.status == "Completed":
        return build_validation_result(result_code=ERR_ALREADY_PAID, result_desc="Bill already paid")
    if tx.status != "Pending":
        return build_validation_result(result_code=ERR_BILL_NOT_FOUND, result_desc="Bill not payable")
    if _expired(tx):
        return build_validation_result(result_code=ERR_EXPIRED, result_desc="Bill expired")
    if not _amount_matches(f.get("TransAmount"), tx.amount):
        _log("validation_amount_mismatch",
             {"bill_ref": bill_ref, "expected": tx.amount, "got": f.get("TransAmount")}, level="warning")
        return build_validation_result(result_code=ERR_AMOUNT_MISMATCH, result_desc="Amount mismatch")

    # Record the CPS TransID against the transaction for reconciliation.
    if cps_trans_id:
        frappe.db.set_value("Payment Transaction", tx.name, "provider_reference", cps_trans_id)
        frappe.db.commit()
    _log("validation_ok", {"bill_ref": bill_ref, "tx": tx.transaction_id, "cps_trans_id": cps_trans_id})
    return build_validation_result(
        result_code=RESULT_OK, result_desc="Success", third_party_trans_id=tx.transaction_id
    )


def _handle_confirmation(parsed):
    """C2BPaymentConfirmation -> money has moved; complete the sale.

    The result is free text the CPS only logs, so we always ack "0" and handle
    debit/credit already happened on the CPS side).
    """
    f = parsed["fields"]
    cps_trans_id = f.get("TransID", "")
    bill_ref = f.get("BillRefNumber", "")

    if not _short_code_ok(f.get("BusinessShortCode")):
        _log("confirm_bad_shortcode", {"bill_ref": bill_ref, "short_code": f.get("BusinessShortCode")}, level="error")
        return build_confirmation_result("0")

    tx = _find_tx_by_bill_ref(bill_ref)
    if not tx:
        _log("confirm_no_tx", {"bill_ref": bill_ref, "cps_trans_id": cps_trans_id}, level="error")
        return build_confirmation_result("0")
    if tx.status == "Completed":
        return build_confirmation_result("0")  # idempotent

    if cps_trans_id:
        frappe.db.set_value("Payment Transaction", tx.name, "provider_reference", cps_trans_id)

    try:
        from lms.lms.payments_api import _process_successful_payment

        _process_successful_payment(tx.name)
        frappe.db.commit()
        _log("confirm_ok", {"bill_ref": bill_ref, "tx": tx.transaction_id, "cps_trans_id": cps_trans_id})
    except Exception:
        frappe.db.rollback()
        _log("confirm_process_error", {"bill_ref": bill_ref, "tb": frappe.get_traceback()}, level="error")

    return build_confirmation_result("0")


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
    import random

    for _attempt in range(25):
        ref = str(random.randint(10_000_000, 99_999_999))
        if not frappe.db.exists("Payment Transaction", {"telebirr_bill_ref": ref}):
            return ref
    # Pathological fallback (namespace nearly exhausted): widen to 9 digits.
    return str(random.randint(100_000_000, 999_999_999))


# ---------------------------------------------------------------------------
# One-time setup + admin status  (run via bench execute)
# ---------------------------------------------------------------------------

def setup_telebirr_c2b_custom_fields():
    """Idempotently add the bill-reference field to Payment Transaction.

    Run once:
        bench --site <site> execute lms.lms.telebirr_c2b.setup_telebirr_c2b_custom_fields
    """
    from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

    fields = {
        "Payment Transaction": [
            {
                "fieldname": "telebirr_bill_ref",
                "label": "telebirr Bill Reference",
                "fieldtype": "Data",
                "insert_after": "provider_reference",
                "read_only": 1,
                "search_index": 1,
                "description": "Reference the customer enters in telebirr Pay Bill (C2B match key).",
            },
        ],
    }
    create_custom_fields(fields, ignore_validate=True)
    frappe.db.commit()
    return "telebirr_c2b custom field created."


@frappe.whitelist()
def telebirr_c2b_config_status():
    """Report C2B config + readiness (admin only)."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(_("Only System Managers can view this."), frappe.PermissionError)
    return {
        "short_code_set": bool(_our_short_code()),
        "allowed_ips": _conf("telebirr_c2b_allowed_ips") or "(not set — IP check skipped)",
        "utility_name": _utility_name(),
        "field_ready": frappe.db.has_column("Payment Transaction", "telebirr_bill_ref"),
        "endpoint": "/api/method/lms.lms.telebirr_c2b.c2b",
    }
