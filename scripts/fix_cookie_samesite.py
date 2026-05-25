"""Force cookie_samesite=None on the Frappe site so cross-origin
requests from admin.deltaspmu.com / learn.deltaspmu.com / *.vercel.app
can carry the session cookie back to api.deltaspmu.com.

Diagnosis: response headers were showing SameSite=Lax even though
we ran `bench set-config cookie_samesite None` — apparently the
config key needs a different name on this Frappe version. We try
several known variants.
"""
exec("""
import frappe
import json

config = frappe.get_site_config()
print('--- before ---')
for k in ('cookie_samesite', 'session_cookie_samesite', 'cookie_secure',
         'allow_cors', 'host_name'):
    print(f'  {k}: {config.get(k)!r}')

# Set the cookie SameSite + Secure flags
new_keys = {
    'cookie_samesite': 'None',
    'session_cookie_samesite': 'None',
    'cookie_secure': 1,
    'session_cookie_secure': 1,
    'cors_allow_methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'cors_allow_headers': 'authorization,content-type,x-frappe-csrf-token,x-frappe-csrf,x-requested-with',
}

import os
site_path = frappe.get_site_path('site_config.json')
print(f'site_config: {site_path}')

with open(site_path, 'r') as f:
    site_cfg = json.load(f)

for k, v in new_keys.items():
    site_cfg[k] = v

with open(site_path, 'w') as f:
    json.dump(site_cfg, f, indent=2)

print()
print('--- after writing ---')
for k in new_keys:
    print(f'  {k}: {site_cfg.get(k)!r}')

frappe.clear_cache()
print()
print('Site config written. Restart bench for changes to take effect.')
""")
