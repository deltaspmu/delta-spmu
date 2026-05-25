# Vercel Staging Deployment

This guide walks through getting the marketing site, student portal, and admin
portal live on Vercel **before** the production `deltaspmu.com` domain is fully
configured. The Frappe backend stays on EC2; only the three frontends move to
Vercel.

> **TL;DR**  Three Vercel projects from one GitHub repo, each pointing at a
> different root directory. You still need the `deltaspmu.com` apex domain
> registered so `api.deltaspmu.com` can serve HTTPS to the Vercel frontends.

---

## 1. Why you can't skip the API domain

Vercel will hand you URLs like `https://delta-student-xyz.vercel.app`. The
frontends running there will try to call the Frappe backend on EC2. Three
problems happen if you point them at a raw IP or AWS hostname:

1. **Mixed-content blocking.** Vercel serves HTTPS. If the API is HTTP-only
   (raw EC2 IP), browsers block every request.
2. **No SSL cert on an IP.** You cannot issue a valid TLS cert for an EC2
   public IP or `ec2-*.compute.amazonaws.com` hostname unless you own the
   parent domain.
3. **Cookie domain mismatch.** The Frappe session cookie can't be scoped to a
   wandering EC2 hostname; any DNS or IP change invalidates everyone's
   session.

**Minimum to make Vercel staging work:** register `deltaspmu.com`, then point
`api.deltaspmu.com` at EC2 with a real TLS cert. Cost: ~$10/year for the
domain, free for Let's Encrypt or Cloudflare origin cert. You do **not** need
`learn.deltaspmu.com` or `admin.deltaspmu.com` to be configured yet — those
can stay on the Vercel-issued URLs.

---

## 2. One-time setup (do this before Vercel)

### 2.1 Register the apex domain

Buy `deltaspmu.com` from any registrar (Namecheap, Cloudflare Registrar,
Porkbun). Cloudflare Registrar is the cheapest and integrates cleanly with
Cloudflare DNS, which is what the [DEPLOYMENT_GUIDE](DEPLOYMENT_GUIDE.md)
already expects.

### 2.2 Point `api.deltaspmu.com` at EC2

In Cloudflare DNS:

| Type | Name | Content                          | Proxy |
|------|------|----------------------------------|-------|
| A    | api  | `<EC2 Elastic IP>`               | On    |

Set SSL/TLS mode to **Full (strict)** in Cloudflare's dashboard. Install the
Cloudflare origin cert on EC2 (Nginx site config), or use Let's Encrypt with
certbot if you prefer a non-Cloudflare cert.

### 2.3 Configure Frappe for cross-origin Vercel traffic

SSH into EC2 and edit `/home/frappe/deltaspmu/sites/common_site_config.json`
(or use `bench set-config`):

```json
{
  "allow_cors": [
    "https://deltaspmu.com",
    "https://www.deltaspmu.com",
    "https://learn.deltaspmu.com",
    "https://admin.deltaspmu.com",
    "https://delta-marketing.vercel.app",
    "https://delta-student.vercel.app",
    "https://delta-admin.vercel.app"
  ],
  "cookie_samesite": "None"
}
```

Notes:

