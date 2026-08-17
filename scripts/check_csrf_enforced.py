#!/usr/bin/env python3
"""Regression guard for issue #27: CSRF verification must stay ON everywhere.

`ignore_csrf: 1` in site_config turns the check off site-wide, which lets any
site forge POSTs from a logged-in browser. Frappe also skips the check while a
session holds no token of its own, so the portals fetch one right after login —
this asserts both halves against a live environment.

    python3 scripts/check_csrf_enforced.py http://localhost:8000 Administrator admin
"""
import json
import sys
import urllib.error
import urllib.request

LOGIN = "/api/method/login"
TOKEN = "/api/method/lms.lms.api.get_csrf_token"
PROBE = "/api/method/lms.lms.api.get_user_info"  # harmless whitelisted POST


def post(opener, url, token=None):
    req = urllib.request.Request(url, data=b"{}", method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Frappe-CSRF-Token", token)
    try:
        return opener.open(req).status
    except urllib.error.HTTPError as e:
        return e.code


def check(base, usr, pwd):
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor()
    )  # keeps the session cookie

    body = json.dumps({"usr": usr, "pwd": pwd}).encode()
    req = urllib.request.Request(base + LOGIN, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    assert opener.open(req).status == 200, f"{base}: login failed"

    token = json.load(opener.open(base + TOKEN))["message"]["csrf_token"]
    assert isinstance(token, str) and token, f"{base}: no csrf token returned"

    without = post(opener, base + PROBE)
    assert without == 400, f"{base}: POST without token returned {without}, expected 400 (CSRF off?)"

    with_token = post(opener, base + PROBE, token)
    assert with_token == 200, f"{base}: POST with a valid token returned {with_token}"

    print(f"OK  {base}: CSRF enforced (no token -> 400, valid token -> 200)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    check(*sys.argv[1:4])
