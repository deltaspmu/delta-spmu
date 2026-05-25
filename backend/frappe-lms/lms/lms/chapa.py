"""
Chapa Payment Gateway Integration for Delta SPMU Academy (Frappe LMS).

Chapa is an Ethiopian payment gateway supporting local methods
(telebirr, CBE, Awash) and international cards (Visa / Mastercard).

API docs: https://developer.chapa.co
"""

import frappe
import requests
import hmac
import hashlib
import json
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CHAPA_API_BASE = "https://api.chapa.co/v1"
ACCESS_DURATION_DAYS = 30
BUNDLE_ID = "all-courses-bundle"

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _get_config(key):
    """Return a value from frappe.conf, raising if missing."""
    value = frappe.conf.get(key)
    if not value:
        frappe.throw(f"Missing site config key: {key}")
    return value


def _log_chapa_event(event_type, data):
    """Persist a Chapa event to the Frappe error log for debugging."""
    frappe.log_error(
        title=f"Chapa | {event_type}",
        message=json.dumps(data, indent=2, default=str),
    )


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def _chapa_request(method, path, data=None, params=None):
    """
    Central HTTP helper for all Chapa API calls.

    Args:
        method: HTTP method (GET, POST, etc.)
        path: API path relative to CHAPA_API_BASE (e.g. "/transaction/initialize")
        data: JSON body for POST/PUT requests
        params: Query parameters for GET requests

    Returns:
        Parsed JSON response body.

    Raises:
        frappe.ValidationError on non-2xx responses or network errors.
    """
    secret_key = _get_config("chapa_secret_key")
    url = f"{CHAPA_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=data,
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        frappe.throw("Chapa API request timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        frappe.throw("Could not connect to Chapa API. Please try again later.")
    except requests.exceptions.HTTPError as exc:
        body = {}
        try:
            body = exc.response.json()
        except Exception:
            pass
        _log_chapa_event("api_error", {
            "status_code": exc.response.status_code,
            "url": url,
            "response": body,
        })
        message = body.get("message", str(exc))
        frappe.throw(f"Chapa API error: {message}")


# ---------------------------------------------------------------------------
# 1. Initialize Transaction
# ---------------------------------------------------------------------------

@frappe.whitelist()
def initialize_transaction(transaction_doc, currency="ETB"):
    """
    Initialize a Chapa payment checkout session.

    Args:
        transaction_doc: Name (ID) of our Payment Transaction doctype.
        currency: "ETB" (default) or "USD" for international payments.

    Returns:
        dict with ``checkout_url`` and ``tx_ref``.
    """
    txn = frappe.get_doc("Payment Transaction", transaction_doc)
    course = frappe.get_doc("LMS Course", txn.course) if txn.course and txn.course != BUNDLE_ID else None
    student = frappe.get_doc("User", txn.user)

    callback_url = _get_config("chapa_callback_url")
    return_url = _get_config("chapa_return_url")

    payload = {
        "amount": str(txn.amount),
        "currency": currency,
        "email": student.email,
        "first_name": student.first_name or "",
        "last_name": student.last_name or "",
        "tx_ref": txn.name,
        "callback_url": callback_url,
        "return_url": return_url,
        "customization": {
            "title": "Delta SPMU Academy",
            "description": (course.title if course else "All Courses Bundle"),
            "logo": "https://learn.deltaspmu.com/assets/logo.png",
        },
    }

    if txn.phone:
        payload["phone_number"] = txn.phone

    # For international (USD) payments, attach subaccount if configured
    if currency == "USD":
        subaccount = frappe.conf.get("chapa_usd_subaccount")
        if subaccount:
            payload["subaccount"] = {"id": subaccount}

    _log_chapa_event("initialize_request", payload)

    result = _chapa_request("POST", "/transaction/initialize", data=payload)

    checkout_url = result.get("data", {}).get("checkout_url")
    if not checkout_url:
        frappe.throw("Chapa did not return a checkout URL.")

    # Persist the checkout URL on the transaction for reference
    frappe.db.set_value("Payment Transaction", txn.name, "checkout_url", checkout_url)
    frappe.db.commit()

    _log_chapa_event("initialize_success", {
        "tx_ref": txn.name,
        "checkout_url": checkout_url,
    })

    return {"checkout_url": checkout_url, "tx_ref": txn.name, "reference": txn.name}


# ---------------------------------------------------------------------------
# 2. Verify Transaction
# ---------------------------------------------------------------------------

@frappe.whitelist()
def verify_transaction(tx_ref):
    """
    Verify a Chapa payment by its transaction reference.

    Args:
        tx_ref: The tx_ref we sent during initialization (our Payment Transaction name).

    Returns:
        dict with ``status`` and ``data`` sub-dict containing amount, currency,
        payment_method, and reference.
    """
    result = _chapa_request("GET", f"/transaction/verify/{tx_ref}")

    status = result.get("status")
    data = result.get("data", {})

    parsed = {
        "status": data.get("status", status),
        "data": {
            "amount": data.get("amount"),
            "currency": data.get("currency"),
            "payment_method": data.get("payment_method"),
            "reference": data.get("reference"),
            "tx_ref": data.get("tx_ref", tx_ref),
            "created_at": data.get("created_at"),
        },
    }

    _log_chapa_event("verify_response", parsed)
    return parsed


# ---------------------------------------------------------------------------
# 3. Webhook Signature Verification
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload, signature):
    """
    Verify the HMAC-SHA256 signature sent by Chapa on webhook calls.

    Args:
        payload: Raw request body (bytes or str).
        signature: Value of the ``Chapa-Signature`` / ``x-chapa-signature`` header.

    Returns:
        True if the signature is valid, False otherwise.
    """
    secret = _get_config("chapa_webhook_secret")

    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    if isinstance(secret, str):
        secret = secret.encode("utf-8")

    expected = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


