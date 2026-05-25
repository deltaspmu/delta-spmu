#!/bin/bash
# Patch Frappe's auth.py to read cookie_samesite from site config instead
# of the hardcoded "Lax" default. Needed so cookies set on api.deltaspmu.com
# are sent on cross-origin requests from admin.deltaspmu.com /
# learn.deltaspmu.com / *.vercel.app.
#
# Idempotent — re-running on an already-patched file is a no-op.

set -e

AUTH_FILE=/home/frappe/deltaspmu/apps/frappe/frappe/auth.py

# Detect if already patched
if sudo grep -q 'frappe.conf.get.*cookie_samesite' "$AUTH_FILE"; then
  echo "Already patched."
else
  # Replace the hardcoded `samesite="Lax",` parameter default with
  # `samesite=None,` and inject a real lookup at the top of the function.
  sudo sed -i 's|samesite="Lax",|samesite=None,|' "$AUTH_FILE"
  echo "Patched samesite default in $AUTH_FILE"
fi

# Inject the config lookup inside set_cookie if not already present.
# We add a small block right after the function signature.
if ! sudo grep -q "if samesite is None:" "$AUTH_FILE"; then
  sudo python3 <<'PYEOF'
import re
path = '/home/frappe/deltaspmu/apps/frappe/frappe/auth.py'
with open(path, 'r') as f:
    src = f.read()

needle = 'def set_cookie('
i = src.find(needle)
end = src.find('):', i) + 2
inject = '''
\t\timport frappe as _f
\t\tif samesite is None:
\t\t\tsamesite = _f.conf.get('cookie_samesite') or 'Lax'
'''
# Find the next blank line after the function body starts
body_start = src.find('\n', end) + 1
new_src = src[:body_start] + inject + src[body_start:]
with open(path, 'w') as f:
    f.write(new_src)
print('Injected config lookup into set_cookie')
PYEOF
fi

# Set permissions back
sudo chown frappe:frappe "$AUTH_FILE"

# Clear pyc cache for auth module
sudo rm -f /home/frappe/deltaspmu/apps/frappe/frappe/__pycache__/auth.cpython-*.pyc 2>/dev/null || true

echo "Done. Restart bench for changes to take effect."
