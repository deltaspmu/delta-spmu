# Delta SPMU Academy — E-Learning Platform

## Project Overview
Delta SPMU Academy is an e-learning platform for permanent makeup (SPMU) training based in Addis Ababa, Ethiopia. It follows a blended learning model: online theory via LMS + in-person practical training. The architecture is identical to the production Afritutors platform.

## Domains
- `deltaspmu.com` — Marketing site (S3 + CloudFront) — ALREADY BUILT (root of this repo)
- `api.deltaspmu.com` — Frappe backend API (EC2)
- `learn.deltaspmu.com` — Student portal (Vercel)
- `admin.deltaspmu.com` — Admin portal (Vercel)

## Project Structure
```
Delta_SPMU/
├── src/, index.html, ...        # Marketing site (existing)
├── frontend/
│   ├── student-portal/          # React + TypeScript + Vite
│   └── admin-portal/            # React + TypeScript + Vite
├── backend/
│   ├── frappe-lms/lms/lms/      # Custom Frappe API files
│   └── payments/                # Payment provider integrations
├── infrastructure/              # Terraform (AWS)
├── scripts/                     # Deployment scripts
├── docs/                        # Documentation
└── DELTA_SPMU_BUILD_GUIDE.md    # Complete build reference
```

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| State | React Context (auth) + TanStack React Query (server) |
| Backend | Frappe v15 (Python) with LMS app |
| Database | MariaDB 10.11 on AWS RDS |
| Compute | AWS EC2 t3.small |
| Video | Vimeo (tag: `deltaspmu-lms`) |
| Frontend hosting | Vercel |
| Marketing hosting | S3 + CloudFront |
| DNS + SSL | Cloudflare |
| Email | AWS Lambda + DynamoDB + API Gateway + Resend |
| Payments | telebirr, Chapa, EthSwitch, CBE |
| IaC | Terraform |

## Branding
The marketing site (root repo) uses an **olive + terracotta on warm cream**
palette, sampled from the client's reference design. Tailwind token names in
`tailwind.config.js` are kept stable; the legacy `nude` token now resolves to
the terracotta accent for backward compatibility with existing components.
- **Olive (primary brand green — top bar, primary buttons, bands)**: `#8B8D5A`
- **Olive dark (hover / deeper band)**: `#73754A`
- **Terracotta (accent pop — highlighted words, key CTAs, links; legacy `nude`)**: `#C0703C`
- **Terracotta dark (hover; legacy `nude-dark`)**: `#A5592C`
- **Charcoal (deep forest-olive — headings, dark sections, dark text)**: `#2F3D2A`
- **Tan / champagne (soft icon circles & dividers)**: `#D8C7A1`
- **Light background (warm cream / alabaster)**: `#F4F1E8`
- **Heading font**: Wensley (serif) — currently shipping Playfair Display as a licensed substitute
- **Body font**: Visia Pro (sans-serif) — currently shipping Inter as a licensed substitute

> **Note:** the student/admin portals (`frontend/*/src/index.css`) still use the
> older gold-on-forest-green palette (`--color-primary` gold `#C9A96E`, `--color-dark`
> forest green `#1A2F23`). They have **not** been migrated to the new palette yet.

## 5 Courses
1. Foundation Certification — No prior experience required
2. Advanced Certification — Specialized techniques
3. Master Artist Program — Highest level
4. Instructor Licensing — Train to become an educator
5. Professional Bridal Makeup — Bridal artistry track (separate from the SPMU progression)

Each course is **12,500 ETB**. The 4 SPMU courses (1–4) form a progressive tier
system; Bridal Makeup (5) is a standalone track.

## Critical Frappe Backend Patterns

### NEVER use `frappe.get_doc()` in guest endpoints
It throws PermissionError for non-logged-in users. Use `frappe.db.get_value()` or `frappe.db.get_list()` instead.

```python
# WRONG:
@frappe.whitelist(allow_guest=True)
def get_course_price(course):
    doc = frappe.get_doc("LMS Course", course)  # PERMISSION ERROR!

# RIGHT:
@frappe.whitelist(allow_guest=True)
def get_course_price(course):
    price = frappe.db.get_value("LMS Course", course, "course_price")
    return price or 5000
```

### Course price field is `course_price`, not `price`

### CSRF is required on all POST/PUT/DELETE to Frappe
GET requests bypass CSRF. Payment endpoints use GET intentionally.

### After adding new `@frappe.whitelist()` methods
Clear `.pyc` cache on server, then restart bench:
```bash
sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc
cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart
```

### Frappe sessions are cookie-based
Frontend must use `withCredentials: true` on all Axios requests.

### Cross-origin CSRF (Admin Portal)
Cannot read `csrf_token` cookie cross-origin. Fetch token via `get_csrf_token` API endpoint and cache it.

## Frontend Patterns

### localStorage keys use `deltaspmu_` prefix
Not `afritutors_` — applies to wishlist, payments, pending_payment.

### Vimeo videos stored as `"id/hash"` format
Split on `/` to get video ID and privacy hash.

### Transaction ID prefix: `DS-` (not `AT-`)

### Bundle: "all 5 courses" (not 6)
BUNDLE_ID = "all-courses-bundle", BUNDLE_PRICE = 20000 ETB (per-course = 12500 ETB).
The bundle is a *virtual* product (no LMS Course row): `payments_api.initiate_payment`
and `get_course_price` special-case `BUNDLE_ID` to charge/display BUNDLE_PRICE.

### Vimeo tag: `deltaspmu-lms` (not `afritutors-lms`)

## Environments (see docs/ENVIRONMENTS.md)
- **dev** — local Docker (`dev/docker-compose.yml`, site `lms.localhost`); sync backend edits with `./scripts/dev-sync-backend.sh`
- **staging** — EC2 + on-instance MariaDB, `staging-api.deltaspmu.com`; portals on the `staging` branch → `staging-learn`/`staging-admin.deltaspmu.com`
- **prod** — the live stack (`api`/`learn`/`admin.deltaspmu.com`); AWS resources are named `deltaspmu-dev-*` (legacy, accepted debt)
- Terraform: `infrastructure/envs/{staging,prod}` roots + shared `infrastructure/modules/`; remote state in S3 `deltaspmu-tfstate-534727954268`. NEVER apply in `envs/prod` without a clean plan + explicit user approval.

## Server Commands
```bash
# Deploy backend files (env-parameterized; hosts in scripts/env/*.env)
./scripts/deploy-backend.sh staging     # or: prod (asks for confirmation)

# Marketing site is served by VERCEL (git push deploys it).
# The S3+CloudFront pipeline below exists but is unused (empty bucket, no aliases):
./scripts/deploy-marketing.sh prod      # legacy — see docs/PROD_INVENTORY.md
```

## Admin Emails
```
['Administrator', 'administrator@deltaspmu.com']
```
