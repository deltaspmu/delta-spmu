"""
Payment processing endpoints for Delta SPMU Academy LMS.

Handles course payments via Telebirr, Chapa, EthSwitch, and CBE bank transfer.
All monetary values are in ETB unless explicitly converted to USD.
"""

import frappe
import hashlib
import json
import time
from datetime import datetime, timedelta
from frappe import _

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_PRICE = 12500
ACCESS_DURATION_DAYS = 30
BUNDLE_ID = "all-courses-bundle"
BUNDLE_PRICE = 20000
# The "all courses" bundle is disabled while the catalogue is being rebuilt
# (4 courses, 2 of which are coming soon, and changed pricing). While False, the
# bundle offer is hidden everywhere (get_course_price returns
# bundle_available=False) and initiate_payment refuses the bundle product. Flip
# to True and set a sensible BUNDLE_PRICE once all courses are live.
BUNDLE_ENABLED = False
TRANSACTION_PREFIX = "DS"

# ---------------------------------------------------------------------------
# Helper utilities (not whitelisted)
# ---------------------------------------------------------------------------

def _generate_transaction_id():
    """Create a unique transaction ID in the format DS-YYYYMMDDHHMMSS-XXXXXX."""
    now = datetime.now()
    timestamp_part = now.strftime("%Y%m%d%H%M%S")
    raw = f"{timestamp_part}-{time.time()}-{frappe.generate_hash(length=12)}"
    hash_part = hashlib.sha256(raw.encode()).hexdigest()[:6].upper()
    return f"{TRANSACTION_PREFIX}-{timestamp_part}-{hash_part}"