# ---------------------------------------------------------------------------
# 4. Process Webhook
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def process_webhook(payload=None):
    """
    Handle an incoming Chapa webhook notification.

    This endpoint is called by Chapa's servers, so it must be accessible
    without authentication (allow_guest=True).  We rely on HMAC signature
    verification instead.

    Args:
        payload: If None, reads from ``frappe.request``.

    Returns:
        dict acknowledgement or raises 403/400.
    """
    # Read raw body and signature from the request
    if payload is None:
        raw_body = frappe.request.get_data(as_text=True)
    else:
        raw_body = payload if isinstance(payload, str) else json.dumps(payload)

    signature = (
        frappe.request.headers.get("Chapa-Signature")
        or frappe.request.headers.get("x-chapa-signature")
        or ""
    )

    # Signature check
    if not verify_webhook_signature(raw_body, signature):
        _log_chapa_event("webhook_invalid_signature", {"signature": signature})
        frappe.throw("Invalid webhook signature", exc=frappe.AuthenticationError)

    data = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    _log_chapa_event("webhook_received", data)

    event_type = data.get("event", "")
    tx_ref = data.get("tx_ref") or data.get("trx_ref", "")
    status = data.get("status", "").lower()
    amount = data.get("amount")
    payment_method = data.get("payment_method", "")

    if not tx_ref:
        _log_chapa_event("webhook_missing_tx_ref", data)
        frappe.throw("Missing tx_ref in webhook payload")

    # Look up our Payment Transaction — use db.get_value for guest context
    txn_name = frappe.db.get_value(
        "Payment Transaction", {"name": tx_ref}, "name"
    )
    if not txn_name:
        _log_chapa_event("webhook_txn_not_found", {"tx_ref": tx_ref})
        frappe.throw(f"Payment Transaction {tx_ref} not found")

    if event_type == "charge.success" and status == "success":
        frappe.db.set_value("Payment Transaction", txn_name, {
            "status": "Completed",
            "payment_method": payment_method,
            "completed_at": datetime.utcnow(),
        })
        frappe.db.commit()

        # Create course enrollment(s)
        txn_doc = frappe.get_doc("Payment Transaction", txn_name)
        enrollments = create_enrollment(txn_doc)

        # Send confirmation email
        _send_confirmation_email(txn_doc)

        _log_chapa_event("webhook_success", {
            "tx_ref": tx_ref,
            "enrollments": enrollments,
        })

    elif status in ("failed", "fail"):
        frappe.db.set_value("Payment Transaction", txn_name, {
            "status": "Failed",
            "payment_method": payment_method,
        })
        frappe.db.commit()

        _log_chapa_event("webhook_failed", {"tx_ref": tx_ref, "status": status})

    else:
        # Pending or unknown — log but do not change state
        _log_chapa_event("webhook_unhandled", {
            "tx_ref": tx_ref,
            "event": event_type,
            "status": status,
        })

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 5. Create Enrollment
# ---------------------------------------------------------------------------

