"""Patch Frappe's auth.py so set_cookie / flush_cookies honor a
`cookie_domain` site_config value (e.g. '.deltaspmu.com').

Without an explicit Domain attribute, Frappe scopes cookies to the
exact request host (api.deltaspmu.com). Modern browsers then treat
the cookie as third-party when admin.deltaspmu.com makes an XHR
request to api.deltaspmu.com — even though they share a parent
domain — and silently strip it. Setting Domain=.deltaspmu.com makes
it a first-party cookie shared across all subdomains.

Idempotent.
"""
import sys
from pathlib import Path

AUTH_FILE = Path('/home/frappe/deltaspmu/apps/frappe/frappe/auth.py')
src = AUTH_FILE.read_text()

MARKER = "# DELTASPMU_COOKIE_DOMAIN"
if MARKER in src:
    print('Already patched (cookie domain).')
    sys.exit(0)

# 1. Set the cookie dict to include `domain` key. Find the cookies[key]
#    assignment block in set_cookie and add domain.
needle = 'self.cookies[key] = {'
if needle not in src:
    print('Could not find self.cookies[key] = { block')
    sys.exit(1)

# We need to add 'domain' to the dict AND inject a lookup before it
inject_before = (
    "import frappe as _f_cd\n"
    "\t\t_cookie_domain = _f_cd.conf.get('cookie_domain')\n"
    "\t\t" + MARKER + "\n"
    "\t\t"
)
new_src = src.replace(needle, inject_before + needle, 1)

# Add the domain key to the dict (it's the line right after 'value': value,)
new_src = new_src.replace(
    '"value": value,\n',
    '"value": value,\n\t\t\t"domain": _cookie_domain,\n',
    1,
)

# 2. In flush_cookies, pass domain to response.set_cookie
flush_needle = 'samesite=opts.get("samesite"),\n\t\t\t\tmax_age=opts.get("max_age"),'
flush_inject = (
    'samesite=opts.get("samesite"),\n'
    '\t\t\t\tmax_age=opts.get("max_age"),\n'
    '\t\t\t\tdomain=opts.get("domain"),'
)
if flush_needle in new_src:
    new_src = new_src.replace(flush_needle, flush_inject, 1)
else:
    print('WARNING: could not find flush_cookies signature to patch — check manually')

AUTH_FILE.write_text(new_src)
print('Patched cookie domain support.')