def _check_transaction_expiry(transaction):
    """Return True if the payment window has expired.

    Prefers the per-transaction ``expiry_time`` when present (telebirr C2B uses
    a 24h window because the payer acts out-of-band in their app; cards use 30
    min). Falls back to 30 minutes from creation if ``expiry_time`` is absent,
    so behaviour is unchanged for every existing provider.

    Args:
        transaction: A dict or Document representing the Payment Transaction.

    Returns:
        bool: True when the transaction is expired.
    """
    expiry = transaction.get("expiry_time")
    if expiry:
        if isinstance(expiry, str):
            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
                try:
                    expiry = datetime.strptime(expiry, fmt)
                    break
                except ValueError:
                    continue
        if isinstance(expiry, datetime):
            return datetime.now() > expiry

    created = transaction.get("creation") or transaction.get("created_at")
    if not created:
        return True

    if isinstance(created, str):
        try:
            created = datetime.strptime(created, "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            created = datetime.strptime(created, "%Y-%m-%d %H:%M:%S")

    return datetime.now() > created + timedelta(minutes=30)


def _create_course_access(user, course, transaction_name):
    """Grant time-limited course access and enrol the learner.

    Creates a Course Access record valid for ACCESS_DURATION_DAYS and, if one
    does not already exist, an LMS Enrollment record so the learner shows up
    in the course roster.

    Args:
        user: Email address of the learner.
        course: Name (ID) of the course.
        transaction_name: Name of the originating Payment Transaction.
    """
    now = datetime.now()
    access_end = now + timedelta(days=ACCESS_DURATION_DAYS)

    # --- Course Access record ---
    # Key on user+course only (NOT docstatus): Course Access autonames
    # deterministically as CA-<user>-<course>, so a prior inactive/cancelled row
    # would make a docstatus-filtered lookup miss and the insert below collide on
    # the primary key, aborting the grant. Reviving any existing row (and forcing
    # is_active=1) ensures a renewal always restores an active window even if a
    # previous window had been auto-deactivated on expiry.
    existing_access = frappe.db.get_value(
        "Course Access",
        {"user": user, "course": course},
        "name",
    )

    if existing_access:
        # Extend (and reactivate) the existing access window. Preserve the
        # original access_start; only access_end drives has_access.
        frappe.db.set_value(
            "Course Access",
            existing_access,
            {
                "access_end": access_end,
                "payment_transaction": transaction_name,
                "is_active": 1,
                "modified": now,
            },
        )
    else:
        access_doc = frappe.get_doc(
            {
                "doctype": "Course Access",
                "user": user,
                "course": course,
                "access_start": now,
                "access_end": access_end,
                "payment_transaction": transaction_name,
                "is_active": 1,
            }
        )
        access_doc.insert(ignore_permissions=True)
        access_doc.submit()

    # --- LMS Enrollment ---
    if not frappe.db.exists("LMS Enrollment", {"member": user, "course": course}):
        enrollment = frappe.get_doc(
            {
                "doctype": "LMS Enrollment",
                "member": user,
                "course": course,
                "member_type": "Student",
            }
        )
        enrollment.insert(ignore_permissions=True)

    frappe.db.commit()


def _send_payment_confirmation(user, course, transaction):
    """Email a payment receipt to the learner.

    Args:
        user: Email address of the learner.
        course: Name (ID) of the course.
        transaction: dict with transaction details (transaction_id, amount, etc.).
    """
    from lms.lms.email_templates import payment_success

    course_title = frappe.db.get_value("LMS Course", course, "title") or course
    student_name = frappe.db.get_value("User", user, "full_name") or user
    subject = _("Payment Confirmed – {0}").format(course_title)

    try:
        frappe.sendmail(
            recipients=[user],
            subject=subject,
            message=payment_success(
                student_name=student_name,
                course_title=course_title,
                amount=float(transaction.get("amount") or 0),
                currency=transaction.get("currency") or "ETB",
                tx_id=transaction.get("transaction_id", ""),
                access_days=ACCESS_DURATION_DAYS,
            ),
            now=True,
        )
    except Exception:
        frappe.log_error(
            title="Payment Confirmation Email Failed",
            message=frappe.get_traceback(),
        )


def _process_successful_payment(transaction_name):
    """Shared logic executed after any provider confirms payment.

    Marks the transaction as Completed, creates course access, and sends the
    confirmation email.

    Args:
        transaction_name: Name (primary key) of the Payment Transaction doc.

    Returns:
        bool: True on success.
    """
    tx = frappe.db.get_value(
        "Payment Transaction",
        transaction_name,
        ["name", "user", "course", "transaction_id", "amount", "currency", "status"],
        as_dict=True,
    )

    if not tx:
        frappe.log_error(
            title="Payment Processing Error",
            message=f"Transaction {transaction_name} not found.",
        )
        return False

    if tx.status == "Completed":
        # Already processed (idempotent)
        return True

    # Mark completed
    frappe.db.set_value(
        "Payment Transaction",
        transaction_name,
        {
            "status": "Completed",
            "completed_at": datetime.now(),
        },
    )

    # Grant access
    _create_course_access(tx.user, tx.course, transaction_name)

    # Notify learner
    _send_payment_confirmation(
        tx.user,
        tx.course,
        {
            "transaction_id": tx.transaction_id,
            "amount": tx.amount,
            "currency": tx.currency,
        },
    )

    try:

    except Exception:

    return True


# ---------------------------------------------------------------------------
# 1. get_course_price  [guest, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_course_price(course, currency="ETB"):
    """Return pricing information for a course.

    Guest-safe: uses ``frappe.db.get_value`` only.

    Args:
        course: Name (ID) of the LMS Course.
        currency: ``"ETB"`` (default) or ``"USD"``.

    Returns:
        dict with original_price, discount_percent, discount_amount,
        final_price, currency, bundle_available, bundle_price.
    """
    if not course:
        frappe.throw(_("Course is required."), frappe.MandatoryError)

    # The bundle is a virtual product (no LMS Course row of its own), so price
    # it directly from BUNDLE_PRICE rather than looking it up as a course.
    if course == BUNDLE_ID:
        published_prices = frappe.get_all(
            "LMS Course", filters={"published": 1}, pluck="course_price"
        )
        individual_total = (
            float(sum(float(p or BASE_PRICE) for p in published_prices))
            if published_prices
            else float(BUNDLE_PRICE)
        )
        bundle_price_val = float(BUNDLE_PRICE)
        final_price = bundle_price_val
        discount_amount = max(0.0, round(individual_total - bundle_price_val, 2))
        discount_percent = (
            round((discount_amount / individual_total) * 100, 2)
            if individual_total
            else 0.0
        )

        if currency and currency.upper() == "USD":
            try:
                from lms.lms.exchange_rate import get_exchange_rate

                rate = get_exchange_rate(from_currency="ETB", to_currency="USD")
            except Exception:
                rate = frappe.db.get_single_value("Payment Settings", "etb_to_usd_rate") or 0.018
            rate = float(rate)
            individual_total = round(individual_total * rate, 2)
            final_price = round(final_price * rate, 2)
            discount_amount = round(discount_amount * rate, 2)
            bundle_price_val = round(bundle_price_val * rate, 2)
            currency = "USD"
        else:
            currency = "ETB"

        return {
            "original_price": individual_total,
            "discount_percent": discount_percent,
            "discount_amount": discount_amount,
            "final_price": final_price,
            "currency": currency,
            "bundle_available": True,
            "bundle_price": bundle_price_val,
        }

    # Fetch price from DB – never use frappe.get_doc() for guest endpoints
    course_price = frappe.db.get_value("LMS Course", course, "course_price")

    if course_price is None:
        # Course may not exist
        if not frappe.db.exists("LMS Course", course):
            frappe.throw(_("Course {0} not found.").format(course), frappe.DoesNotExistError)
        course_price = BASE_PRICE

    course_price = float(course_price) if course_price else float(BASE_PRICE)

    # --- Bundle logic ---
    total_courses = frappe.db.count("LMS Course", {"published": 1})
    bundle_available = BUNDLE_ENABLED and total_courses >= 2
    bundle_price_val = float(BUNDLE_PRICE)

    # Calculate per-course effective price when buying the bundle
    discount_percent = 0.0
    discount_amount = 0.0
    final_price = course_price

    if bundle_available and total_courses > 0:
        per_course_bundle = bundle_price_val / total_courses
        if per_course_bundle < course_price:
            discount_amount = round(course_price - per_course_bundle, 2)
            discount_percent = round((discount_amount / course_price) * 100, 2)

    # --- Per-course promotional discount (admin-set "Discount %") ---
    # The stored course_price IS the post-discount price actually charged. We
    # present a higher compare-at "original" price struck through — e.g. a
    # 17,000 price with Discount %=50 shows as "was 34,000, now 17,000 (50% off)".
    promo_pct = 0
    if frappe.db.has_column("LMS Course", "discount_percentage"):
        promo_pct = int(frappe.db.get_value("LMS Course", course, "discount_percentage") or 0)
    if 0 < promo_pct < 100:
        discount_percent = float(promo_pct)
        final_price = course_price
        course_price = round(course_price / (1 - promo_pct / 100.0), 2)
        discount_amount = round(course_price - final_price, 2)

    # --- Currency conversion ---
    if currency and currency.upper() == "USD":
        try:
            from lms.lms.exchange_rate import get_exchange_rate

            rate = get_exchange_rate(from_currency="ETB", to_currency="USD")
        except Exception:
            rate = frappe.db.get_single_value("Payment Settings", "etb_to_usd_rate") or 0.018

        rate = float(rate)
        course_price = round(course_price * rate, 2)
        final_price = round(final_price * rate, 2)
        discount_amount = round(discount_amount * rate, 2)
        bundle_price_val = round(bundle_price_val * rate, 2)
        currency = "USD"
    else:
        currency = "ETB"

    return {
        "original_price": course_price,
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "final_price": final_price,
        "currency": currency,
        "bundle_available": bundle_available,
        "bundle_price": bundle_price_val,
    }


# ---------------------------------------------------------------------------
# 2. initiate_payment  [auth, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist()
def initiate_payment(course, payment_method, phone=None, currency="ETB"):
    """Create a Payment Transaction and route to the chosen provider.

    Args:
        course: Name (ID) of the LMS Course.
        payment_method: One of ``"telebirr"``, ``"chapa"``,
            ``"chapa_international"``, ``"ethswitch"``, ``"cbe"``.
        phone: Phone number (required for telebirr).
        currency: ``"ETB"`` or ``"USD"``.

    Returns:
        dict with transaction_id and checkout_url (or instructions for CBE).
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in to make a payment."), frappe.AuthenticationError)

    if not course:
        frappe.throw(_("Course is required."), frappe.MandatoryError)

    # The bundle ("all-courses-bundle") is a virtual product with no LMS Course
    # row, so skip the course-existence check for it.
    is_bundle = course == BUNDLE_ID
    if not is_bundle and not frappe.db.exists("LMS Course", course):
        frappe.throw(_("Course {0} not found.").format(course), frappe.DoesNotExistError)

    # The course bundle is currently disabled (see BUNDLE_ENABLED).
    if is_bundle and not BUNDLE_ENABLED:
        frappe.throw(_("The course bundle is not available at the moment."))

    # Coming-soon courses (upcoming=1) appear in the catalogue but cannot be
    # purchased until they go live.
    if not is_bundle and frappe.db.get_value("LMS Course", course, "upcoming"):
        frappe.throw(_("This course is coming soon and cannot be purchased yet."))

    # Check for existing valid access
    existing_access = frappe.db.get_value(
        "Course Access",
        {"user": user, "course": course, "is_active": 1},
        ["access_end"],
    )
    if existing_access:
        access_end = existing_access
        if isinstance(access_end, str):
            access_end = datetime.strptime(access_end, "%Y-%m-%d %H:%M:%S")
        if access_end > datetime.now():
            frappe.throw(_("You already have active access to this course until {0}.").format(
                access_end.strftime("%B %d, %Y")
            ))

    # Check for pending transactions to avoid duplicates
    pending_tx = frappe.db.get_value(
        "Payment Transaction",
        {
            "user": user,
            "course": course,
            "status": "Pending",
        },
        ["name", "transaction_id", "creation", "expiry_time"],
        as_dict=True,
    )
    if pending_tx and not _check_transaction_expiry(pending_tx):
        # Redirect-based providers (Chapa / EthSwitch): the learner is just
        # retrying (closed the checkout tab, switched PC->mobile, re-tapped).
        # Don't block them with a 417 — supersede the stale pending attempt and
        # issue a fresh checkout below. Matches the live Afritutors reuse flow.
        if payment_method in ("chapa", "chapa_international", "ethswitch"):
            frappe.db.set_value(
                "Payment Transaction", pending_tx.name, "status", "Expired"
            )
            frappe.db.commit()
        else:
            # Instruction-based (telebirr Pay Bill / CBE): a bill/reference is
            # already outstanding, so keep the duplicate guard.
            frappe.throw(
                _("You already have a pending payment (ID: {0}). "
                  "Please complete or wait for it to expire.").format(
                    pending_tx.transaction_id
                )
            )

    # --- Resolve price ---
    if is_bundle:
        amount = float(BUNDLE_PRICE)
    else:
        # The stored course_price is the post-discount price actually charged;
        # any "Discount %" is presentational only (a higher compare-at original).
        course_price = frappe.db.get_value("LMS Course", course, "course_price")
        amount = float(course_price) if course_price else float(BASE_PRICE)

    if currency and currency.upper() == "USD":
        try:
            from lms.lms.exchange_rate import get_exchange_rate
            rate = get_exchange_rate(from_currency="ETB", to_currency="USD")
        except Exception:
            rate = frappe.db.get_single_value("Payment Settings", "etb_to_usd_rate") or 0.018
        amount = round(amount * float(rate), 2)
        currency = "USD"
    else:
        currency = "ETB"

    # --- Generate transaction ---
    transaction_id = _generate_transaction_id()
    expiry_time = datetime.now() + timedelta(minutes=30)

    course_title = "All Courses Bundle" if is_bundle else (
        frappe.db.get_value("LMS Course", course, "title") or course
    )

    tx_doc = frappe.get_doc(
        {
            "doctype": "Payment Transaction",
            "transaction_id": transaction_id,
            "user": user,
            "course": course,
            "course_title": course_title,
            "amount": amount,
            # legacy mandatory columns from the fork's doctype
            "original_amount": amount,
            "final_amount": amount,
            "currency": currency,
            "payment_method": payment_method,
            "phone": phone,
            "status": "Pending",
            "expiry_time": expiry_time,
        }
    )
    tx_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # --- Route to provider ---
    result = {
        "transaction_id": transaction_id,
        "amount": amount,
        "currency": currency,
        "expiry_time": expiry_time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    if payment_method in ("telebirr", "telebirr_c2b"):
        # telebirr C2B "Pay Bill": the customer pays our short code from their
        # own telebirr app, then Ethio Telecom's CPS calls our biller endpoints
        # (lms.lms.telebirr_c2b). So we return the short code + a bill reference
        # to display — not a checkout URL — like the CBE bank-transfer flow.
        if not frappe.db.has_column("Payment Transaction", "telebirr_bill_ref"):
            frappe.db.set_value("Payment Transaction", tx_doc.name, "status", "Failed")
            frappe.db.commit()
            frappe.throw(_("telebirr payments are not available yet. Please choose another method."))

        from lms.lms.telebirr_c2b import generate_bill_ref

        bill_ref = generate_bill_ref()
        # C2B payers act out-of-band in their telebirr app -> longer window.
        c2b_expiry = datetime.now() + timedelta(hours=24)
        frappe.db.set_value(
            "Payment Transaction", tx_doc.name,
            {"telebirr_bill_ref": bill_ref, "expiry_time": c2b_expiry},
        )

        short_code = frappe.conf.get("telebirr_c2b_short_code") or ""
        result["bill_ref"] = bill_ref
        result["short_code"] = short_code
        result["expiry_time"] = c2b_expiry.strftime("%Y-%m-%d %H:%M:%S")
        result["checkout_url"] = None
        result["instructions"] = {
            "provider": "telebirr",
            "method": "Pay Bill",
            "short_code": short_code,
            "bill_reference": bill_ref,
            "amount": amount,
            "currency": currency,
            "steps": [
                _("Open the telebirr app (or dial the telebirr USSD)."),
                _("Choose 'Pay Bill'."),
                _("Enter the merchant short code: {0}.").format(short_code or _("(shown at checkout)")),
                _("Enter the bill reference: {0}.").format(bill_ref),
                _("Confirm the amount {0} {1} and approve the payment.").format(
                    "{0:.2f}".format(amount), currency
                ),
            ],
            "note": _(
                "Your course unlocks automatically once telebirr confirms the "
                "payment — keep this page open."
            ),
        }

    elif payment_method in ("chapa", "chapa_international"):
        try:
            from lms.lms.chapa import initialize_transaction as chapa_init

            chapa_currency = currency if payment_method == "chapa_international" else "ETB"
            chapa_result = chapa_init(tx_doc.name, currency=chapa_currency)

            result["checkout_url"] = chapa_result.get("checkout_url", "")
            provider_ref = chapa_result.get("reference") or chapa_result.get("tx_ref", "")
            result["provider_reference"] = provider_ref

            frappe.db.set_value(
                "Payment Transaction", tx_doc.name,
                "provider_reference", provider_ref,
            )
        except Exception as e:
            frappe.db.set_value("Payment Transaction", tx_doc.name, "status", "Failed")
            frappe.db.commit()
            frappe.log_error(title="Chapa Payment Init Failed", message=frappe.get_traceback())
            frappe.throw(_("Failed to initiate Chapa payment. Please try again."))

    elif payment_method == "ethswitch":
        try:
            from lms.lms.ethswitch import register_order as ethswitch_create

            eth_result = ethswitch_create(tx_doc.name)

            result["checkout_url"] = eth_result.get("checkout_url", "")
            provider_ref = eth_result.get("order_id") or eth_result.get("reference", "")
            result["provider_reference"] = provider_ref

            frappe.db.set_value(
                "Payment Transaction", tx_doc.name,
                "provider_reference", provider_ref,
            )
        except Exception as e:
            frappe.db.set_value("Payment Transaction", tx_doc.name, "status", "Failed")
            frappe.db.commit()
            frappe.log_error(title="EthSwitch Payment Init Failed", message=frappe.get_traceback())
            frappe.throw(_("Failed to initiate EthSwitch payment. Please try again."))

    elif payment_method == "cbe":
        # CBE bank transfer – return static instructions
        cbe_account = frappe.db.get_single_value("Payment Settings", "cbe_account_number") or "1000XXXXXXXX"
        cbe_name = frappe.db.get_single_value("Payment Settings", "cbe_account_name") or "Delta SPMU Academy"
        cbe_branch = frappe.db.get_single_value("Payment Settings", "cbe_branch") or "Main Branch"

        result["instructions"] = {
            "bank": "Commercial Bank of Ethiopia (CBE)",
            "account_number": cbe_account,
            "account_name": cbe_name,
            "branch": cbe_branch,
            "amount": amount,
            "currency": currency,
            "reference": transaction_id,
            "note": _(
                "Please include the transaction ID ({0}) in the transfer "
                "description. After transferring, return here and click "
                "'Verify Payment' to submit your reference number."
            ).format(transaction_id),
        }
        result["checkout_url"] = None
    else:
        frappe.db.set_value("Payment Transaction", tx_doc.name, "status", "Failed")
        frappe.db.commit()
        frappe.throw(_("Unsupported payment method: {0}").format(payment_method))

    frappe.db.commit()
    return result


# ---------------------------------------------------------------------------
# 3. check_payment_status  [auth, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist()
def check_payment_status(transaction_id):
    """Poll the payment provider for the current status of a transaction.

    Args:
        transaction_id: The DS-… transaction ID string.

    Returns:
        dict with status and transaction details.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)

    if not transaction_id:
        frappe.throw(_("Transaction ID is required."), frappe.MandatoryError)

    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": transaction_id},
        [
            "name", "transaction_id", "user", "course", "course_title",
            "amount", "currency", "payment_method", "status",
            "provider_reference", "creation", "expiry_time",
        ],
        as_dict=True,
    )

    if not tx:
        frappe.throw(_("Transaction {0} not found.").format(transaction_id), frappe.DoesNotExistError)

    # Only owner or admin may check
    if tx.user != user and "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("You do not have permission to view this transaction."), frappe.PermissionError)

    # Already terminal
    if tx.status in ("Completed", "Failed", "Cancelled", "Refunded"):
        return {
            "status": tx.status,
            "transaction_id": tx.transaction_id,
            "course": tx.course,
            "course_title": tx.course_title,
            "amount": tx.amount,
            "currency": tx.currency,
            "payment_method": tx.payment_method,
        }

    # Check expiry
    if _check_transaction_expiry(tx):
        frappe.db.set_value("Payment Transaction", tx.name, "status", "Expired")
        frappe.db.commit()
        return {
            "status": "Expired",
            "transaction_id": tx.transaction_id,
            "message": _("This transaction has expired. Please initiate a new payment."),
        }

    # --- Poll the provider ---
    provider_status = None

    if tx.payment_method == "telebirr" and tx.provider_reference:
        try:
            from lms.lms.telebirr import query_order_status

            provider_status = query_order_status(tx.provider_reference)
        except Exception:
            frappe.log_error(
                title="Telebirr Status Poll Failed",
                message=frappe.get_traceback(),
            )

    elif tx.payment_method in ("chapa", "chapa_international") and tx.provider_reference:
        try:
            from lms.lms.chapa import verify_transaction as chapa_verify

            provider_status = chapa_verify(tx.name)
            # Chapa returns nested {status, data:{...}} — flatten the status
            if isinstance(provider_status, dict) and "data" in provider_status:
                provider_status = {
                    "status": provider_status.get("status")
                    or provider_status.get("data", {}).get("status"),
                    **(provider_status.get("data") or {}),
                }
        except Exception:
            frappe.log_error(
                title="Chapa Status Poll Failed",
                message=frappe.get_traceback(),
            )

    elif tx.payment_method == "ethswitch" and tx.provider_reference:
        try:
            from lms.lms.ethswitch import get_order_status as ethswitch_query

            provider_status = ethswitch_query(tx.provider_reference)
        except Exception:
            frappe.log_error(
                title="EthSwitch Status Poll Failed",
                message=frappe.get_traceback(),
            )

    # Interpret provider response
    if provider_status:
        remote_status = (
            provider_status.get("status", "")
            or provider_status.get("trade_status", "")
        ).lower()

        if remote_status in ("success", "completed", "paid"):
            # Mirror the webhook's amount-match guard so the polling path can't
            # grant access on a status alone when the verified amount disagrees.
            amount_ok = True
            if tx.payment_method in ("chapa", "chapa_international"):
                verified_amount = float(provider_status.get("amount") or 0)
                expected_amount = float(tx.amount or 0)
                if abs(verified_amount - expected_amount) > 0.01:
                    amount_ok = False
                    frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
                    frappe.db.commit()
                    frappe.log_error(
                        title="Chapa Amount Mismatch (poll)",
                        message=f"{tx.transaction_id}: expected {expected_amount}, verified {verified_amount}.",
                    )
                    tx.status = "Failed"
            if amount_ok:
                _process_successful_payment(tx.name)
                tx.status = "Completed"
        elif remote_status in ("failed", "cancelled", "expired"):
            frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
            frappe.db.commit()
            tx.status = "Failed"

    return {
        "status": tx.status,
        "transaction_id": tx.transaction_id,
        "course": tx.course,
        "course_title": tx.course_title,
        "amount": tx.amount,
        "currency": tx.currency,
        "payment_method": tx.payment_method,
    }


