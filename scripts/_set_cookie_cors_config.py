"""Set cross-origin cookie + CORS config on the new Delta site, directly in
site_config.json (no nested set-config quoting). Run as the frappe user:

    /home/frappe/deltaspmu/env/bin/python /tmp/_set_cookie_cors_config.py
"""
import json

PATH = "/home/frappe/deltaspmu/sites/api.deltaspmu.com/site_config.json"

UPDATES = {
    "allow_cors": ["https://learn.deltaspmu.com", "https://admin.deltaspmu.com"],
    "cookie_samesite": "None",
    "session_cookie_samesite": "None",
    "cookie_secure": 1,
    "session_cookie_secure": 1,
    # NOTE: do NOT set "cookie_domain": ".deltaspmu.com". A shared parent-domain
    # cookie makes admin.deltaspmu.com and learn.deltaspmu.com share ONE Frappe
    # session, so logging into one bleeds into (and bounces you out of) the
    # other. Both portals proxy /api/* same-origin via Vercel, so host-only
    # cookies work fine and keep the two sessions independent.
    "cors_allow_methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "cors_allow_headers": "authorization,content-type,x-frappe-csrf-token,x-frappe-csrf,x-requested-with",
    "host_name": "https://api.deltaspmu.com",
    "developer_mode": 0,
}

with open(PATH) as f:
    cfg = json.load(f)
cfg.update(UPDATES)
with open(PATH, "w") as f:
    json.dump(cfg, f, indent=2)

print("cookie/CORS config written to", PATH)
for k in UPDATES:
    print(f"  {k}: {cfg[k]!r}")
