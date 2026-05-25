# Vercel Deployment — Delta SPMU

Step-by-step plan for putting the student and admin portals on Vercel,
reachable at `learn.deltaspmu.com` and `admin.deltaspmu.com`, while the
Frappe backend stays on EC2 and is exposed at `api.deltaspmu.com`.

Last checked DNS state (before deploy): no `api`, `learn`, or `admin`
records exist yet at GoDaddy. EC2 nginx has only the default site. No
Let's Encrypt cert installed.

---

## Current state

| Piece | Status | Location |
|---|---|---|
| Domain | Owned, DNS at GoDaddy | `deltaspmu.com` |
| GitHub repo | Pushed | `github.com/deltaspmu/delta-spmu` |
| Marketing site | Already deployed (separate Vercel account) | n/a |
| Backend (Frappe LMS) | Running, IP-only (no HTTPS yet) | EC2 `18.194.169.111`, port 8000 |
| Student portal code | Built, ready | `frontend/student-portal/` |
| Admin portal code | Built, ready | `frontend/admin-portal/` |

---

## The fixed dependency order

There's a chicken-and-egg with Let's Encrypt: certbot needs `api.deltaspmu.com`
to resolve to the EC2 IP *before* it can issue a cert (it validates via HTTP
challenge on port 80). So:

1. DNS records first
2. Wait for propagation (5–15 min on GoDaddy)
3. Install nginx site + Let's Encrypt cert on EC2
4. Update Frappe CORS / cookie config
5. Create Vercel projects (can be done in parallel with steps 2–4)
6. Attach custom domains in Vercel (needs DNS already propagated)
7. Final CORS update + smoke test

---

## Step 1 — Add DNS records at GoDaddy

GoDaddy → My Products → DNS → **Manage Zone** for `deltaspmu.com`. Add:

| Type      | Name    | Value                  | TTL |
|-----------|---------|------------------------|-----|
| **A**     | `api`   | `18.194.169.111`       | 600 |
| **CNAME** | `learn` | `cname.vercel-dns.com` | 600 |
| **CNAME** | `admin` | `cname.vercel-dns.com` | 600 |

Notes:
- In the "Name" field type just `api` / `learn` / `admin` (GoDaddy appends the
  apex domain automatically).
- For CNAME values, no trailing dot needed on GoDaddy.
- TTL 600 (10 min) keeps things responsive; raise to 3600 once stable.

Check propagation:
```bash
nslookup api.deltaspmu.com 8.8.8.8
nslookup learn.deltaspmu.com 8.8.8.8
nslookup admin.deltaspmu.com 8.8.8.8
```

---

## Step 2 — Install HTTPS on the backend (Claude does this)

Once `api.deltaspmu.com` resolves to `18.194.169.111`, run from the project
root:

```bash
ssh ubuntu@18.194.169.111 'sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx'
```

Add the nginx site config at `/etc/nginx/conf.d/api.deltaspmu.com.conf`:

```nginx
server {
    listen 80;
    server_name api.deltaspmu.com;

    # Let's Encrypt webroot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100M;
    }
}
```

Reload nginx, then issue the cert:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.deltaspmu.com \
  --non-interactive --agree-tos -m admin@deltaspmu.com --redirect
```

Certbot will rewrite the nginx config to add the SSL block + 301 from
HTTP→HTTPS, and set up auto-renewal via systemd timer.

---

## Step 3 — Update Frappe CORS + cookies (Claude does this)

Edit `/home/frappe/deltaspmu/sites/common_site_config.json` to add the new
portal origins so cross-origin requests from Vercel work:

```json
{
  "allow_cors": [
    "https://learn.deltaspmu.com",
    "https://admin.deltaspmu.com"
  ],
  "cookie_samesite": "None"
}
```

`cookie_samesite: None` is required for the Frappe session cookie to be sent
on cross-origin XHR. Browsers reject `SameSite=None` without `Secure`, so
this only works once the backend is on HTTPS (Step 2 above).

Restart bench using the existing deploy script logic:

```bash
ssh ubuntu@18.194.169.111 "sudo pkill -u frappe -f 'honcho start' || true"
ssh -n ubuntu@18.194.169.111 "sudo -u frappe bash -c 'cd /home/frappe/deltaspmu && nohup setsid /usr/local/bin/bench start </dev/null >/tmp/bench-start.log 2>&1 &' </dev/null >/dev/null 2>&1"
```

Verify:
```bash
curl -fsS https://api.deltaspmu.com/api/method/ping
# expect: {"message":"pong"}
```

---

## Step 4 — Create the two Vercel projects

Vercel dashboard → **Add New → Project → Import** `deltaspmu/delta-spmu`.
Repeat **twice** — once per portal.

### Project 1: `delta-student`

| Setting | Value |
|---------|-------|
| Framework Preset | Vite (auto-detected) |
| **Root Directory** | `frontend/student-portal` |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |
| Install Command | `npm install` (default) |
| Node.js Version | **20.x** (Settings → General) |

Environment Variables (Settings → Environment Variables → all environments):
| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://api.deltaspmu.com` |
| `VITE_FRAPPE_DESK_URL` | `https://api.deltaspmu.com` |