# ---------------------------------------------------------------------------
# 4. verify_payment  [auth, GET]  — manual verification (CBE bank transfer)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def verify_payment(transaction_id, reference=None):
    """Submit a bank-transfer reference for manual admin verification.

    Args:
        transaction_id: The DS-… transaction ID.
        reference: The bank transfer reference / receipt number supplied by
            the user.

    Returns:
        dict confirming the submission.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)

    if not transaction_id:
        frappe.throw(_("Transaction ID is required."), frappe.MandatoryError)

    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": transaction_id, "user": user},
        ["name", "transaction_id", "status", "payment_method"],
        as_dict=True,
    )

    if not tx:
        frappe.throw(
            _("Transaction {0} not found or does not belong to you.").format(transaction_id),
            frappe.DoesNotExistError,
        )

    if tx.status == "Completed":
        return {
            "status": "Completed",
            "message": _("This payment has already been verified."),
        }

    if tx.status in ("Failed", "Cancelled", "Expired"):
        frappe.throw(
            _("This transaction is {0} and cannot be verified.").format(tx.status)
        )

    # Mark as pending verification
    frappe.db.set_value(
        "Payment Transaction",
        tx.name,
        {
            "status": "Pending Verification",
            "user_reference": reference or "",
            "verification_submitted_at": datetime.now(),
        },
    )
    frappe.db.commit()

    return {
        "status": "Pending Verification",
        "transaction_id": tx.transaction_id,
        "message": _(
            "Your payment reference has been submitted. An admin will "
            "verify your payment shortly."
        ),
    }


# ---------------------------------------------------------------------------
# 5. get_user_transactions  [auth, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_user_transactions(limit=20, offset=0):
    """Return the current user's payment history (paginated).

    Args:
        limit: Number of records to return (default 20, max 100).
        offset: Number of records to skip.

    Returns:
        dict with transactions list and total count.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)

    limit = min(int(limit), 100)
    offset = max(int(offset), 0)

    filters = {"user": user}

    total = frappe.db.count("Payment Transaction", filters)

    fields = [
        "transaction_id",
        "course",
        "course_title",
        "amount",
        "currency",
        "payment_method",
        "status",
        "creation",
        "completed_at",
        "user_reference",
    ]
    # endpoint behaves identically until e-invoicing has been set up.
        if frappe.db.has_column("Payment Transaction", _col):
            fields.append(_col)

    transactions = frappe.db.get_all(
        "Payment Transaction",
        filters=filters,
        fields=fields,
        order_by="creation desc",
        start=offset,
        page_length=limit,
    )

    # Attach course info
    for tx in transactions:
        tx["creation"] = str(tx.get("creation", ""))
        if tx.get("completed_at"):
            tx["completed_at"] = str(tx["completed_at"])

    return {
        "transactions": transactions,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["GET"])

    student portal can call it safely regardless.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)
    if not transaction_id:
        frappe.throw(_("Transaction ID is required."), frappe.MandatoryError)


    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": transaction_id},
        [
            "name", "user", "course", "course_title", "amount", "currency",
        ],
        as_dict=True,
    )
    if not tx:
        frappe.throw(_("Transaction {0} not found.").format(transaction_id), frappe.DoesNotExistError)
    if tx.user != user and "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("You do not have permission to view this invoice."), frappe.PermissionError)

    return {
        "transaction_id": transaction_id,
        "course": tx.course,
        "course_title": tx.course_title,
        "amount": tx.amount,
        "currency": tx.currency,
        "date": str(tx.completed_at) if tx.completed_at else None,
    }


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["GET"])

    Owner or System Manager only. Returns ``{"html": ...}`` so the client can
    open it in a new window and print / save as PDF (the MoR printing-layout
    artifact). Only available once the invoice is Registered.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Authentication required."), frappe.AuthenticationError)
    if not transaction_id:
        frappe.throw(_("Transaction ID is required."), frappe.MandatoryError)

    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": transaction_id},
        [
            "name", "user", "course", "course_title", "amount", "currency",
        ],
        as_dict=True,
    )
    if not tx:
        frappe.throw(_("Transaction {0} not found.").format(transaction_id), frappe.DoesNotExistError)
    if tx.user != user and "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("You do not have permission to view this invoice."), frappe.PermissionError)
        frappe.throw(_("This invoice has not been registered yet."), frappe.ValidationError)

    buyer = frappe.db.get_value(
        "User", tx.user, ["full_name", "email", "mobile_no", "phone"], as_dict=True) or {}
    conf = frappe.conf
    amount = float(tx.amount or 0)


    pre_tax, tax_amt, total_inc = _split_amount(amount, tax_code)

    if isinstance(when, str):
        try:
            when = datetime.strptime(when[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            when = datetime.now()

    seller = {
        "city": ("[" + city_code + "]Addis Ababa") if city_code else "Addis Ababa",
        "woreda": ("[" + woreda_code + "]Woreda " + woreda_code) if woreda_code else "N/A",
        "sub_tin": "N/A",
    }
    buyer_blk = {
        "name": buyer.get("full_name") or tx.user,
        "city": "N/A", "subcity": "N/A", "woreda": "N/A", "kebele": "N/A",
        "house_no": "N/A",
        "phone": buyer.get("mobile_no") or buyer.get("phone") or "N/A",
        "vat_no": "N/A",
        "sub_tin": "N/A",
    }

        "doc_type": "INV",
        "cancelled": cancelled,
        "cancellation_reason": "The invoice has been cancelled." if cancelled else "",
        "internal_ref": transaction_id,
        "when": when,
        "seller": seller,
        "buyer": buyer_blk,
        "items": [{
            "description": tx.course_title or "Course",
            "nature": "service", "uom": "PCS", "qty": "1.0",
            "unit_price": pre_tax, "tax_code": tax_code,
            "excise": 0, "discount": 0, "total": pre_tax,
        }],
        "totals": {
            "total": pre_tax, "excise": 0, "discount": 0,
            "vat_taxable": pre_tax, "vat15": tax_amt,
            "non_taxable": 0, "total_inc_tax": total_inc,
        },
        "payment_type": "Cash",
        "purchaser_name": buyer_blk["name"],
        "brand_name": seller["name"],
        "brand_city": "Addis Ababa",
    })
    return {"html": html}


