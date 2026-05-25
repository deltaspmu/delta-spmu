"""
Telebirr Mobile Money Integration for Delta SPMU Academy.

RSA-signed payment integration for Ethiopian mobile money (telebirr)
through the Frappe LMS backend.  Supports sandbox and production
environments with automatic payload encryption and signature verification.

Flow:
    1. Frontend calls ``initiate_telebirr_payment`` to start a payment.
    2. ``create_order`` obtains a Fabric token, signs the payload, and
       creates a pre-order on telebirr's API.
    3. Student is redirected to the telebirr checkout URL.
    4. After payment, telebirr POSTs a callback to ``telebirr_callback``.
    5. ``process_callback`` verifies signature, updates transaction,
       creates course enrollment, and sends confirmation email.

Config keys (via frappe.conf / site_config.json):
    telebirr_fabric_app_id, telebirr_app_secret, telebirr_merchant_app_id,
    telebirr_merchant_code, telebirr_private_key (PEM), telebirr_public_key (PEM),
    telebirr_environment ("sandbox"|"production"), telebirr_notify_url,
    telebirr_redirect_url
"""

import json, base64, hashlib, uuid, os, time, traceback
from datetime import datetime, timedelta

import frappe
from frappe import _
import requests

from cryptography.hazmat.primitives import hashes, serialization, padding as sym_padding
from cryptography.hazmat.primitives.asymmetric import padding, utils
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

try:
    from cryptography.exceptions import UnsupportedAlgorithm
except ImportError:
    UnsupportedAlgorithm = Exception

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SANDBOX_BASE_URL = "https://196.188.120.3:11443"
PRODUCTION_BASE_URL = "https://api.ethiotelecom.et"
TOKEN_CACHE_KEY = "telebirr_fabric_token"
TOKEN_CACHE_TTL = 50 * 60  # 50 min (expires in 60)
RECEIVE_NAME = "Delta SPMU Academy"
BUNDLE_COURSES = None  # populated lazily
TELEBIRR_SUCCESS_CODE = "0"
TELEBIRR_DATE_FORMAT = "%Y%m%d%H%M%S"