### Project 2: `delta-admin`

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| **Root Directory** | `frontend/admin-portal` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | **20.x** |

Environment Variables:
| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://api.deltaspmu.com` |
| `VITE_USE_VIMEO_PROXY` | `true` |

Hit **Deploy** on both. Each gets a `*.vercel.app` URL (work immediately,
useful for testing before the custom domain is attached).

---

## Step 5 — Attach custom domains in Vercel

For `delta-student`:
- Settings → Domains → **Add** → enter `learn.deltaspmu.com`
- Vercel verifies the CNAME (already pointed at `cname.vercel-dns.com`) and
  issues an SSL cert in ~30 seconds.

For `delta-admin`:
- Same, but `admin.deltaspmu.com`.

If Vercel says "Invalid Configuration", re-check the CNAME at GoDaddy is
exactly `cname.vercel-dns.com` and DNS has propagated.

---

## Step 6 — Smoke test end-to-end

1. `https://learn.deltaspmu.com/courses` — should show the four seeded courses.
2. Register a new account → email verification arrives (requires SMTP configured
   on the Frappe backend, see "Outstanding manual setup" below).
3. Log in → browse course → buy via Chapa test mode → access appears under
   "My Courses".
4. `https://admin.deltaspmu.com` → log in as System Manager → Dashboard shows
   non-zero numbers.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| All API calls fail with CORS error | Vercel domain missing from `allow_cors` | Add it to `common_site_config.json`, restart bench |
| Login succeeds but immediately bounces | `cookie_samesite` not set to `None`, or backend still HTTP | Set both, restart bench |
| `Invalid CSRF Token` on every POST | Old client code without `ensureCSRFToken` cache fallback | Already fixed in this branch; if seen, redeploy frontend |
| 404 on deep URL like `/course/foundation` | Missing SPA rewrite | `frontend/*/vercel.json` already has the rewrite; confirm it shipped |
| Vercel build fails on Tailwind 4 | Node < 18 | Set Node version to 20 in Vercel project settings |
| Vercel custom-domain says "Invalid Configuration" | CNAME hasn't propagated | Wait 5-15 min, recheck `nslookup learn.deltaspmu.com 8.8.8.8` |
| `https://api.deltaspmu.com` returns 502 | bench not running | SSH in, `sudo -u frappe ps -ef \| grep bench`; restart via deploy script |
| Mixed-content errors in browser console | Frontend code hard-codes `http://...` | grep `frontend/` for `http://18.194.169.111` and remove |

---

## Outstanding manual setup (separate from Vercel)

These aren't blocking the Vercel deploy but are needed for full launch:

1. **SMTP / Email Account in Frappe.** Email Account doctype → set up
   outgoing SMTP credentials. Without this, email verification, password
   reset, payment-confirmation, and certificate-ready emails won't send.
2. **Brand fonts.** Currently shipping Playfair Display + Inter as
   substitutes for licensed Wensley + Visia Pro. Drop license files into
   `frontend/student-portal/public/fonts/` and `frontend/admin-portal/public/fonts/`,
   then update `index.css` `@font-face` blocks.
3. **Real course imagery.** Current thumbnails (`/images/course-foundation.jpg`,
   etc.) are placeholders from the marketing image set. Replace at the same
   filenames in `frontend/student-portal/public/images/` and they'll show
   without code changes.

---

## Cost

| Item | Cost |
|---|---|
| `deltaspmu.com` (already owned) | one-time |
| GoDaddy DNS | free with domain |
| Let's Encrypt SSL | free |
| Two Vercel Hobby projects | free up to 100 GB/mo bandwidth |
| EC2 t3.small + RDS (existing) | ~$25-35/mo |

---

## Reference

- Backend deploy script: [scripts/deploy-backend.sh](../scripts/deploy-backend.sh)
- Seed script: [scripts/seed_delta_spmu.py](../scripts/seed_delta_spmu.py)
- Backend API source: [backend/frappe-lms/lms/lms/](../backend/frappe-lms/lms/lms/)
- Marketing site portal-URL config: [src/config.js](../src/config.js)