# ---------------------------------------------------------------------------
# 6. get_course_access  [auth/guest, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_course_access(course):
    """Check whether the current user has active access to a course.

    Guest-safe — returns ``has_access: False`` for unauthenticated visitors.

    Args:
        course: Name (ID) of the LMS Course.

    Returns:
        dict with has_access, access_start, access_end, days_remaining,
        is_expiring_soon.
    """
    if not course:
        frappe.throw(_("Course is required."), frappe.MandatoryError)

    user = frappe.session.user
    if user == "Guest":
        return {
            "has_access": False,
            "access_start": None,
            "access_end": None,
            "days_remaining": 0,
            "is_expiring_soon": False,
        }

    access = frappe.db.get_value(
        "Course Access",
        {"user": user, "course": course, "is_active": 1},
        ["access_start", "access_end"],
        as_dict=True,
    )

    if not access:
        return {
            "has_access": False,
            "access_start": None,
            "access_end": None,
            "days_remaining": 0,
            "is_expiring_soon": False,
        }

    # access_end is a Date field, so normalise it to a date before comparing.
    # Frappe returns it as a datetime.date (not a string), and comparing a
    # date against datetime.now() raises TypeError — which made this endpoint
    # error on every call and break the access/"expired" state in the UI.
    access_end = access.access_end
    if isinstance(access_end, str):
        access_end = datetime.strptime(access_end[:10], "%Y-%m-%d").date()
    elif isinstance(access_end, datetime):
        access_end = access_end.date()

    today = datetime.now().date()
    if access_end < today:
        # Expired — deactivate
        frappe.db.set_value(
            "Course Access",
            {"user": user, "course": course, "is_active": 1},
            "is_active",
            0,
        )
        frappe.db.commit()
        return {
            "has_access": False,
            "access_start": str(access.access_start),
            "access_end": str(access.access_end),
            "days_remaining": 0,
            "is_expiring_soon": False,
        }

    days_remaining = (access_end - today).days

    return {
        "has_access": True,
        "access_start": str(access.access_start),
        "access_end": str(access.access_end),
        "days_remaining": days_remaining,
        "is_expiring_soon": days_remaining < 7,
    }


