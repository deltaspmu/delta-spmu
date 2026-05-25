"""Add Secure=True alongside SameSite=None. Browsers reject SameSite=None
cookies without the Secure attribute. Frappe's auto-detection of secure=True
relies on request.scheme == 'https' but when nginx forwards as HTTP
internally (which it does here), the scheme is plain http and secure
never gets set.

Idempotent.
"""
import sys
from pathlib import Path

AUTH_FILE = Path('/home/frappe/deltaspmu/apps/frappe/frappe/auth.py')
src = AUTH_FILE.read_text()

MARKER = "# DELTASPMU_FORCE_SECURE"
if MARKER in src:
    print('Already patched (secure).')
    sys.exit(0)

# Find our previously-injected cookie_samesite block and add a force-secure
# block right after it.
needle = "samesite = _f.conf.get('cookie_samesite') or 'Lax'"
inject = (
    "samesite = _f.conf.get('cookie_samesite') or 'Lax'\n"
    "\t\t# " + MARKER + "\n"
    "\t\tif samesite in ('None', 'none', None) and _f.conf.get('cookie_secure'):\n"
    "\t\t\tsecure = True\n"
    "\t\tif not secure and (\n"
    "\t\t\thasattr(_f.local, 'request') and _f.local.request and (\n"
    "\t\t\t\t_f.local.request.headers.get('X-Forwarded-Proto') == 'https'\n"
    "\t\t\t\tor _f.local.request.scheme == 'https'\n"
    "\t\t\t)\n"
    "\t\t):\n"
    "\t\t\tsecure = True"
)
if needle not in src:
    print('Could not find prior samesite injection — was patch_frappe_samesite.py run?')
    sys.exit(1)

new_src = src.replace(needle, inject, 1)
AUTH_FILE.write_text(new_src)
print('Patched secure detection.')