# Known telebirr result codes
TELEBIRR_ERROR_CODES = {
    "0": "Success", "1": "System error", "2": "Pending",
    "100": "Invalid request parameters", "101": "Invalid signature",
    "102": "Merchant not found", "103": "Duplicate order",
    "104": "Insufficient balance", "105": "Order expired",
    "106": "Transaction not found", "107": "Amount mismatch",
    "200": "Success (alternate)", "500": "Internal server error",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_base_url():
    """Return sandbox or production URL based on config."""
    env = (frappe.conf.get("telebirr_environment") or "sandbox").strip().lower()
    if env == "production":
        return PRODUCTION_BASE_URL
    if env == "sandbox":
        return SANDBOX_BASE_URL
    frappe.throw(_("Invalid telebirr_environment '{0}'.").format(env))


def _tls_verify():
    """Return whether to enforce TLS certificate verification.

    Production must always verify (False here would expose us to MITM). The
    sandbox endpoint sometimes presents self-signed or stale certs that
    requests cannot validate; for that environment we allow opt-out via the
    site config flag ``telebirr_tls_verify`` (default True).
    """
    env = (frappe.conf.get("telebirr_environment") or "sandbox").strip().lower()
    if env == "production":
        return True
    flag = frappe.conf.get("telebirr_tls_verify")
    if flag is None:
        return True
    if isinstance(flag, str):
        return flag.strip().lower() not in ("0", "false", "no", "off")
    return bool(flag)


def _generate_nonce():
    """UUID v4 nonce (no hyphens)."""
    return uuid.uuid4().hex


def _get_timestamp():
    """Current UTC timestamp in telebirr format (YYYYMMDDHHmmss)."""
    return datetime.utcnow().strftime(TELEBIRR_DATE_FORMAT)


def _log_telebirr_event(event_type, data, level="info"):
    """Log a telebirr event via frappe.logger."""
    logger = frappe.logger("telebirr", allow_site=True)
    msg = "[telebirr:{0}] {1}".format(
        event_type,
        json.dumps(data, default=str) if isinstance(data, dict) else str(data),
    )
    getattr(logger, level, logger.info)(msg)


def _get_config_value(key, required=True):
    """Read a config value from frappe.conf; throw if required and missing."""
    value = frappe.conf.get(key)
    if required and not value:
        frappe.throw(_("Telebirr config key '{0}' is not set.").format(key))
    return value


def _sanitise_log_data(data):
    """Mask sensitive fields in a dict copy."""
    sensitive = {"appsecret", "appsecret", "privatekey", "sign", "signature"}
    if not isinstance(data, dict):
        return data
    return {k: ("***" if k.lower().replace("_", "") in sensitive else v) for k, v in data.items()}


def _cache_get(key):
    try:
        return frappe.cache().get_value(key)
    except Exception:
        return None


def _cache_set(key, value, ttl):
    try:
        frappe.cache().set_value(key, value, expires_in_sec=ttl)
    except Exception as exc:
        _log_telebirr_event("cache_set_error", {"key": key, "error": str(exc)}, level="warning")


def _get_error_description(code):
    """Return a human-readable description for a telebirr error code."""
    return TELEBIRR_ERROR_CODES.get(str(code), "Unknown error (code {0})".format(code))


def _build_sign_string(params):
    """Sorted key=value pairs joined by '&', skipping None values."""
    filtered = {k: v for k, v in params.items() if v is not None}
    return "&".join("{0}={1}".format(k, filtered[k]) for k in sorted(filtered))

# ---------------------------------------------------------------------------
# 1. get_fabric_token
# ---------------------------------------------------------------------------

def get_fabric_token():
    """Auth with telebirr Fabric API; caches token in Redis for 50 min.

    POSTs to ``{base_url}/payment/v1/token`` with the app secret.
    Returns access token string; raises on failure.
    """
    cached = _cache_get(TOKEN_CACHE_KEY)
    if cached:
        _log_telebirr_event("token_cache_hit", {"cached": True}, level="debug")
        return cached

    fabric_app_id = _get_config_value("telebirr_fabric_app_id")
    app_secret = _get_config_value("telebirr_app_secret")
    url = "{0}/payment/v1/token".format(get_base_url())

    headers = {"Content-Type": "application/json", "X-APP-Key": fabric_app_id}
    body = {"appSecret": app_secret}
    _log_telebirr_event("token_request", {"url": url, "fabric_app_id": fabric_app_id})

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=30, verify=_tls_verify())
    except requests.exceptions.Timeout:
        _log_telebirr_event("token_timeout", {"url": url}, level="error")
        frappe.throw(_("Telebirr token request timed out."))
    except requests.exceptions.ConnectionError as exc:
        _log_telebirr_event("token_conn_error", {"error": str(exc)}, level="error")
        frappe.throw(_("Unable to connect to telebirr."))
    except requests.exceptions.RequestException as exc:
        _log_telebirr_event("token_error", {"error": str(exc)}, level="error")
        frappe.throw(_("Telebirr token request failed: {0}").format(exc))

    if resp.status_code != 200:
        _log_telebirr_event("token_http_error", {"status": resp.status_code}, level="error")
        frappe.throw(_("Telebirr auth failed (HTTP {0}).").format(resp.status_code))

    try:
        result = resp.json()
    except (ValueError, TypeError):
        frappe.throw(_("Invalid JSON from telebirr token endpoint."))

    token = result.get("token") or result.get("access_token") or result.get("result")
    if not token:
        _log_telebirr_event("token_missing", {"result": result}, level="error")
        frappe.throw(_("Telebirr response did not contain a token."))

    _cache_set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL)
    _log_telebirr_event("token_acquired", {"ttl": TOKEN_CACHE_TTL})
    return token

# ---------------------------------------------------------------------------
# 3. sign_payload
# ---------------------------------------------------------------------------

def sign_payload(payload_string):
    """RSA PKCS1v15 + SHA-256 sign; returns base64-encoded signature.

    Loads private key from ``telebirr_private_key`` config.
    """
    pem = _get_config_value("telebirr_private_key")
    if "-----BEGIN" not in pem:
        pem = "-----BEGIN RSA PRIVATE KEY-----\n{0}\n-----END RSA PRIVATE KEY-----".format(pem.strip())

    try:
        key = serialization.load_pem_private_key(pem.encode(), password=None, backend=default_backend())
    except (ValueError, TypeError, UnsupportedAlgorithm) as exc:
        _log_telebirr_event("sign_key_error", {"error": str(exc)}, level="error")
        frappe.throw(_("Failed to load telebirr private key: {0}").format(exc))

    try:
        sig = key.sign(payload_string.encode(), padding.PKCS1v15(), hashes.SHA256())
    except Exception as exc:
        _log_telebirr_event("sign_error", {"error": str(exc)}, level="error")
        frappe.throw(_("RSA signing failed: {0}").format(exc))

    return base64.b64encode(sig).decode()

# ---------------------------------------------------------------------------
# Payload encryption helpers
# ---------------------------------------------------------------------------

