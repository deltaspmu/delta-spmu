#!/usr/bin/env python3
"""Regression guard for issue #13: Frappe session cookies must stay host-only.

A `Domain=.deltaspmu.com` attribute puts staging and prod in ONE cookie
namespace (and merges the learn/admin sessions), so a staging login is visible
to `api`/`admin.deltaspmu.com`. Both portals proxy /api/* same-origin through
Vercel, so host-only cookies are all that's needed — never set `cookie_domain`
in site_config.

    python3 scripts/check_cookie_scope.py                  # prod + staging
    python3 scripts/check_cookie_scope.py https://host ...  # explicit
"""
import sys
import urllib.request

DEFAULT = ["https://api.deltaspmu.com", "https://staging-api.deltaspmu.com"]
PROBE = "/api/method/lms.lms.api.get_csrf_token"


def check(base):
    with urllib.request.urlopen(base + PROBE) as r:
        cookies = r.headers.get_all("Set-Cookie") or []
    assert cookies, f"{base}: no Set-Cookie header to check"
    scoped = [c for c in cookies if "domain=" in c.lower()]
    assert not scoped, f"{base}: cookies are not host-only -> {scoped}"
    print(f"OK  {base}: {len(cookies)} host-only cookies")


if __name__ == "__main__":
    for base in sys.argv[1:] or DEFAULT:
        check(base)
