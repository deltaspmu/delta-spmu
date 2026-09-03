"""Tests for marketing-site analytics helpers.

Run: python3 backend/frappe-lms/lms/lms/test_site_analytics.py
"""

import os
import sys
import types
from datetime import datetime, timedelta


# Stub frappe so the module imports without a bench (same approach as
# test_curriculum.py). Only the attributes touched at import time are needed.
if "frappe" not in sys.modules:
    frappe = types.ModuleType("frappe")
    frappe.TooManyRequestsError = type("TooManyRequestsError", (Exception,), {})

    def _whitelist(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    frappe.whitelist = _whitelist
    frappe._ = lambda text: text
    sys.modules["frappe"] = frappe

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import site_analytics as sa  # noqa: E402


# --- normalize_source ------------------------------------------------------

# No referrer at all: typed URL, bookmark, or an app that strips it.
assert sa.normalize_source(None) == "direct"
assert sa.normalize_source("") == "direct"
assert sa.normalize_source("   ") == "direct"

# Known hosts collapse regardless of subdomain or TLD.
assert sa.normalize_source("https://www.google.com/") == "google"
assert sa.normalize_source("https://news.google.co.uk/foo?q=1") == "google"
assert sa.normalize_source("https://l.instagram.com/?u=x") == "instagram"
assert sa.normalize_source("http://m.facebook.com/") == "facebook"
assert sa.normalize_source("https://www.tiktok.com/@delta") == "tiktok"
assert sa.normalize_source("https://t.co/abc") == "twitter"

# An explicit UTM always beats the referrer — that's the campaign the marketer tagged.
assert sa.normalize_source("https://www.google.com/", "instagram_ad") == "instagram_ad"
assert sa.normalize_source(None, "Newsletter") == "newsletter"

# Our own domain is not a traffic source.
assert sa.normalize_source("https://deltaspmu.com/") == "internal"
assert sa.normalize_source("https://learn.deltaspmu.com/courses") == "internal"

# Unknown hosts survive identifiably, minus www.
assert sa.normalize_source("https://www.someblog.et/post") == "someblog.et"

# Junk must not raise.
assert sa.normalize_source("not a url") == "not a url"
assert sa.normalize_source("https://") == "direct"

# Long referrers are bounded by the column width.
assert len(sa.normalize_source("https://x.com/" + "a" * 500)) <= sa.MAX_LEN


# --- normalize_device ------------------------------------------------------

assert sa.normalize_device("mobile") == "mobile"
assert sa.normalize_device("TABLET") == "tablet"
# Anything unrecognised (or absent, or hostile) falls back rather than widening
# the GROUP BY with client-supplied junk.
assert sa.normalize_device("watch") == "desktop"
assert sa.normalize_device(None) == "desktop"
assert sa.normalize_device("<script>") == "desktop"


# --- is_abandoned ----------------------------------------------------------

now = datetime(2026, 8, 31, 12, 0, 0)
past = now - timedelta(minutes=5)
future = now + timedelta(minutes=25)

# The whole point: a stale Pending row IS abandonment. Nothing sweeps these on a
# schedule, so counting only 'Expired' would badly undercount.
assert sa.is_abandoned("Pending", past, now) is True
assert sa.is_abandoned("Pending", past.strftime("%Y-%m-%d %H:%M:%S"), now) is True

# A checkout still inside its 30-minute window is in progress, not abandoned.
assert sa.is_abandoned("Pending", future, now) is False

# Explicitly expired always counts, whatever the timestamp says.
assert sa.is_abandoned("Expired", None, now) is True

# Failed is a provider-initiation error, not a user walking away.
assert sa.is_abandoned("Failed", past, now) is False
assert sa.is_abandoned("Completed", past, now) is False
assert sa.is_abandoned("Pending Verification", past, now) is False

# Missing or unparseable expiry must not raise.
assert sa.is_abandoned("Pending", None, now) is False
assert sa.is_abandoned("Pending", "not-a-date", now) is False


# --- conversion_rate -------------------------------------------------------

assert sa.conversion_rate(50, 200) == 25.0
assert sa.conversion_rate(1, 3) == 33.3
assert sa.conversion_rate(0, 10) == 0.0
# A brand-new site has no traffic; the dashboard must render 0, not blow up.
assert sa.conversion_rate(0, 0) == 0.0
assert sa.conversion_rate(5, None) == 0.0


print("site_analytics: all assertions passed")
