"""Replicate prod's cookie_domain auth.py patch (marker DELTASPMU_COOKIE_DOMAIN).

Makes set_cookie honor an optional `cookie_domain` site-config key, exactly as
patched on prod. Dormant unless the config key is set. Idempotent.
Run with the target auth.py path as argv[1].
"""
import sys

path = sys.argv[1]
src = open(path).read()

MARKER = "DELTASPMU_COOKIE_DOMAIN"
if MARKER in src:
    print("Already patched (cookie_domain).")
    sys.exit(0)

# Insert domain lookup right before the cookie dict is built, and add the
# domain key to it — mirroring prod's structure exactly.
needle = '\t\tself.cookies[key] = {\n\t\t\t"value": value,'
if needle not in src:
    print("Could not find cookie dict — auth.py layout changed?")
    sys.exit(1)

inject = (
    "\t\timport frappe as _f_cd\n"
    "\t\t_cookie_domain = _f_cd.conf.get('cookie_domain')\n"
    "\t\t# " + MARKER + "\n"
    '\t\tself.cookies[key] = {\n\t\t\t"value": value,\n\t\t\t"domain": _cookie_domain,'
)
src = src.replace(needle, inject, 1)

# Pass domain through where cookies are actually set
old_set = "\t\t\t\tsamesite=opts.get(\"samesite\"),"
if old_set in src and 'domain=opts.get("domain")' not in src:
    src = src.replace(old_set, old_set + "\n\t\t\t\tdomain=opts.get(\"domain\"),", 1)

open(path, "w").write(src)
print("Patched cookie_domain support.")