# ---------------------------------------------------------------------------
# 7. telebirr_notify  [guest, POST webhook]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["POST"])
def telebirr_notify():
    """Handle Telebirr payment notification callback.

    Verifies the RSA signature, processes the payment, and returns a
    success / failure response to Telebirr's server.

    Returns:
        dict with code and message per Telebirr protocol.
    """
    # Disable CSRF for webhook
    frappe.flags.ignore_csrf = True

    try:
        payload = frappe.request.get_data(as_text=True)
        if not payload:
            frappe.log_error(title="Telebirr Webhook", message="Empty payload received.")
            return {"code": 1, "message": "Empty payload"}

        data = json.loads(payload)
    except (json.JSONDecodeError, Exception) as e:
        frappe.log_error(title="Telebirr Webhook Parse Error", message=str(e))
        return {"code": 1, "message": "Invalid payload"}

    # --- Verify RSA signature ---
    try:
        from lms.lms.telebirr import verify_callback_signature as verify_notification_signature

        if not verify_notification_signature(data):
            frappe.log_error(
                title="Telebirr Webhook Signature Failed",
                message=json.dumps(data, indent=2),
            )
            return {"code": 1, "message": "Signature verification failed"}
    except ImportError:
        frappe.log_error(
            title="Telebirr Signature Module Missing",
            message="lms.lms.telebirr.verify_callback_signature not found",
        )
    except Exception as e:
        frappe.log_error(title="Telebirr Signature Error", message=str(e))
        return {"code": 1, "message": "Signature verification error"}

    # --- Extract transaction details ---
    trade_status = (data.get("tradeStatus") or data.get("trade_status", "")).lower()
    out_trade_no = data.get("outTradeNo") or data.get("out_trade_no", "")
    telebirr_trade_no = data.get("tradeNo") or data.get("trade_no", "")

    if not out_trade_no:
        frappe.log_error(
            title="Telebirr Webhook Missing Transaction",
            message=json.dumps(data, indent=2),
        )
        return {"code": 1, "message": "Missing transaction reference"}

    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": out_trade_no},
        ["name", "status"],
        as_dict=True,
    )

    if not tx:
        frappe.log_error(
            title="Telebirr Webhook Unknown Transaction",
            message=f"Transaction {out_trade_no} not found in database.",
        )
        return {"code": 1, "message": "Transaction not found"}

    if tx.status == "Completed":
        return {"code": 0, "message": "Success"}

    # Store provider reference
    frappe.db.set_value(
        "Payment Transaction", tx.name,
        "provider_reference", telebirr_trade_no,
    )

    if trade_status in ("success", "completed", "paid"):
        success = _process_successful_payment(tx.name)
        if success:
            frappe.db.commit()
            return {"code": 0, "message": "Success"}
        else:
            return {"code": 1, "message": "Processing error"}
    else:
        frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
        frappe.db.commit()
        frappe.log_error(
            title="Telebirr Payment Failed",
            message=f"Transaction {out_trade_no} status: {trade_status}",
        )
        return {"code": 1, "message": f"Payment status: {trade_status}"}


