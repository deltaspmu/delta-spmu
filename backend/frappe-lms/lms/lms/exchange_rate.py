"""
Exchange rate utilities for Delta SPMU Academy LMS.

Provides ETB/USD (and other currency) conversion with a 5-level fallback
chain to ensure the frontend always receives a usable rate.

Fallback order:
1. Redis cache (6-hour TTL)
2. Primary API — exchangerate-api.com
3. Fallback API — open.er-api.com
4. Last-known rate stored in Redis (no TTL)
5. Hardcoded default (130.0 for USD -> ETB)
"""

import frappe
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CACHE_TTL_SECONDS = 6 * 3600  # 6 hours
HARDCODED_FALLBACK_RATES = {
    ("USD", "ETB"): 130.0,
}
PRIMARY_API_URL = "https://api.exchangerate-api.com/v4/latest/{from_currency}"
FALLBACK_API_URL = "https://open.er-api.com/v6/latest/{from_currency}"
HTTP_TIMEOUT = 5  # seconds


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _cache_key(from_currency, to_currency):
    """Build the Redis cache key for a currency pair.

    Args:
        from_currency (str): Source currency code.
        to_currency (str): Target currency code.

    Returns:
        str: Cache key string.
    """
    return f"deltaspmu_exchange_rate_{from_currency}_{to_currency}"


def _last_known_key(from_currency, to_currency):
    """Build the Redis key for the last-known rate (no TTL).

    Args:
        from_currency (str): Source currency code.
        to_currency (str): Target currency code.

    Returns:
        str: Cache key string.
    """
    return f"deltaspmu_last_known_rate_{from_currency}_{to_currency}"


def _cache_rate(from_currency, to_currency, rate):
    """Store a rate in Redis with TTL and also update the last-known value.

    Args:
        from_currency (str): Source currency code.
        to_currency (str): Target currency code.
        rate (float): The exchange rate to cache.
    """
    cache = frappe.cache()
    rate = float(rate)

    # Primary cache with TTL
    cache.set_value(
        _cache_key(from_currency, to_currency),
        rate,
        expires_in_sec=CACHE_TTL_SECONDS,
    )

    # Last-known backup (no expiry)
    cache.set_value(
        _last_known_key(from_currency, to_currency),
        rate,
    )


def _fetch_rate(url, from_currency, to_currency):
    """Fetch an exchange rate from an HTTP JSON API.

    Expects the response to contain a ``rates`` dict keyed by currency code.

    Args:
        url (str): Fully-formed API URL.
        from_currency (str): Source currency code (for logging).
        to_currency (str): Target currency code to look up in response.

    Returns:
        float | None: The rate if successful, otherwise ``None``.
    """
    try:
        response = requests.get(url, timeout=HTTP_TIMEOUT)
        response.raise_for_status()
        data = response.json()

        # Both APIs use "rates" as the key
        rates = data.get("rates") or {}
        rate = rates.get(to_currency)

        if rate is not None:
            return float(rate)

        frappe.log_error(
            title="Exchange rate key missing",
            message=f"'{to_currency}' not found in response from {url}",
        )
        return None

    except requests.exceptions.RequestException as exc:
        frappe.log_error(
            title="Exchange rate API error",
            message=f"GET {url} failed: {exc}",
        )
        return None
    except (ValueError, KeyError) as exc:
        frappe.log_error(
            title="Exchange rate parse error",
            message=f"Could not parse response from {url}: {exc}",
        )
        return None


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


@frappe.whitelist(allow_guest=True)
def get_exchange_rate(from_currency="USD", to_currency="ETB"):
    """Return the exchange rate for a currency pair with a 5-level fallback.

    Args:
        from_currency (str): Source currency code (default ``"USD"``).
        to_currency (str): Target currency code (default ``"ETB"``).

    Returns:
        dict: ``{"rate": float, "from": str, "to": str, "source": str}``
    """
    from_currency = (from_currency or "USD").upper().strip()
    to_currency = (to_currency or "ETB").upper().strip()

    cache = frappe.cache()

    # --- Level 1: Redis cache ---
    cached = cache.get_value(_cache_key(from_currency, to_currency))
    if cached is not None:
        return {
            "rate": float(cached),
            "from": from_currency,
            "to": to_currency,
            "source": "cache",
        }

    # --- Level 2: Primary API ---
    primary_url = PRIMARY_API_URL.format(from_currency=from_currency)
    rate = _fetch_rate(primary_url, from_currency, to_currency)
    if rate is not None:
        _cache_rate(from_currency, to_currency, rate)
        return {
            "rate": rate,
            "from": from_currency,
            "to": to_currency,
            "source": "primary_api",
        }

    # --- Level 3: Fallback API ---
    fallback_url = FALLBACK_API_URL.format(from_currency=from_currency)
    rate = _fetch_rate(fallback_url, from_currency, to_currency)
    if rate is not None:
        _cache_rate(from_currency, to_currency, rate)
        return {
            "rate": rate,
            "from": from_currency,
            "to": to_currency,
            "source": "fallback_api",
        }

    # --- Level 4: Last-known rate ---
    last_known = cache.get_value(_last_known_key(from_currency, to_currency))
    if last_known is not None:
        return {
            "rate": float(last_known),
            "from": from_currency,
            "to": to_currency,
            "source": "last_known",
        }

    # --- Level 5: Hardcoded fallback ---
    hardcoded = HARDCODED_FALLBACK_RATES.get(
        (from_currency, to_currency),
        HARDCODED_FALLBACK_RATES.get(("USD", "ETB"), 130.0),
    )

    frappe.log_error(
        title="Exchange rate fallback",
        message=(
            f"All live sources failed for {from_currency}->{to_currency}. "
            f"Using hardcoded rate: {hardcoded}"
        ),
    )

    return {
        "rate": float(hardcoded),
        "from": from_currency,
        "to": to_currency,
        "source": "hardcoded",
    }


@frappe.whitelist(allow_guest=True)
def convert_currency(amount, from_currency="USD", to_currency="ETB"):
    """Convert a monetary amount between currencies.

    Args:
        amount (float | str): The amount to convert.
        from_currency (str): Source currency code (default ``"USD"``).
        to_currency (str): Target currency code (default ``"ETB"``).

    Returns:
        dict: ``{"original_amount": float, "converted_amount": float,
                "rate": float, "from": str, "to": str, "source": str}``
    """
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        frappe.throw("Invalid amount provided.", frappe.ValidationError)

    rate_data = get_exchange_rate(from_currency, to_currency)
    rate = rate_data["rate"]
    converted = round(amount * rate, 2)

    return {
        "original_amount": amount,
        "converted_amount": converted,
        "rate": rate,
        "from": rate_data["from"],
        "to": rate_data["to"],
        "source": rate_data["source"],
    }
