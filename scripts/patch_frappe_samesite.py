"""Patch Frappe's auth.py so set_cookie reads samesite from site_config
instead of hardcoding 'Lax'. Without this, sessions can't cross from
api.deltaspmu.com to admin.deltaspmu.com / learn.deltaspmu.com.

Run via: sudo python3 patch_frappe_samesite.py
Idempotent.
"""
import re
import sys
from pathlib import Path

AUTH_FILE = Path('/home/frappe/deltaspmu/apps/frappe/frappe/auth.py')
src = AUTH_FILE.read_text()

if "frappe.conf.get('cookie_samesite')" in src:
    print('Already patched.')
    sys.exit(0)

# 1. Replace the hardcoded default `samesite="Lax",` (inside set_cookie
#    signature) with `samesite=None,` so callers can let Frappe pick
#    the right value from config.
new_src = src.replace('samesite="Lax",', 'samesite=None,')

# 2. Inject a config lookup at the top of set_cookie body.
# The method body starts after the `):` of the signature. We find the
# `if not secure and hasattr(...):` line and inject before it.
needle = '\t\tif not secure and hasattr(frappe.local'
inject = (
    "\t\tif samesite is None:\n"
    "\t\t\timport frappe as _f\n"
    "\t\t\tsamesite = _f.conf.get('cookie_samesite') or 'Lax'\n"
)
if needle not in new_src:
    print('Could not find injection point — Frappe internals changed?')
    sys.exit(1)
new_src = new_src.replace(needle, inject + needle, 1)

AUTH_FILE.write_text(new_src)
print('Patched auth.py')