# ---------------------------------------------------------------------------
# 8. chapa_webhook  [guest, POST webhook]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["POST"])
def chapa_webhook():
    """Handle Chapa payment webhook callback.

    Mirrors the live Afritutors flow:
      1. Verify the HMAC SHA256 signature (secret read from site config).
      2. Re-verify the charge server-side against Chapa's /verify API and
         check the amount — a webhook payload is never trusted on its own to
         complete a payment.
      3. Only then grant access via _process_successful_payment (which also

    Returns:
        dict with status and message.
    """
    frappe.flags.ignore_csrf = True

    try:
        payload = frappe.request.get_data(as_text=True)
        if not payload:
            frappe.log_error(title="Chapa Webhook", message="Empty payload received.")
            return {"status": "error", "message": "Empty payload"}

        data = json.loads(payload)
    except (json.JSONDecodeError, Exception) as e:
        frappe.log_error(title="Chapa Webhook Parse Error", message=str(e))
        return {"status": "error", "message": "Invalid payload"}

    # --- Verify HMAC SHA256 signature (secret lives in site config) ---
    # Chapa sends Chapa-Signature (HMAC of the secret) and/or x-chapa-signature
    # (HMAC of the raw body); accept the webhook if EITHER header verifies.
    sig_headers = [h for h in (
        frappe.request.headers.get("Chapa-Signature"),
        frappe.request.headers.get("x-chapa-signature"),
    ) if h]
    try:
        from lms.lms.chapa import verify_webhook_signature

        if sig_headers:
            if not any(verify_webhook_signature(payload, h) for h in sig_headers):
                frappe.log_error(
                    title="Chapa Webhook Signature Failed",
                    message=(
                        "No signature header matched. "
                        f"received={sig_headers} payload[:300]={payload[:300]}"
                    ),
                )
                return {"status": "error", "message": "Invalid signature"}
        else:
            frappe.log_error(
                title="Chapa Webhook No Signature",
                message="No signature header; relying on server-side re-verification.",
            )
    except Exception:
        frappe.log_error(title="Chapa Signature Error", message=frappe.get_traceback())
        return {"status": "error", "message": "Signature verification error"}

    # --- Extract transaction info ---
    tx_ref = data.get("tx_ref") or data.get("trx_ref", "")
    chapa_status = (data.get("status") or "").lower()
    chapa_reference = data.get("reference", "")
    event_type = data.get("event", "")

    if not tx_ref:
        # Try nested event structure
        event_data = data.get("data") or data.get("event", {})
        if isinstance(event_data, dict):
            tx_ref = event_data.get("tx_ref", "")
            chapa_status = (event_data.get("status") or chapa_status).lower()
            chapa_reference = event_data.get("reference") or chapa_reference

    if not tx_ref:
        frappe.log_error(
            title="Chapa Webhook Missing tx_ref",
            message=json.dumps(data, indent=2),
        )
        return {"status": "error", "message": "Missing transaction reference"}

    # tx_ref is the Payment Transaction name we sent Chapa at init time
    # (chapa.initialize_transaction sets tx_ref = txn.name). Fall back to the
    # public transaction_id field for safety.
    tx = frappe.db.get_value(
        "Payment Transaction", tx_ref,
        ["name", "status", "amount"], as_dict=True,
    )
    if not tx:
        tx = frappe.db.get_value(
            "Payment Transaction", {"transaction_id": tx_ref},
            ["name", "status", "amount"], as_dict=True,
        )

    if not tx:
        frappe.log_error(
            title="Chapa Webhook Unknown Transaction",
            message=f"Transaction {tx_ref} not found.",
        )
        return {"status": "error", "message": "Transaction not found"}

    if tx.status == "Completed":
        return {"status": "success", "message": "Already processed"}

    # Store Chapa reference
    if chapa_reference:
        frappe.db.set_value(
            "Payment Transaction", tx.name,
            "provider_reference", chapa_reference,
        )

    is_success = event_type == "charge.success" or chapa_status in ("success", "completed", "paid")
    is_failure = event_type in ("charge.failed", "charge.cancelled") or chapa_status in ("failed", "cancelled")

    if is_success:
        # Never trust the webhook alone — re-verify with Chapa and check amount.
        try:
            from lms.lms.chapa import verify_transaction

            verification = verify_transaction(tx.name)
        except Exception:
            frappe.log_error(title="Chapa Webhook Verify Error", message=frappe.get_traceback())
            return {"status": "error", "message": "Verification error"}

        verified_status = (verification.get("status") or "").lower()
        verified_data = verification.get("data") or {}
        if verified_status not in ("success", "completed", "paid"):
            frappe.log_error(
                title="Chapa Webhook Verify Mismatch",
                message=f"{tx_ref}: webhook reported success but verify returned '{verified_status}'.",
            )
            return {"status": "error", "message": "Verification did not confirm success"}

        verified_amount = float(verified_data.get("amount") or 0)
        expected_amount = float(tx.amount or 0)
        # Treat a 0 / missing verified amount as a mismatch (fail closed) rather
        # than skipping the check — matches the live Afritutors behaviour.
        if abs(verified_amount - expected_amount) > 0.01:
            frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
            frappe.db.commit()
            frappe.log_error(
                title="Chapa Amount Mismatch",
                message=f"{tx_ref}: expected {expected_amount}, verified {verified_amount}.",
            )
            return {"status": "error", "message": "Amount mismatch"}

        success = _process_successful_payment(tx.name)
        if success:
            frappe.db.commit()
            return {"status": "success", "message": "Payment processed"}
        return {"status": "error", "message": "Processing error"}

    elif is_failure:
        frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
        frappe.db.commit()
        frappe.log_error(
            title="Chapa Payment Failed",
            message=f"Transaction {tx_ref} status: {chapa_status or event_type}",
        )
        return {"status": "error", "message": f"Payment status: {chapa_status or event_type}"}

    # Pending / unknown — log only, leave state unchanged.
    frappe.log_error(
        title="Chapa Webhook Unhandled",
        message=f"{tx_ref}: event={event_type}, status={chapa_status}",
    )
    return {"status": "ok", "message": "Event recorded"}


# ---------------------------------------------------------------------------
# 9. ethswitch_webhook  [guest, POST]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["POST"])
def ethswitch_webhook():
    """Handle EthSwitch payment notification callback.

    Returns:
        dict with status and message.
    """
    frappe.flags.ignore_csrf = True

    try:
        payload = frappe.request.get_data(as_text=True)
        if not payload:
            frappe.log_error(title="EthSwitch Webhook", message="Empty payload received.")
            return {"status": "error", "message": "Empty payload"}

        data = json.loads(payload)
    except (json.JSONDecodeError, Exception) as e:
        frappe.log_error(title="EthSwitch Webhook Parse Error", message=str(e))
        return {"status": "error", "message": "Invalid payload"}

    # --- Signature verification ---
    try:
        from lms.lms.ethswitch import verify_webhook_signature

        signature = frappe.request.headers.get("X-EthSwitch-Signature", "")
        if not verify_webhook_signature(payload, signature):
            frappe.log_error(
                title="EthSwitch Webhook Signature Failed",
                message=json.dumps(data, indent=2),
            )
            return {"status": "error", "message": "Invalid signature"}
    except ImportError:
        frappe.log_error(
            title="EthSwitch Signature Module Missing",
            message="lms.lms.ethswitch.verify_webhook_signature not found",
        )
    except Exception as e:
        frappe.log_error(title="EthSwitch Signature Error", message=str(e))

    # --- Extract transaction info ---
    transaction_ref = data.get("transactionReference") or data.get("transaction_id", "")
    merchant_ref = data.get("merchantReference") or data.get("merchant_reference", "")
    eth_status = (data.get("status") or data.get("transactionStatus", "")).lower()

    # Try merchant reference first (our transaction ID), fall back to provider ref
    lookup_field = "transaction_id"
    lookup_value = merchant_ref
    if not lookup_value:
        lookup_field = "provider_reference"
        lookup_value = transaction_ref

    if not lookup_value:
        frappe.log_error(
            title="EthSwitch Webhook Missing Reference",
            message=json.dumps(data, indent=2),
        )
        return {"status": "error", "message": "Missing transaction reference"}

    tx = frappe.db.get_value(
        "Payment Transaction",
        {lookup_field: lookup_value},
        ["name", "status"],
        as_dict=True,
    )

    if not tx:
        frappe.log_error(
            title="EthSwitch Webhook Unknown Transaction",
            message=f"Lookup {lookup_field}={lookup_value} not found.",
        )
        return {"status": "error", "message": "Transaction not found"}

    if tx.status == "Completed":
        return {"status": "success", "message": "Already processed"}

    if transaction_ref:
        frappe.db.set_value(
            "Payment Transaction", tx.name,
            "provider_reference", transaction_ref,
        )

    if eth_status in ("success", "completed", "approved", "paid"):
        success = _process_successful_payment(tx.name)
        if success:
            frappe.db.commit()
            return {"status": "success", "message": "Payment processed"}
        else:
            return {"status": "error", "message": "Processing error"}
    else:
        frappe.db.set_value("Payment Transaction", tx.name, "status", "Failed")
        frappe.db.commit()
        frappe.log_error(
            title="EthSwitch Payment Failed",
            message=f"Transaction {lookup_value} status: {eth_status}",
        )
        return {"status": "error", "message": f"Payment status: {eth_status}"}


