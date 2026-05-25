exec("""
import frappe, json, os
site_path = frappe.get_site_path('site_config.json')
with open(site_path) as f:
    cfg = json.load(f)
cfg['cookie_domain'] = '.deltaspmu.com'
with open(site_path, 'w') as f:
    json.dump(cfg, f, indent=2)
print('Set cookie_domain=.deltaspmu.com in', site_path)
""")
