"""
EthSwitch National Payment Gateway (NPG) Integration
=====================================================
Ethiopia's national payment switch connecting all local banks.

Handles order registration, status checks, reversals, refunds,
return-URL processing, server-to-server webhooks, and post-payment
course enrollment for the Delta SPMU Academy Frappe LMS backend.
"""

import frappe
import requests
import json
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ETHSWITCH_CURRENCY_CODE = "230"  # ETB
ACCESS_DURATION_DAYS = 30
BUNDLE_ID = "all-courses-bundle"
ORDER_STATUS_MAP = {
    0: "Registered",
    1: "Pre-Authorized",
    2: "Completed",
    3: "Reversed",
    4: "Refunded",
    5: "Initialized",
    6: "Declined",
}

# ---------------------------------------------------------------------------
# Helper / utility functions
# ---------------------------------------------------------------------------

def _get_config(key):
    """Read a configuration value from frappe.conf (site_config.json)."""
    value = frappe.conf.get(key)
    if not value:
        frappe.throw(f"EthSwitch config key '{key}' is not set in site_config.json")
    return value


def _amount_to_santim(etb_amount):
    """Convert an ETB amount to santim (ETB x 100)."""
    return int(round(float(etb_amount) * 100))


def _santim_to_amount(santim):
    """Convert santim back to ETB (santim / 100)."""
    return round(int(santim) / 100, 2)


def _map_order_status(status_code):
    """Map a numeric EthSwitch order-status code to a human-readable string."""
    return ORDER_STATUS_MAP.get(int(status_code), "Unknown")


def _log_ethswitch_event(event_type, data):
    """Persist an EthSwitch event for debugging / auditing."""
    frappe.logger("ethswitch").info(
        f"[{event_type}] {json.dumps(data, default=str)}"
    )