# ---------------------------------------------------------------------------
# 10. ethswitch_return  [guest, GET]
# ---------------------------------------------------------------------------
@frappe.whitelist(allow_guest=True, methods=["GET"])
def ethswitch_return():
    """Handle EthSwitch browser return URL after payment attempt.

    Reads query parameters, updates status, and redirects the user to the
    appropriate page.
    """
    transaction_ref = frappe.form_dict.get("transactionReference") or \
                      frappe.form_dict.get("transaction_reference", "")
    merchant_ref = frappe.form_dict.get("merchantReference") or \
                   frappe.form_dict.get("merchant_reference", "")
    eth_status = (frappe.form_dict.get("status") or "").lower()

    lookup_field = "transaction_id"
    lookup_value = merchant_ref
    if not lookup_value:
        lookup_field = "provider_reference"
        lookup_value = transaction_ref

    if not lookup_value:
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/courses?payment=error"
        return

    tx = frappe.db.get_value(
        "Payment Transaction",
        {lookup_field: lookup_value},
        ["name", "status", "course", "transaction_id"],
        as_dict=True,
    )

    if not tx:
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/courses?payment=not-found"
        return

    # Update provider reference
    if transaction_ref:
        frappe.db.set_value(
            "Payment Transaction", tx.name,
            "provider_reference", transaction_ref,
        )

    # Process if reported as success and not already completed
    if eth_status in ("success", "completed", "approved") and tx.status != "Completed":
        _process_successful_payment(tx.name)
        frappe.db.commit()

    # Redirect to course page
    if tx.status == "Completed" or eth_status in ("success", "completed", "approved"):
        redirect_url = f"/courses/{tx.course}/payment-success?tx={tx.transaction_id}"
    else:
        redirect_url = f"/courses/{tx.course}/payment-failed?tx={tx.transaction_id}"

    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = redirect_url


# ---------------------------------------------------------------------------
# 11. admin_verify_payment  [auth, admin only]
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["POST"])
def admin_verify_payment(transaction_id):
    """Manually verify a CBE bank-transfer payment (admin only).

    Args:
        transaction_id: The DS-… transaction ID.

    Returns:
        dict with status and message.
    """
    user = frappe.session.user
    if "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("Only administrators can verify payments."), frappe.PermissionError)

    if not transaction_id:
        frappe.throw(_("Transaction ID is required."), frappe.MandatoryError)

    tx = frappe.db.get_value(
        "Payment Transaction",
        {"transaction_id": transaction_id},
        ["name", "transaction_id", "status", "user", "course", "payment_method"],
        as_dict=True,
    )

    if not tx:
        frappe.throw(
            _("Transaction {0} not found.").format(transaction_id),
            frappe.DoesNotExistError,
        )

    if tx.status == "Completed":
        return {
            "status": "Completed",
            "message": _("This payment has already been verified and processed."),
        }

    if tx.status not in ("Pending", "Pending Verification"):
        frappe.throw(
            _("Cannot verify a transaction with status '{0}'.").format(tx.status)
        )

    # Record who verified it
    frappe.db.set_value(
        "Payment Transaction",
        tx.name,
        {
            "verified_by": user,
            "verified_at": datetime.now(),
        },
    )

    # Process the payment
    success = _process_successful_payment(tx.name)

    if success:
        frappe.db.commit()
        return {
            "status": "Completed",
            "transaction_id": tx.transaction_id,
            "message": _("Payment verified and course access granted to {0}.").format(tx.user),
        }
    else:
        frappe.throw(_("Failed to process payment. Check error logs."))