- Replace the `*.vercel.app` URLs with the actual project URLs Vercel issues
  you after the first deploy (you'll come back and update this).
- `cookie_samesite: None` is what allows the Frappe session cookie to be sent
  on cross-origin requests from `*.vercel.app` to `api.deltaspmu.com`. It
  requires the cookie to also be `Secure`, which is automatic once Nginx
  serves HTTPS.

Restart bench: `sudo -u frappe /home/frappe/.local/bin/bench restart`.

---

## 3. GitHub setup

Single repo, three Vercel projects.

```bash
cd c:\Users\ASUS\Desktop\Delta_SPMU
git init -b main   # if not already initialised
git add .
git commit -m "Initial Delta SPMU monorepo"
gh repo create deltaspmu --private --source=. --remote=origin --push
```

(Use `--public` if you're comfortable with that; the repo currently contains
no secrets thanks to `.gitignore`.)

---

## 4. Three Vercel projects

For each of the three frontends, do this once in the Vercel dashboard:

1. **Add New → Project → Import** the GitHub repo.
2. **Framework Preset:** Vite.
3. **Root Directory:** see table below.
4. **Build Command:** `npm run build` (default).
5. **Output Directory:** `dist` (default).
6. **Install Command:** `npm install` (default).
7. **Environment Variables:** see table below.

| Project name      | Root directory               | Required env vars                                                                                                                                                       |
|-------------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| delta-marketing   | `.`                          | (none for v1)                                                                                                                                                           |
| delta-student     | `frontend/student-portal`    | `VITE_API_URL=https://api.deltaspmu.com` &nbsp;&nbsp; `VITE_GA_MEASUREMENT_ID=` (optional)                                                                               |
| delta-admin       | `frontend/admin-portal`      | `VITE_API_URL=https://api.deltaspmu.com` &nbsp;&nbsp; `VITE_USE_VIMEO_PROXY=true` &nbsp;&nbsp; `VITE_EMAIL_API_URL=<API Gateway URL>` &nbsp;&nbsp; `VITE_EMAIL_API_KEY=<key>` |

After the first deploy of each project, Vercel will give you a URL like
`https://delta-student-abc123.vercel.app`. Copy those URLs into the Frappe
`allow_cors` list (Section 2.3) and restart bench.

---

## 5. Marketing site needs a `vercel.json`

The student and admin portals already have `vercel.json` files. The marketing
site does not (it was originally configured for S3+CloudFront). For Vercel
hosting, add:

```json
{
  "rewrites": [
    { "source": "/((?!api|files|assets).*)", "destination": "/" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" }
    ]},
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ]
}
```

Save as `vercel.json` at the repo root.

---

## 6. Wiring the marketing site's "Login" button

Currently the marketing site's footer / CTAs link to `learn.deltaspmu.com`
(see `src/config.js`). While that subdomain isn't configured, point those
links at the Vercel-issued student-portal URL temporarily:

```js
// src/config.js
export const STUDENT_PORTAL_URL =
  import.meta.env.VITE_STUDENT_PORTAL_URL ||
  'https://delta-student-abc123.vercel.app';
```

Then set `VITE_STUDENT_PORTAL_URL` on the marketing Vercel project. Once
DNS is in place for `learn.deltaspmu.com`, update the env var (no code
change) and redeploy.

---

## 7. End-to-end smoke test (after first deploy)

1. Open `https://delta-marketing-xyz.vercel.app` → click any course CTA.
2. Should land on `https://delta-student-xyz.vercel.app/courses` showing the
   four seeded courses.
3. Click **Register**, create an account. Confirm the email arrives.
4. Log in. Buy a course (use the Chapa test environment).
5. After payment success, the course should appear under My Courses with a
   30-day access window.
6. Open a lesson. Confirm both video and text auto-completion work.
7. Hit `https://delta-admin-xyz.vercel.app`, log in as the instructor user.
   Confirm Dashboard shows non-zero numbers (this is the fix from Sprint 2
   — old code showed `0` for every stat card).

Any 403 or "Invalid CSRF Token" errors mean Section 2.3 is misconfigured —
the most common cause is `cookie_samesite` not set or a Vercel URL missing
from `allow_cors`.

---

## 8. Cutover to real subdomains (later)

When you're ready to flip from `*.vercel.app` to `learn.deltaspmu.com` /
`admin.deltaspmu.com`:

1. In Cloudflare DNS, add CNAME records pointing those subdomains at the
   Vercel projects (Vercel UI will tell you the exact target).
2. In each Vercel project, **Settings → Domains → Add** the custom domain.
3. Add the new domains to `allow_cors` in `common_site_config.json` and
   restart bench.
4. Update `VITE_STUDENT_PORTAL_URL` on the marketing project (Section 6).
5. The Vercel-issued URLs continue to work as aliases — Vercel doesn't
   retire them. Safe to keep both for testing.

---

## 9. Things that will go wrong (and how to debug them)

| Symptom                                          | Cause                                                            | Fix                                                                                            |
|--------------------------------------------------|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| All API calls fail with CORS error               | Vercel URL missing from `allow_cors`                             | Add it, restart bench                                                                          |
| Login appears to succeed but immediately bounces | `cookie_samesite` not set to `None`, or backend not HTTPS         | Set both, restart bench                                                                        |
| "Invalid CSRF Token" on every POST               | Cross-origin cookie unreadable AND old client code               | Confirm student portal is on the post-Sprint-2 code with `ensureCSRFToken` cache fallback      |
| Stats dashboard shows zeros                      | Old admin portal code (pre-Sprint-2 fix)                         | Pull latest; the `getDashboardStats` shape was normalised                                      |
| Email tab is blank / "under construction"        | Old admin portal code (pre-Sprint-2 fix)                         | `EmailList.tsx` now re-exports `EmailInbox.tsx`; redeploy                                      |
| Vercel build fails on Tailwind 4                 | Tailwind 4 needs Node 18+                                        | In Vercel project settings, set Node version to 20                                             |
| 404 on a deep URL like `/course/foundation`      | Missing SPA rewrite                                              | Confirm `vercel.json` `rewrites` entry exists in that project's root                           |

---

## 10. Cost summary

| Item                                     | Cost                |
|------------------------------------------|---------------------|
| `deltaspmu.com` apex domain              | ~$10/year           |
| Cloudflare DNS + SSL                     | Free                |
| Three Vercel Hobby projects              | Free up to 100 GB/mo bandwidth and unlimited deployments |
| EC2 + RDS (existing)                     | ~$25-35/month       |
| **Total to launch Vercel staging**       | **~$10 one-time + existing infra** |

Vercel's Hobby plan is fine for staging and early launch. Move to Pro
($20/user/month) only if you need team seats or commercial-use clauses.