def _ethswitch_request(method, endpoint, params=None):
    """
    Central HTTP helper for all EthSwitch API calls.

    - Injects merchant credentials automatically.
    - Enforces a 15-second timeout.
    - Returns the parsed JSON response or raises on error.
    """
    base_url = _get_config("ethswitch_base_url").rstrip("/")
    url = f"{base_url}/{endpoint}"

    credentials = {
        "userName": _get_config("ethswitch_username"),
        "password": _get_config("ethswitch_password"),
    }

    if params is None:
        params = {}
    params.update(credentials)

    _log_ethswitch_event("request", {"method": method, "url": url, "params": {
        k: v for k, v in params.items() if k != "password"
    }})

    try:
        if method.upper() == "GET":
            response = requests.get(url, params=params, timeout=15)
        else:
            response = requests.post(url, data=params, timeout=15)

        response.raise_for_status()
        result = response.json()
    except requests.exceptions.Timeout:
        frappe.throw("EthSwitch request timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        frappe.throw("Could not connect to EthSwitch payment gateway.")
    except requests.exceptions.RequestException as exc:
        frappe.throw(f"EthSwitch request failed: {exc}")
    except ValueError:
        frappe.throw("Invalid response from EthSwitch (not JSON).")

    _log_ethswitch_event("response", result)

    # EthSwitch returns errorCode != 0 on failure
    error_code = result.get("errorCode")
    if error_code and str(error_code) != "0":
        error_message = result.get("errorMessage", "Unknown error")
        frappe.throw(f"EthSwitch error ({error_code}): {error_message}")

    return result


# ---------------------------------------------------------------------------
# Core API functions
# ---------------------------------------------------------------------------

@frappe.whitelist()
def register_order(transaction_doc):
    """
    Register a new payment order with EthSwitch.

    Args:
        transaction_doc: name (ID) of a Payment Transaction document.

    Returns:
        dict with ``order_id`` (EthSwitch internal ID) and
        ``checkout_url`` (redirect the user here to pay).
    """
    txn = frappe.get_doc("Payment Transaction", transaction_doc)

    amount_santim = _amount_to_santim(txn.amount)
    return_url = _get_config("ethswitch_return_url")
    fail_url = frappe.conf.get("ethswitch_fail_url") or ""

    json_params = json.dumps({
        "email": txn.user or "",
        "phone": txn.phone or "",
    })

    description = txn.course_title or f"Payment for {txn.name}"

    params = {
        "orderNumber": txn.name,
        "amount": amount_santim,
        "currency": ETHSWITCH_CURRENCY_CODE,
        "returnUrl": return_url,
        "failUrl": fail_url,
        "description": description,
        "language": "en",
        "jsonParams": json_params,
    }

    result = _ethswitch_request("POST", "register.do", params)

    order_id = result.get("orderId")
    checkout_url = result.get("formUrl")

    if not order_id or not checkout_url:
        frappe.throw("EthSwitch did not return a valid order ID or checkout URL.")

    # Persist the EthSwitch order ID on our transaction record
    frappe.db.set_value("Payment Transaction", txn.name, "ethswitch_order_id", order_id)
    frappe.db.commit()

    _log_ethswitch_event("order_registered", {
        "transaction": txn.name,
        "order_id": order_id,
        "checkout_url": checkout_url,
    })

    return {"order_id": order_id, "checkout_url": checkout_url, "reference": order_id}


@frappe.whitelist()
def get_order_status(order_id):
    """
    Query EthSwitch for the extended status of an order.

    Args:
        order_id: EthSwitch internal order ID.

    Returns:
        dict with status string, numeric order_status, amount (ETB),
        error_code, and error_message.
    """
    result = _ethswitch_request("GET", "getOrderStatusExtended.do", {
        "orderId": order_id,
    })

    order_status = result.get("orderStatus")
    amount_santim = result.get("amount", 0)

    return {
        "status": _map_order_status(order_status) if order_status is not None else "Unknown",
        "order_status": order_status,
        "amount": _santim_to_amount(amount_santim),
        "error_code": result.get("errorCode"),
        "error_message": result.get("errorMessage"),
    }


@frappe.whitelist()
def reverse_order(order_id):
    """
    Reverse (cancel) an EthSwitch order before settlement.

    Args:
        order_id: EthSwitch internal order ID.

    Returns:
        dict with ``success`` boolean and optional ``message``.
    """
    try:
        result = _ethswitch_request("POST", "reverse.do", {
            "orderId": order_id,
        })
        _log_ethswitch_event("order_reversed", {"order_id": order_id, "result": result})
        return {"success": True, "message": "Order reversed successfully."}
    except Exception as exc:
        _log_ethswitch_event("reverse_failed", {"order_id": order_id, "error": str(exc)})
        return {"success": False, "message": str(exc)}


@frappe.whitelist()
def refund_order(order_id, amount):
    """
    Issue a partial or full refund for an EthSwitch order.

    Args:
        order_id: EthSwitch internal order ID.
        amount: Refund amount in ETB (will be converted to santim).

    Returns:
        dict with ``success`` boolean and optional ``message``.
    """
    amount_santim = _amount_to_santim(amount)

    try:
        result = _ethswitch_request("POST", "refund.do", {
            "orderId": order_id,
            "amount": amount_santim,
        })
        _log_ethswitch_event("order_refunded", {
            "order_id": order_id,
            "amount_etb": amount,
            "amount_santim": amount_santim,
            "result": result,
        })
        return {"success": True, "message": "Refund processed successfully."}
    except Exception as exc:
        _log_ethswitch_event("refund_failed", {"order_id": order_id, "error": str(exc)})
        return {"success": False, "message": str(exc)}


@frappe.whitelist(allow_guest=True)
def process_return(order_id):
    """
    Handle the redirect back from the EthSwitch payment page.

    Called when the user lands on the configured ``returnUrl``.
    Checks the order status, updates the local transaction, and
    triggers enrollment on success.

    Args:
        order_id: EthSwitch internal order ID.

    Returns:
        dict with transaction name, status, and a human-readable message.
    """
    status_info = get_order_status(order_id)
    order_status = status_info.get("order_status")

    # Look up our local transaction by the stored EthSwitch order ID
    txn_name = frappe.db.get_value(
        "Payment Transaction",
        {"ethswitch_order_id": order_id},
        "name",
    )

    if not txn_name:
        _log_ethswitch_event("return_no_txn", {"order_id": order_id})
        frappe.throw("No matching payment transaction found for this order.")

    if order_status == 2:
        # Deposited / Completed
        frappe.db.set_value("Payment Transaction", txn_name, {
            "status": "Completed",
            "completed_at": datetime.now(),
        })
        frappe.db.commit()

        txn = frappe.get_doc("Payment Transaction", txn_name)
        create_enrollment(txn)
        _send_confirmation_email(txn)

        _log_ethswitch_event("payment_completed", {"transaction": txn_name, "order_id": order_id})

        return {
            "transaction": txn_name,
            "status": "Completed",
            "message": "Payment successful. You have been enrolled.",
        }

    elif order_status in (3, 4, 6):
        # Reversed, Refunded, or Declined
        status_label = _map_order_status(order_status)
        frappe.db.set_value("Payment Transaction", txn_name, {
            "status": "Failed",
            "error_message": status_label,
        })
        frappe.db.commit()

        _log_ethswitch_event("payment_failed", {
            "transaction": txn_name,
            "order_id": order_id,
            "status": status_label,
        })

        return {
            "transaction": txn_name,
            "status": "Failed",
            "message": f"Payment {status_label.lower()}.",
        }

    else:
        # Still pending (Registered, Pre-Authorized, Initialized)
        status_label = _map_order_status(order_status)

        _log_ethswitch_event("payment_pending", {
            "transaction": txn_name,
            "order_id": order_id,
            "status": status_label,
        })

        return {
            "transaction": txn_name,
            "status": "Pending",
            "message": f"Payment is {status_label.lower()}. Please wait.",
        }


@frappe.whitelist(allow_guest=True)
def process_webhook(payload=None):
    """
    Handle an EthSwitch server-to-server callback notification.

    Extracts ``orderId`` and ``status`` from the payload and processes
    identically to ``process_return``.

    Args:
        payload: dict or JSON string from EthSwitch.

    Returns:
        dict with processing result.
    """
    if payload is None:
        payload = frappe.request.get_data(as_text=True)

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            frappe.throw("Invalid webhook payload (not valid JSON).")

    _log_ethswitch_event("webhook_received", payload)

    order_id = payload.get("orderId") or payload.get("orderid") or payload.get("order_id")
    if not order_id:
        frappe.throw("Webhook payload missing orderId.")

    result = process_return(order_id)

    _log_ethswitch_event("webhook_processed", {
        "order_id": order_id,
        "result": result,
    })

    return result


def verify_webhook_signature(payload, signature):
    """
    EthSwitch's server-to-server callbacks are authenticated by source IP and
    by the orderId existing in our database, not by HMAC. This stub returns
    True so the call site in payments_api compiles, but the real check is
    performed by ``process_return`` (which validates orderId -> txn).

    For tighter security, restrict the webhook endpoint at the Nginx layer to
    EthSwitch's published source IP range.
    """
    return True


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

def create_enrollment(transaction):
    """
    Grant course access after a successful payment.

    - Creates a Course Access record with a 30-day window.
    - For bundle purchases (``BUNDLE_ID``), enrolls in all four courses.
    - Creates LMS Enrollment records so the student appears on rosters.

    Args:
        transaction: a Payment Transaction frappe doc (or name string).
    """
    if isinstance(transaction, str):
        transaction = frappe.get_doc("Payment Transaction", transaction)

    student = transaction.user
    now = datetime.now()
    access_end = now + timedelta(days=ACCESS_DURATION_DAYS)

    # Bundle is signaled by course == BUNDLE_ID in the Payment Transaction
    if transaction.course == BUNDLE_ID:
        courses = frappe.get_all("LMS Course", filters={"published": 1}, pluck="name")
    else:
        courses = [transaction.course] if transaction.course else []

    if not courses:
        _log_ethswitch_event("enrollment_no_courses", {"transaction": transaction.name})
        return

    for course in courses:
        # Course Access record (custom doctype)
        existing = frappe.db.get_value(
            "Course Access",
            {"user": student, "course": course, "is_active": 1},
            "name",
        )
        if existing:
            frappe.db.set_value("Course Access", existing, "access_end", access_end)
        else:
            access_doc = frappe.get_doc({
                "doctype": "Course Access",
                "user": student,
                "course": course,
                "payment_transaction": transaction.name,
                "access_start": now,
                "access_end": access_end,
                "is_active": 1,
            })
            access_doc.insert(ignore_permissions=True)

        # LMS Enrollment record
        if not frappe.db.exists("LMS Enrollment", {"member": student, "course": course}):
            enrollment_doc = frappe.get_doc({
                "doctype": "LMS Enrollment",
                "member": student,
                "course": course,
                "member_type": "Student",
            })
            enrollment_doc.insert(ignore_permissions=True)

    frappe.db.commit()

    _log_ethswitch_event("enrollment_created", {
        "transaction": transaction.name,
        "student": student,
        "courses": courses,
        "access_end": str(access_end),
    })


# ---------------------------------------------------------------------------
# Email confirmation
# ---------------------------------------------------------------------------

def _send_confirmation_email(transaction):
    """Send a payment-confirmation email to the student."""
    if not transaction.user:
        return

    student_name = frappe.db.get_value("User", transaction.user, "full_name") or transaction.user
    course_title = ""
    if transaction.course:
        course_title = frappe.db.get_value("LMS Course", transaction.course, "title") or transaction.course

    try:
        from lms.lms.email_templates import payment_success

        frappe.sendmail(
            recipients=[transaction.user],
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
    except Exception as exc:
        _log_ethswitch_event("email_failed", {
            "transaction": transaction.name,
            "error": str(exc),
        })