# ---------------------------------------------------------------------------
# 12. admin_get_revenue_stats  [auth, admin only]
# ---------------------------------------------------------------------------
@frappe.whitelist()
def admin_get_revenue_stats():
    """Return revenue dashboard statistics (admin only).

    Returns:
        dict with total_revenue, transaction_counts, revenue_by_method,
        revenue_by_course, recent_transactions, daily_revenue.
    """
    user = frappe.session.user
    if "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("Only administrators can view revenue stats."), frappe.PermissionError)

    # --- Total revenue ---
    total_revenue = frappe.db.sql(
        """
        SELECT COALESCE(SUM(amount), 0) as total
        FROM `tabPayment Transaction`
        WHERE status = 'Completed' AND currency = 'ETB'
        """,
        as_dict=True,
    )[0].total

    total_revenue_usd = frappe.db.sql(
        """
        SELECT COALESCE(SUM(amount), 0) as total
        FROM `tabPayment Transaction`
        WHERE status = 'Completed' AND currency = 'USD'
        """,
        as_dict=True,
    )[0].total

    # --- Transaction counts by status ---
    status_counts = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count
        FROM `tabPayment Transaction`
        GROUP BY status
        ORDER BY count DESC
        """,
        as_dict=True,
    )
    transaction_counts = {row.status: row["count"] for row in status_counts}

    # --- Revenue by payment method ---
    revenue_by_method = frappe.db.sql(
        """
        SELECT payment_method, currency,
               COUNT(*) as transaction_count,
               COALESCE(SUM(amount), 0) as total_amount
        FROM `tabPayment Transaction`
        WHERE status = 'Completed'
        GROUP BY payment_method, currency
        ORDER BY total_amount DESC
        """,
        as_dict=True,
    )

    # --- Revenue by course ---
    revenue_by_course = frappe.db.sql(
        """
        SELECT course, course_title, currency,
               COUNT(*) as transaction_count,
               COALESCE(SUM(amount), 0) as total_amount
        FROM `tabPayment Transaction`
        WHERE status = 'Completed'
        GROUP BY course, course_title, currency
        ORDER BY total_amount DESC
        """,
        as_dict=True,
    )

    # --- Recent transactions (last 20) ---
    recent_transactions = frappe.db.get_all(
        "Payment Transaction",
        filters={"status": "Completed"},
        fields=[
            "transaction_id", "user", "course", "course_title",
            "amount", "currency", "payment_method", "completed_at",
        ],
        order_by="completed_at desc",
        page_length=20,
    )

    for tx in recent_transactions:
        if tx.get("completed_at"):
            tx["completed_at"] = str(tx["completed_at"])

    # --- Daily revenue (last 30 days) ---
    daily_revenue = frappe.db.sql(
        """
        SELECT DATE(completed_at) as date,
               currency,
               COUNT(*) as transaction_count,
               COALESCE(SUM(amount), 0) as total_amount
        FROM `tabPayment Transaction`
        WHERE status = 'Completed'
          AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(completed_at), currency
        ORDER BY date DESC
        """,
        as_dict=True,
    )

    for row in daily_revenue:
        if row.get("date"):
            row["date"] = str(row["date"])

    # --- Active access count ---
    active_access_count = frappe.db.count(
        "Course Access",
        {"is_active": 1, "access_end": (">", datetime.now())},
    )

    # --- Pending verifications ---
    pending_verifications = frappe.db.get_all(
        "Payment Transaction",
        filters={"status": "Pending Verification"},
        fields=[
            "transaction_id", "user", "course", "course_title",
            "amount", "currency", "payment_method", "user_reference",
            "creation",
        ],
        order_by="creation desc",
        page_length=50,
    )

    for pv in pending_verifications:
        pv["creation"] = str(pv.get("creation", ""))

    return {
        "total_revenue_etb": float(total_revenue),
        "total_revenue_usd": float(total_revenue_usd),
        "transaction_counts": transaction_counts,
        "revenue_by_method": revenue_by_method,
        "revenue_by_course": revenue_by_course,
        "recent_transactions": recent_transactions,
        "daily_revenue": daily_revenue,
        "active_access_count": active_access_count,
        "pending_verifications": pending_verifications,
    }


# ---------------------------------------------------------------------------
# 13. admin_export_payments_csv  [auth, admin only]
# ---------------------------------------------------------------------------
@frappe.whitelist()
def admin_export_payments_csv(status=None, payment_method=None, from_date=None, to_date=None):
    """Stream a CSV of Payment Transaction rows for admin export.

    Filters mirror the on-screen toolbar so the export matches the table.
    Writes directly to the response so even tens of thousands of rows
    don't get buffered in Python memory.
    """
    import csv
    import io

    user = frappe.session.user
    if "System Manager" not in frappe.get_roles(user):
        frappe.throw(_("Only administrators can export payments."), frappe.PermissionError)

    filters = {}
    if status:
        filters["status"] = status
    if payment_method:
        filters["payment_method"] = payment_method
    if from_date:
        filters["creation"] = [">=", from_date]
    if to_date:
        existing = filters.get("creation")
        if existing:
            filters["creation"] = ["between", [existing[1], to_date]]
        else:
            filters["creation"] = ["<=", to_date]

    rows = frappe.db.get_list(
        "Payment Transaction",
        filters=filters,
        fields=[
            "transaction_id", "creation", "user", "user_name",
            "course", "course_title", "amount", "currency",
            "payment_method", "status", "user_reference", "completed_at",
        ],
        order_by="creation desc",
        limit_page_length=0,
    )

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([
        "Transaction ID", "Created", "User Email", "User Name",
        "Course", "Course Title", "Amount", "Currency",
        "Payment Method", "Status", "User Reference", "Completed At",
    ])
    for r in rows:
        writer.writerow([
            r.get("transaction_id") or "",
            str(r.get("creation") or ""),
            r.get("user") or "",
            r.get("user_name") or "",
            r.get("course") or "",
            r.get("course_title") or "",
            r.get("amount") or 0,
            r.get("currency") or "",
            r.get("payment_method") or "",
            r.get("status") or "",
            r.get("user_reference") or "",
            str(r.get("completed_at") or ""),
        ])

    csv_bytes = buf.getvalue().encode("utf-8-sig")  # BOM so Excel detects UTF-8
    filename = f"payments-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"

    frappe.response["type"] = "binary"
    frappe.response["filename"] = filename
    frappe.response["filecontent"] = csv_bytes
    return


# ---------------------------------------------------------------------------
# One-time schema reconciliation — bench-execute only.
# The server's Payment Transaction doctype (from the Afritutors fork tarball)
# predates this API: it has original_amount/final_amount/expires_at but lacks
# the columns this module and the portal are written against. This adds them
# as Custom Fields (idempotent, survives fork updates).
# ---------------------------------------------------------------------------
def setup_payment_transaction_fields():

    Run once: bench --site api.deltaspmu.com execute
        lms.lms.payments_api.setup_payment_transaction_fields
    """
    from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

    create_custom_fields({
        "Payment Transaction": [
            {"fieldname": "transaction_id", "label": "Transaction ID", "fieldtype": "Data",
             "unique": 1, "length": 140, "insert_after": "user",
             "description": "Public DS-… transaction reference used across the API."},
            {"fieldname": "amount", "label": "Amount", "fieldtype": "Currency",
             "insert_after": "transaction_id"},
            {"fieldname": "phone", "label": "Phone", "fieldtype": "Data",
             "insert_after": "amount"},
            {"fieldname": "expiry_time", "label": "Expiry Time", "fieldtype": "Datetime",
             "insert_after": "phone"},
            {"fieldname": "user_reference", "label": "User Reference", "fieldtype": "Data",
             "insert_after": "expiry_time"},
            {"fieldname": "provider_reference", "label": "Provider Reference", "fieldtype": "Data",
             "insert_after": "user_reference"},
        ],
    }, ignore_validate=True)
    frappe.db.commit()
    return "Payment Transaction fields created."


# ---------------------------------------------------------------------------
# Testing helper — bench-execute ONLY (deliberately NOT whitelisted, so it can
# never be invoked over HTTP to mint free enrollments).
# ---------------------------------------------------------------------------
def simulate_completed_purchase(user, course, payment_method="chapa"):
    """Create a Payment Transaction for ``user`` + ``course`` and drive it through
    ``_process_successful_payment`` — exactly what a provider webhook does after a
    real payment. Fires the full post-payment chain: course access, confirmation

    Run on the server:
        bench --site api.deltaspmu.com execute \
          lms.lms.payments_api.simulate_completed_purchase \
          --kwargs '{"user": "student@example.com", "course": "<course-name>"}'
    """
    if not frappe.db.exists("User", user):
        frappe.throw(f"User {user} not found.")
    if not frappe.db.exists("LMS Course", course):
        frappe.throw(f"Course {course} not found.")

    course_price = frappe.db.get_value("LMS Course", course, "course_price")
    amount = float(course_price) if course_price else float(BASE_PRICE)
    course_title = frappe.db.get_value("LMS Course", course, "title") or course

    tx_doc = frappe.get_doc({
        "doctype": "Payment Transaction",
        "transaction_id": _generate_transaction_id(),
        "user": user,
        "course": course,
        "course_title": course_title,
        "amount": amount,
        # legacy mandatory columns from the fork's doctype
        "original_amount": amount,
        "final_amount": amount,
        "currency": "ETB",
        "payment_method": payment_method,
        "status": "Pending",
        "expiry_time": datetime.now() + timedelta(minutes=30),
    })
    tx_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    ok = _process_successful_payment(tx_doc.name)
    frappe.db.commit()

    tx = frappe.db.get_value(
        "Payment Transaction", tx_doc.name,
        as_dict=True,
    )
    return {"processed": ok, "name": tx_doc.name, **(tx or {})}