def create_enrollment(transaction):
    """
    Grant course access after a successful payment.

    For single-course purchases a single Course Access record is created.
    For bundle purchases (``BUNDLE_ID``), access to all four courses is granted.

    Args:
        transaction: A Payment Transaction Frappe doc (or dict-like).

    Returns:
        List of created Course Access document names.
    """
    student = transaction.user
    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=ACCESS_DURATION_DAYS)
    created = []

    # Bundle is signaled by course == BUNDLE_ID in the Payment Transaction
    if transaction.course == BUNDLE_ID:
        courses = frappe.get_all("LMS Course", filters={"published": 1}, pluck="name")
    else:
        courses = [transaction.course]

    for course_name in courses:
        # Avoid duplicate access records
        existing = frappe.db.get_value(
            "Course Access",
            {"user": student, "course": course_name, "is_active": 1},
            "name",
        )
        if existing:
            # Extend the existing access window
            frappe.db.set_value("Course Access", existing, "access_end", end_date)
            created.append(existing)
            continue

        access_doc = frappe.get_doc({
            "doctype": "Course Access",
            "user": student,
            "course": course_name,
            "payment_transaction": transaction.name,
            "access_start": start_date,
            "access_end": end_date,
            "is_active": 1,
        })
        access_doc.insert(ignore_permissions=True)
        created.append(access_doc.name)

        # Create the LMS Enrollment record so the student appears in the course
        if not frappe.db.exists("LMS Enrollment", {"member": student, "course": course_name}):
            frappe.get_doc({
                "doctype": "LMS Enrollment",
                "member": student,
                "course": course_name,
            }).insert(ignore_permissions=True)

    frappe.db.commit()
    return created


# ---------------------------------------------------------------------------
# 6. Get Banks
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_banks():
    """
    Return a list of banks supported by Chapa for transfers and subaccounts.

    Returns:
        list of bank dicts (id, name, etc.).
    """
    result = _chapa_request("GET", "/banks")
    return result.get("data", [])


# ---------------------------------------------------------------------------
# 7. Create Subaccount
# ---------------------------------------------------------------------------

@frappe.whitelist()
def create_subaccount(
    bank_code,
    account_number,
    business_name,
    split_type="percentage",
    split_value=None,
):
    """
    Create a split-payment subaccount on Chapa (for future use).

    Args:
        bank_code: Chapa bank code (from ``get_banks()``).
        account_number: Merchant bank account number.
        business_name: Display name for the subaccount.
        split_type: ``"percentage"`` or ``"flat"``.
        split_value: Numeric split value (e.g. 2.5 for 2.5 %).

    Returns:
        dict with subaccount details from Chapa.
    """
    payload = {
        "business_name": business_name,
        "account_name": business_name,
        "bank_code": bank_code,
        "account_number": account_number,
        "split_type": split_type,
    }
    if split_value is not None:
        payload["split_value"] = split_value

    result = _chapa_request("POST", "/subaccount", data=payload)
    _log_chapa_event("subaccount_created", result)
    return result.get("data", result)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _send_confirmation_email(transaction):
    """Send a payment-success email to the student."""
    try:
        from lms.lms.email_templates import payment_success
        from lms.lms.payments_api import ACCESS_DURATION_DAYS

        student_email = frappe.db.get_value("User", transaction.user, "email")
        student_name = (
            frappe.db.get_value("User", transaction.user, "full_name") or transaction.user
        )

        course_title = ""
        if transaction.course == BUNDLE_ID:
            course_title = "All Courses Bundle"
        elif transaction.course:
            course_title = frappe.db.get_value(
                "LMS Course", transaction.course, "title"
            ) or transaction.course

        frappe.sendmail(
            recipients=[student_email],
            subject="Payment Confirmed — Delta SPMU Academy",
            message=payment_success(
                student_name=student_name,
                course_title=course_title,
                amount=float(transaction.amount or 0),
                currency=transaction.currency or "ETB",
                tx_id=transaction.name,
                access_days=ACCESS_DURATION_DAYS,
            ),
            now=True,
        )
    except Exception:
        _log_chapa_event("email_send_failed", {
            "tx_ref": transaction.name,
            "student": transaction.user,
        })