def _encrypt_order_payload(order_params):
    """Encrypt order params for telebirr pre-order (production only)."""
    payload_json = json.dumps(order_params, separators=(",", ":"), sort_keys=True)
    env = (frappe.conf.get("telebirr_environment") or "sandbox").strip().lower()
    if env == "sandbox":
        return payload_json

    try:
        pub_pem = _get_config_value("telebirr_public_key")
        if "-----BEGIN" not in pub_pem:
            pub_pem = "-----BEGIN PUBLIC KEY-----\n{0}\n-----END PUBLIC KEY-----".format(pub_pem.strip())
        pub_key = serialization.load_pem_public_key(pub_pem.encode(), backend=default_backend())
        data = payload_json.encode()
        max_chunk = (pub_key.key_size // 8) - 42
        if len(data) <= max_chunk:
            enc = pub_key.encrypt(data, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
            return base64.b64encode(enc).decode()
        return _hybrid_encrypt(data, pub_key)
    except Exception as exc:
        _log_telebirr_event("encrypt_error", {"error": str(exc)}, level="error")
        return payload_json  # fallback


def _hybrid_encrypt(data, pub_key):
    """AES-256-CBC encrypt data, RSA-encrypt the AES key."""
    aes_key = os.urandom(32)
    iv = os.urandom(16)
    padder = sym_padding.PKCS7(128).padder()
    padded = padder.update(data) + padder.finalize()
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    ct = cipher.encryptor().update(padded) + cipher.encryptor().finalize()
    enc_key = pub_key.encrypt(aes_key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    return "{0}:{1}:{2}".format(
        base64.b64encode(enc_key).decode(),
        base64.b64encode(iv).decode(),
        base64.b64encode(ct).decode(),
    )

# ---------------------------------------------------------------------------
# 2. create_order
# ---------------------------------------------------------------------------

def create_order(transaction_doc):
    """Create a telebirr payment order (pre-order) for the given transaction.

    Steps:
        1. Obtain a Fabric API token.
        2. Build order payload with merchant details, amount, nonce, timestamp.
        3. Sign payload with RSA private key (SHA256withRSA).
        4. POST pre-order request to telebirr.
        5. Update transaction doc with prepay_id.

    Args:
        transaction_doc: Frappe doc with name, course_title, amount, currency.

    Returns:
        dict: ``{"checkout_url": str, "prepay_id": str}``
    """
    token = get_fabric_token()
    fabric_app_id = _get_config_value("telebirr_fabric_app_id")
    merchant_app_id = _get_config_value("telebirr_merchant_app_id")
    merchant_code = _get_config_value("telebirr_merchant_code")
    notify_url = _get_config_value("telebirr_notify_url")
    redirect_url = _get_config_value("telebirr_redirect_url")

    out_trade_no = str(transaction_doc.name)
    course_title = getattr(transaction_doc, "course_title", "Course Payment")
    total_amount = str(getattr(transaction_doc, "amount", "0"))
    currency = getattr(transaction_doc, "currency", "ETB") or "ETB"

    order_params = {
        "appId": merchant_app_id, "merCode": merchant_code,
        "shortCode": merchant_code, "nonce": _generate_nonce(),
        "outTradeNo": out_trade_no, "receiveName": RECEIVE_NAME,
        "subject": course_title, "timeoutExpress": "30",
        "timestamp": _get_timestamp(), "totalAmount": total_amount,
        "currency": currency, "notifyUrl": notify_url,
        "returnUrl": redirect_url, "businessType": "InApp",
    }

    sign_string = _build_sign_string(order_params)
    signature = sign_payload(sign_string)
    order_params["sign"] = signature
    order_params["signType"] = "SHA256WithRSA"

    request_body = _encrypt_order_payload(order_params)
    outer = {"appid": fabric_app_id, "sign": signature, "method": "payment.preorder", "biz_content": request_body}

    url = "{0}/payment/v1/merchant/preOrder".format(get_base_url())
    headers = {"Content-Type": "application/json", "Authorization": "Bearer {0}".format(token), "X-APP-Key": fabric_app_id}
    _log_telebirr_event("create_order", {"url": url, "out_trade_no": out_trade_no, "amount": total_amount})

    try:
        resp = requests.post(url, json=outer, headers=headers, timeout=30, verify=_tls_verify())
    except requests.exceptions.Timeout:
        frappe.throw(_("Telebirr order creation timed out."))
    except requests.exceptions.ConnectionError as exc:
        _log_telebirr_event("order_conn_error", {"error": str(exc)}, level="error")
        frappe.throw(_("Unable to connect to telebirr for order creation."))
    except requests.exceptions.RequestException as exc:
        frappe.throw(_("Telebirr order request failed: {0}").format(exc))

    if resp.status_code != 200:
        frappe.throw(_("Telebirr pre-order failed (HTTP {0}).").format(resp.status_code))

    try:
        result = resp.json()
    except (ValueError, TypeError):
        frappe.throw(_("Invalid JSON in telebirr pre-order response."))

    code = str(result.get("code", result.get("result", "")))
    if code not in ("0", "200", "success"):
        err = result.get("msg") or result.get("message") or result.get("errorMessage") or "Unknown"
        frappe.throw(_("Telebirr order failed: {0} (code {1})").format(err, code))

    # Extract prepay_id and checkout URL
    biz = result.get("biz_content") or result.get("data") or result
    if isinstance(biz, str):
        try:
            biz = json.loads(biz)
        except (ValueError, TypeError):
            pass

    prepay_id = checkout_url = None
    if isinstance(biz, dict):
        prepay_id = biz.get("prepay_id") or biz.get("prepayId") or biz.get("merPrepayId")
        checkout_url = biz.get("toPayUrl") or biz.get("checkout_url") or biz.get("payUrl") or biz.get("data")
    if not prepay_id:
        prepay_id = result.get("prepay_id") or result.get("prepayId") or result.get("merPrepayId")
    if not checkout_url:
        checkout_url = result.get("toPayUrl") or result.get("checkout_url") or result.get("payUrl")
    if not prepay_id:
        frappe.throw(_("Telebirr response missing prepay_id."))

    # Update transaction doc
    try:
        frappe.db.set_value(transaction_doc.doctype, transaction_doc.name, {
            "prepay_id": prepay_id, "payment_gateway": "Telebirr",
            "gateway_order_id": prepay_id, "status": "Pending",
        }, update_modified=True)
        frappe.db.commit()
    except Exception as exc:
        _log_telebirr_event("order_db_error", {"error": str(exc)}, level="error")

    _log_telebirr_event("order_success", {"out_trade_no": out_trade_no, "prepay_id": prepay_id})
    return {"checkout_url": checkout_url, "prepay_id": prepay_id}

# ---------------------------------------------------------------------------
# 4. verify_callback_signature
# ---------------------------------------------------------------------------

def verify_callback_signature(payload):
    """Verify RSA-PSS SHA-256 signature on telebirr callback.

    Extracts ``sign`` field, reconstructs signing string from remaining
    sorted key=value pairs, verifies against telebirr's public key.
    Falls back to PKCS1v15 if PSS fails. Returns True/False.
    """
    if not isinstance(payload, dict):
        return False

    sig_b64 = payload.get("sign") or payload.get("signature")
    if not sig_b64:
        _log_telebirr_event("verify_no_sig", {"keys": list(payload.keys())}, level="error")
        return False

    sign_params = {k: v for k, v in payload.items() if k not in ("sign", "signature", "signType", "sign_type") and v is not None}
    sign_string = _build_sign_string(sign_params)

    pub_pem = _get_config_value("telebirr_public_key", required=False)
    if not pub_pem:
        _log_telebirr_event("verify_no_pubkey", {}, level="error")
        return False
    if "-----BEGIN" not in pub_pem:
        pub_pem = "-----BEGIN PUBLIC KEY-----\n{0}\n-----END PUBLIC KEY-----".format(pub_pem.strip())

    try:
        pub_key = serialization.load_pem_public_key(pub_pem.encode(), backend=default_backend())
    except Exception as exc:
        _log_telebirr_event("verify_key_error", {"error": str(exc)}, level="error")
        return False

    try:
        sig_bytes = base64.b64decode(sig_b64)
    except Exception:
        return False

    # Try RSA-PSS first
    try:
        pub_key.verify(sig_bytes, sign_string.encode(),
                       padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
                       hashes.SHA256())
        return True
    except Exception:
        pass

    # Fallback: PKCS1v15
    try:
        pub_key.verify(sig_bytes, sign_string.encode(), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception as exc:
        _log_telebirr_event("verify_failed", {"error": str(exc)}, level="error")
        return False

# ---------------------------------------------------------------------------
# 8. decrypt_callback
# ---------------------------------------------------------------------------

def decrypt_callback(encrypted_data):
    """Decrypt telebirr callback data (RSA or hybrid AES+RSA).

    Tries plain RSA (OAEP, then PKCS1v15).  For hybrid format
    (``base64key:base64iv:base64ct``), decrypts AES key with RSA
    then ciphertext with AES-256-CBC.  Returns decrypted dict.
    """
    if not encrypted_data:
        frappe.throw(_("No encrypted data for decryption."))

    pem = _get_config_value("telebirr_private_key")
    if "-----BEGIN" not in pem:
        pem = "-----BEGIN RSA PRIVATE KEY-----\n{0}\n-----END RSA PRIVATE KEY-----".format(pem.strip())

    try:
        priv_key = serialization.load_pem_private_key(pem.encode(), password=None, backend=default_backend())
    except Exception as exc:
        frappe.throw(_("Failed to load private key: {0}").format(exc))

    # Hybrid format: base64key:base64iv:base64ct
    if ":" in encrypted_data and encrypted_data.count(":") == 2:
        return _hybrid_decrypt(encrypted_data, priv_key)

    # Plain RSA
    try:
        enc_bytes = base64.b64decode(encrypted_data)
    except Exception:
        frappe.throw(_("Failed to decode encrypted callback data."))

    decrypted = None
    for scheme in [
        padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
        padding.PKCS1v15(),
    ]:
        try:
            decrypted = priv_key.decrypt(enc_bytes, scheme)
            break
        except Exception:
            continue

    if decrypted is None:
        frappe.throw(_("Failed to decrypt telebirr callback data."))

    try:
        return json.loads(decrypted.decode())
    except (ValueError, TypeError, UnicodeDecodeError):
        frappe.throw(_("Decrypted data is not valid JSON."))


def _hybrid_decrypt(encrypted_data, priv_key):
    """Decrypt hybrid AES+RSA payload (key:iv:ciphertext, all base64)."""
    parts = encrypted_data.split(":")
    if len(parts) != 3:
        frappe.throw(_("Invalid hybrid-encrypted payload format."))

    try:
        enc_key, iv, ct = [base64.b64decode(p) for p in parts]
    except Exception:
        frappe.throw(_("Failed to decode hybrid-encrypted components."))

    try:
        aes_key = priv_key.decrypt(enc_key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    except Exception as exc:
        frappe.throw(_("Failed to decrypt AES key: {0}").format(exc))

    try:
        cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
        padded = cipher.decryptor().update(ct) + cipher.decryptor().finalize()
        unpadder = sym_padding.PKCS7(128).unpadder()
        plaintext = unpadder.update(padded) + unpadder.finalize()
    except Exception as exc:
        frappe.throw(_("AES decryption failed: {0}").format(exc))

    try:
        return json.loads(plaintext.decode())
    except (ValueError, TypeError, UnicodeDecodeError):
        frappe.throw(_("Decrypted hybrid data is not valid JSON."))

# ---------------------------------------------------------------------------
# 5. process_callback
# ---------------------------------------------------------------------------

def process_callback(payload):
    """Handle telebirr payment notification callback.

    1. Decrypt if encrypted  2. Verify signature  3. Extract result
    4. Success -> mark Completed, create enrollment, send email
    5. Failed -> mark Failed with error  6. Log everything
    """
    _log_telebirr_event("callback_received", {"type": type(payload).__name__, "preview": str(payload)[:500]})

    # Handle string payloads (encrypted or JSON)
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (ValueError, TypeError):
            try:
                payload = decrypt_callback(payload)
            except Exception:
                return {"status": "failed", "message": "Decryption failed"}

    if not isinstance(payload, dict):
        return {"status": "failed", "message": "Invalid payload type"}

    # Decrypt biz_content if encrypted
    enc_content = payload.get("biz_content") or payload.get("bizContent")
    if isinstance(enc_content, str) and not enc_content.startswith("{"):
        try:
            decrypted = decrypt_callback(enc_content)
            if isinstance(decrypted, dict):
                payload.update(decrypted)
        except Exception:
            pass

    # Verify signature
    if not verify_callback_signature(payload):
        env = (frappe.conf.get("telebirr_environment") or "sandbox").strip().lower()
        if env == "production":
            return {"status": "failed", "message": "Invalid signature"}
        _log_telebirr_event("sig_skip_sandbox", {}, level="warning")

    # Extract fields
    trade_no = payload.get("tradeNo") or payload.get("trade_no") or payload.get("transactionNo")
    out_trade_no = payload.get("outTradeNo") or payload.get("out_trade_no") or payload.get("merOrderId")
    result_code = str(payload.get("code") or payload.get("resultCode") or payload.get("tradeStatus") or "")
    result_msg = payload.get("msg") or payload.get("message") or payload.get("resultMessage") or ""
    total_amount = payload.get("totalAmount") or payload.get("total_amount")
    paid_amount = payload.get("tradeAmount") or payload.get("trade_amount") or total_amount

    _log_telebirr_event("callback_parsed", {
        "trade_no": trade_no, "out_trade_no": out_trade_no,
        "result_code": result_code, "amount": paid_amount,
    })

    if not out_trade_no:
        return {"status": "failed", "message": "Missing outTradeNo"}

    transaction = _find_transaction_doc(out_trade_no)
    if not transaction:
        return {"status": "failed", "message": "Transaction not found"}

    if getattr(transaction, "status", "") == "Completed":
        return {"status": "success", "message": "Already processed"}

    if result_code in ("0", "200", "success", "Success", "2"):
        return _handle_successful_payment(transaction, trade_no, paid_amount, payload)
    if not result_msg:
        result_msg = _get_error_description(result_code)
    return _handle_failed_payment(transaction, trade_no, result_code, result_msg, payload)


def _find_transaction_doc(out_trade_no):
    """Look up transaction doc by name across common doctypes."""
    doctypes = ["LMS Payment", "Payment Request", "LMS Transaction", "Course Payment"]
    for dt in doctypes:
        try:
            if frappe.db.exists(dt, out_trade_no):
                return frappe.get_doc(dt, out_trade_no)
        except Exception:
            continue
    # Fallback: search by gateway_order_id
    for dt in doctypes:
        try:
            names = frappe.get_all(dt, filters={"gateway_order_id": out_trade_no}, pluck="name", limit=1)
            if names:
                return frappe.get_doc(dt, names[0])
        except Exception:
            continue
    return None


def _handle_successful_payment(transaction, trade_no, paid_amount, payload):
    """Mark transaction Completed, create enrollment, send email."""
    now = datetime.utcnow()
    try:
        fields = {
            "status": "Completed", "payment_status": "Paid",
            "completed_at": now, "modified": now,
            "callback_payload": json.dumps(_sanitise_log_data(payload), default=str)[:10000],
        }
        if trade_no:
            fields["trade_no"] = trade_no
            fields["gateway_transaction_id"] = trade_no
        if paid_amount:
            fields["paid_amount"] = str(paid_amount)
        frappe.db.set_value(transaction.doctype, transaction.name, fields, update_modified=False)
        frappe.db.commit()
        _log_telebirr_event("payment_success", {"tx": transaction.name, "trade_no": trade_no})
    except Exception as exc:
        _log_telebirr_event("payment_update_error", {"error": str(exc), "tb": traceback.format_exc()}, level="error")
        return {"status": "failed", "message": "Database update failed"}

    # Enrollment (don't fail callback on enrollment error)
    try:
        enrollments = create_enrollment(transaction)
        _log_telebirr_event("enrollment_created", {"tx": transaction.name, "enrollments": enrollments})
    except Exception as exc:
        _log_telebirr_event("enrollment_error", {"error": str(exc), "tb": traceback.format_exc()}, level="error")

    # Confirmation email
    try:
        _send_payment_confirmation(transaction, trade_no)
    except Exception as exc:
        _log_telebirr_event("email_error", {"error": str(exc)}, level="warning")

    return {"status": "success"}


def _handle_failed_payment(transaction, trade_no, result_code, result_msg, payload):
    """Mark transaction Failed with error details."""
    try:
        fields = {
            "status": "Failed", "payment_status": "Failed",
            "error_message": "Code: {0} — {1}".format(result_code, result_msg)[:500],
            "modified": datetime.utcnow(),
            "callback_payload": json.dumps(_sanitise_log_data(payload), default=str)[:10000],
        }
        if trade_no:
            fields["trade_no"] = trade_no
            fields["gateway_transaction_id"] = trade_no
        frappe.db.set_value(transaction.doctype, transaction.name, fields, update_modified=False)
        frappe.db.commit()
        _log_telebirr_event("payment_failed", {"tx": transaction.name, "code": result_code, "msg": result_msg})
    except Exception as exc:
        _log_telebirr_event("failed_update_error", {"error": str(exc)}, level="error")
    return {"status": "success"}

# ---------------------------------------------------------------------------
# 6. create_enrollment
# ---------------------------------------------------------------------------

def create_enrollment(transaction):
    """Create course access and LMS enrollment records after successful payment.

    For individual purchases, creates a single Course Access record with a
    30-day access window and an LMS Enrollment record.

    For bundle purchases (``is_bundle=True``), creates access for ALL
    bundled courses (up to 4 courses in the Delta SPMU Academy bundle).

    Args:
        transaction: Frappe doc with student/user, course, and optionally
            is_bundle fields.

    Returns:
        list[str]: Names of Course Access documents created.
    """
    student = getattr(transaction, "student", None) or getattr(transaction, "user", None) or getattr(transaction, "email", None)
    if not student:
        frappe.throw(_("Transaction {0} has no student/user.").format(transaction.name))

    course = getattr(transaction, "course", None) or getattr(transaction, "course_name", None) or getattr(transaction, "course_id", None)
    is_bundle = getattr(transaction, "is_bundle", False) or getattr(transaction, "bundle_purchase", False)

    now = datetime.utcnow()
    access_from, access_to = now, now + timedelta(days=30)

    if is_bundle:
        courses = _get_bundle_courses()
        if not courses and course:
            courses = [course]
    else:
        if not course:
            frappe.throw(_("Transaction {0} has no course.").format(transaction.name))
        courses = [course]

    created = []
    for c in courses:
        name = _create_course_access(student, c, access_from, access_to, transaction.name)
        if name:
            created.append(name)
        _create_lms_enrollment(student, c, transaction.name)

    frappe.db.commit()
    _log_telebirr_event("enrollment_complete", {"student": student, "courses": courses, "access": created, "bundle": is_bundle})
    return created


def _get_bundle_courses():
    """Return bundle course list from config or DB (cached)."""
    global BUNDLE_COURSES
    if BUNDLE_COURSES is not None:
        return BUNDLE_COURSES

    configured = frappe.conf.get("telebirr_bundle_courses")
    if configured:
        if isinstance(configured, str):
            BUNDLE_COURSES = [c.strip() for c in configured.split(",") if c.strip()]
        elif isinstance(configured, list):
            BUNDLE_COURSES = configured
        else:
            BUNDLE_COURSES = []
        return BUNDLE_COURSES

    try:
        BUNDLE_COURSES = frappe.get_all("LMS Course", filters={"published": 1}, pluck="name", limit=4, order_by="creation asc")
    except Exception:
        BUNDLE_COURSES = []
    return BUNDLE_COURSES


def _create_course_access(student, course, access_from, access_to, tx_name):
    """Create or extend a Course Access record. Returns doc name or None."""
    try:
        existing = frappe.get_all("Course Access", filters={"student": student, "course": course}, pluck="name", limit=1)
        if existing:
            frappe.db.set_value("Course Access", existing[0], {"access_to": access_to, "transaction": tx_name, "modified": datetime.utcnow()})
            _log_telebirr_event("access_extended", {"name": existing[0], "student": student, "course": course})
            return existing[0]

        doc = frappe.get_doc({
            "doctype": "Course Access", "student": student, "course": course,
            "access_from": access_from, "access_to": access_to,
            "transaction": tx_name, "status": "Active",
        })
        doc.insert(ignore_permissions=True)
        _log_telebirr_event("access_created", {"name": doc.name, "student": student, "course": course})
        return doc.name
    except frappe.DoesNotExistError:
        _log_telebirr_event("access_doctype_missing", {}, level="warning")
        return None
    except Exception as exc:
        _log_telebirr_event("access_error", {"error": str(exc)}, level="error")
        return None


def _create_lms_enrollment(student, course, tx_name):
    """Create LMS Enrollment if not already enrolled. Returns doc name or None."""
    try:
        existing = frappe.get_all("LMS Enrollment", filters={"student": student, "course": course}, pluck="name", limit=1)
        if existing:
            return existing[0]
        doc = frappe.get_doc({
            "doctype": "LMS Enrollment", "student": student, "course": course,
            "enrollment_date": datetime.utcnow(), "payment_reference": tx_name,
        })
        doc.insert(ignore_permissions=True)
        _log_telebirr_event("enrollment_created_single", {"name": doc.name, "student": student, "course": course})
        return doc.name
    except frappe.DoesNotExistError:
        _log_telebirr_event("enrollment_doctype_missing", {}, level="warning")
        return None
    except Exception as exc:
        _log_telebirr_event("enrollment_error_single", {"error": str(exc)}, level="error")
        return None

# ---------------------------------------------------------------------------
# Email confirmation
# ---------------------------------------------------------------------------

def _send_payment_confirmation(transaction, trade_no):
    """Send payment confirmation email to the student."""
    from lms.lms.email_templates import payment_success

    recipient = getattr(transaction, "student", None) or getattr(transaction, "user", None) or getattr(transaction, "email", None)
    if not recipient:
        return

    student_name = frappe.db.get_value("User", recipient, "full_name") or recipient
    course_title = getattr(transaction, "course_title", None) or getattr(transaction, "subject", None) or "your course"
    amount = float(getattr(transaction, "amount", 0) or 0)
    currency = getattr(transaction, "currency", "ETB") or "ETB"
    tx_id = transaction.name

    subject = "Payment Confirmed — {0}".format(course_title)
    message = payment_success(
        student_name=student_name,
        course_title=course_title,
        amount=amount,
        currency=currency,
        tx_id=tx_id,
        access_days=30,
    )

    frappe.sendmail(recipients=[recipient], subject=subject, message=message, now=True, retry=3)
    _log_telebirr_event("email_sent", {"recipient": recipient, "tx": transaction.name, "telebirr_ref": trade_no or "N/A"})

# ---------------------------------------------------------------------------
# Frappe whitelisted API endpoints
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def telebirr_callback(**kwargs):
    """Webhook endpoint for telebirr payment notifications (notifyUrl target)."""
    _log_telebirr_event("webhook_hit", {
        "method": frappe.request.method if hasattr(frappe, "request") and frappe.request else "unknown",
        "keys": list(kwargs.keys()) if kwargs else [],
    })

    payload = kwargs
    # Read JSON body if kwargs is empty
    if not payload or (len(payload) == 1 and "cmd" in payload):
        try:
            if hasattr(frappe, "request") and frappe.request:
                raw = frappe.request.get_data(as_text=True)
                if raw:
                    try:
                        payload = json.loads(raw)
                    except (ValueError, TypeError):
                        payload = raw  # possibly encrypted
        except Exception as exc:
            _log_telebirr_event("webhook_body_error", {"error": str(exc)}, level="error")

    try:
        return process_callback(payload)
    except Exception as exc:
        _log_telebirr_event("webhook_error", {"error": str(exc), "tb": traceback.format_exc()}, level="error")
        return {"status": "failed", "message": "Internal error"}


@frappe.whitelist()
def initiate_telebirr_payment(transaction_name, doctype="LMS Payment"):
    """Frontend endpoint: initiate telebirr payment for a transaction."""
    _log_telebirr_event("initiate", {"tx": transaction_name, "doctype": doctype})
    if not transaction_name:
        frappe.throw(_("Transaction name is required."))

    try:
        doc = frappe.get_doc(doctype, transaction_name)
    except frappe.DoesNotExistError:
        frappe.throw(_("Transaction {0} not found.").format(transaction_name))

    # Verify ownership
    current_user = frappe.session.user
    tx_user = getattr(doc, "student", None) or getattr(doc, "user", None) or getattr(doc, "owner", None)
    if current_user != tx_user and current_user != "Administrator":
        frappe.throw(_("You are not authorised to pay for this transaction."))

    if getattr(doc, "status", "") == "Completed":
        frappe.throw(_("This transaction has already been completed."))

    try:
        return create_order(doc)
    except Exception as exc:
        _log_telebirr_event("initiate_error", {"error": str(exc), "tb": traceback.format_exc()}, level="error")
        frappe.throw(_("Failed to create telebirr order: {0}").format(exc))


@frappe.whitelist()
def check_payment_status(transaction_name, doctype="LMS Payment"):
    """Poll endpoint: check current payment status of a transaction."""
    if not transaction_name:
        frappe.throw(_("Transaction name is required."))
    try:
        doc = frappe.get_doc(doctype, transaction_name)
    except frappe.DoesNotExistError:
        frappe.throw(_("Transaction not found."))

    status = getattr(doc, "status", "Unknown")
    trade_no = getattr(doc, "trade_no", None) or getattr(doc, "gateway_transaction_id", None)
    return {"status": status, "completed": status == "Completed", "trade_no": trade_no}


@frappe.whitelist()
def get_telebirr_config_status():
    """Admin endpoint: verify that all required telebirr config keys are set."""
    if frappe.session.user != "Administrator":
        frappe.throw(_("Only administrators can view telebirr config status."))

    keys = [
        "telebirr_fabric_app_id", "telebirr_app_secret", "telebirr_merchant_app_id",
        "telebirr_merchant_code", "telebirr_private_key", "telebirr_public_key",
        "telebirr_environment", "telebirr_notify_url", "telebirr_redirect_url",
    ]
    status = {k: bool(frappe.conf.get(k)) for k in keys}
    status["environment"] = (frappe.conf.get("telebirr_environment") or "sandbox").strip().lower()
    status["base_url"] = get_base_url()
    status["all_configured"] = all(status[k] for k in keys)
    return status

# ---------------------------------------------------------------------------
# Order status query & reconciliation
# ---------------------------------------------------------------------------

def query_order_status(out_trade_no):
    """Query telebirr for current order status (for reconciliation)."""
    token = get_fabric_token()
    fabric_app_id = _get_config_value("telebirr_fabric_app_id")
    merchant_app_id = _get_config_value("telebirr_merchant_app_id")

    params = {
        "appId": merchant_app_id, "nonce": _generate_nonce(),
        "outTradeNo": out_trade_no, "timestamp": _get_timestamp(),
    }
    params["sign"] = sign_payload(_build_sign_string(params))
    params["signType"] = "SHA256WithRSA"

    url = "{0}/payment/v1/merchant/queryOrder".format(get_base_url())
    headers = {"Content-Type": "application/json", "Authorization": "Bearer {0}".format(token), "X-APP-Key": fabric_app_id}

    try:
        resp = requests.post(url, json=params, headers=headers, timeout=30, verify=_tls_verify())
    except requests.exceptions.Timeout:
        frappe.throw(_("Telebirr order query timed out."))
    except requests.exceptions.ConnectionError as exc:
        frappe.throw(_("Unable to connect to telebirr: {0}").format(exc))
    except requests.exceptions.RequestException as exc:
        frappe.throw(_("Order query failed: {0}").format(exc))

    if resp.status_code != 200:
        frappe.throw(_("Order query failed (HTTP {0}).").format(resp.status_code))

    try:
        return resp.json()
    except (ValueError, TypeError):
        frappe.throw(_("Invalid JSON in order query response."))


@frappe.whitelist()
def reconcile_payment(transaction_name, doctype="LMS Payment"):
    """Admin utility: manually reconcile a payment by querying telebirr."""
    if frappe.session.user != "Administrator":
        frappe.throw(_("Only administrators can reconcile payments."))

    _log_telebirr_event("reconcile", {"tx": transaction_name})

    try:
        order_result = query_order_status(transaction_name)
    except Exception as exc:
        frappe.throw(_("Failed to query telebirr: {0}").format(exc))

    if isinstance(order_result, dict):
        biz = order_result.get("biz_content") or order_result.get("data") or order_result
        if isinstance(biz, str):
            try:
                biz = json.loads(biz)
            except (ValueError, TypeError):
                pass
        if isinstance(biz, dict):
            biz["outTradeNo"] = transaction_name
            return {"query_result": order_result, "callback_result": process_callback(biz)}

    return {"query_result": order_result, "callback_result": {"status": "failed", "message": "Cannot parse"}}
