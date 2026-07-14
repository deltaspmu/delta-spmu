# Delta SPMU Academy — E-Learning Platform Build Guide

> **Purpose**: This document is the complete input for Claude to build the Delta SPMU e-learning platform. It contains the full architecture, every file that needs to be created, exact patterns to follow, and pitfalls to avoid — all derived from the production Afritutors platform.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Reference Architecture (Afritutors)](#2-reference-architecture)
3. [Infrastructure (Terraform)](#3-infrastructure)
4. [Backend (Frappe LMS)](#4-backend)
5. [Student Portal (React + TypeScript)](#5-student-portal)
6. [Admin Portal (React + TypeScript)](#6-admin-portal)
7. [Marketing Site](#7-marketing-site)
8. [Deployment Procedures](#8-deployment)
9. [Critical Pitfalls & Lessons Learned](#9-pitfalls)
10. [Claude Prompts (Copy-Paste Ready)](#10-prompts)

---

## 1. PROJECT OVERVIEW

**Delta SPMU Academy** is an e-learning platform for permanent makeup (SPMU) training based in Addis Ababa, Ethiopia. It is architecturally identical to the Afritutors film education platform.

### Business Details
- **Vertical**: Permanent makeup / cosmetic tattooing education
- **Model**: Blended learning — online theory (LMS) + in-person practical training
- **Market**: Ethiopia (primary), East Africa
- **Courses**: 4 progressive certifications
- **Languages**: English + Amharic
- **Currency**: Ethiopian Birr (ETB) primary, USD secondary
- **Payment methods**: telebirr (mobile money), Chapa, EthSwitch, CBE (bank transfer)

### 4 Courses
1. **Foundation Certification** — No prior experience required. Core basics: infection control, brow mapping, safe machine handling, simulated practice
2. **Advanced Certification** — Specialized techniques: nano hairstrokes, shading gradients, complex case management
3. **Master Artist Program** — Highest level: precision, severe asymmetry, industry leadership
4. **Instructor Licensing** — Train to become an educator for the next generation

### Branding
- **Primary color (nude)**: `#D1BFAE`
- **Dark color (charcoal)**: `#121212`
- **Nude dark variant**: `#B8A494`
- **Light background (alabaster)**: `#FAFAFA`
- **Heading font**: Wensley (serif)
- **Body font**: Visia Pro (sans-serif)
- **Logo**: `Delta-spmu-logo.png` (already exists in marketing site)

### Domain Plan (TO BE REGISTERED)
- `deltaspmu.com` — Marketing site (S3 + CloudFront)
- `api.deltaspmu.com` — Frappe backend API (EC2)
- `learn.deltaspmu.com` — Student portal (Vercel)
- `admin.deltaspmu.com` — Admin portal (Vercel)

---

## 2. REFERENCE ARCHITECTURE

This platform is an exact replica of a production system called "Afritutors". Here is the proven architecture:

```
                    Cloudflare DNS + SSL
                           |
        ┌──────────────────┼──────────────────┐
        |                  |                  |
   S3+CloudFront       Vercel             Vercel
   (Marketing)      (Student Portal)   (Admin Portal)
   deltaspmu.com    learn.deltaspmu    admin.deltaspmu
        |                  |                  |
        └──────────────────┼──────────────────┘
                           |
                    EC2 (t3.small)
                  api.deltaspmu.com
                  Frappe LMS + Nginx
                  Custom Python APIs
                           |
                    RDS MariaDB
                   (db.t3.micro)
                           |
              ┌────────────┼────────────┐
              |            |            |
           Vimeo      telebirr/     Resend
          (Videos)    Chapa/CBE    (Email)
                     (Payments)
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| State management | React Context (auth) + TanStack React Query (server state) |
| Backend framework | Frappe (Python) with LMS app |
| Database | MariaDB 10.11 on AWS RDS |
| Compute | AWS EC2 t3.small |
| Video hosting | Vimeo (shared account, tag-based filtering) |
| Frontend hosting | Vercel (auto-deploy from GitHub) |
| Marketing hosting | AWS S3 + CloudFront |
| DNS + SSL | Cloudflare |
| Email service | AWS Lambda + DynamoDB + API Gateway + Resend |
| Payments | telebirr, Chapa, EthSwitch, CBE |
| IaC | Terraform |

### Monthly Cost Estimate
- EC2 t3.small: ~$15
- RDS db.t3.micro: ~$12 (or free tier)
- S3 + CloudFront: ~$2
- Elastic IP: $0 (attached)
- Lambda/DynamoDB: ~$1
- **Total: ~$25-35/month**

---

## 3. INFRASTRUCTURE (Terraform)

### 3.1 Project Structure
```
infrastructure/
├── main.tf              # VPC, EC2, RDS, S3, Security Groups
├── email.tf             # Email service (Lambda, DynamoDB, API Gateway)
├── variables.tf         # (or inline in main.tf)
├── terraform.tfvars     # Secrets (DO NOT COMMIT)
└── .gitignore           # Ignore: *.tfstate, *.tfvars, .terraform/
```

### 3.2 Core Resources (main.tf)

**VPC:**
- CIDR: `10.0.0.0/16`
- 2 public subnets (eu-central-1a: `10.0.1.0/24`, eu-central-1b: `10.0.2.0/24`)
- Internet Gateway + route table
- No NAT Gateway (cost savings)

**EC2:**
- Instance type: `t3.small` (2 vCPU, 2GB RAM)
- AMI: Ubuntu 22.04 (or use Afritutors golden AMI if available)
- 30GB gp3 root volume
- Elastic IP for stable public address
- User data script installs: Node.js 18, Redis, Nginx, Python 3, wkhtmltopdf, Supervisor, frappe-bench

**RDS MariaDB:**
- Engine: MariaDB 10.11
- Instance: `db.t3.micro`
- Storage: 20GB gp2, auto-scaling to 100GB
- Database name: `deltaspmu`
- NOT publicly accessible (only from EC2 security group)
- Backup disabled for dev (enable for prod)

**Security Groups:**
- Web SG: Inbound 80, 443, 22, 8000 from 0.0.0.0/0; outbound all
- DB SG: Inbound 3306 from Web SG only; outbound all

**S3 Buckets:**
- `{project}-assets-{random}` — Certificates & general assets
- `{project}-{env}-email-attachments` — Email attachments (versioned, encrypted)

**SSH Key Pair:** Managed by Terraform, public key in tfvars

### 3.3 Email Infrastructure (email.tf)

**DynamoDB Tables:**
- `{project}-{env}-emails` — Hash: id, GSIs: ThreadIndex, DirectionIndex, StatusIndex, OwnerEmailIndex
- `{project}-{env}-email-contacts` — Hash: email

**Lambda Functions** (Node.js 20.x, 256MB, 30s timeout):
- email-get-all, email-get-one, email-send, email-update, email-delete
- email-webhook (Resend inbound handler)
- email-attachments (presigned URL generator)
- email-addresses (contact management)

**API Gateway** (REST, Regional):
- `/emails` — GET, POST, OPTIONS
- `/emails/{id}` — GET, PATCH, DELETE, OPTIONS
- `/webhook/email` — POST, OPTIONS
- `/attachments/presign` — POST, OPTIONS
- `/email-addresses` — GET, POST, OPTIONS
- `/email-addresses/{id}` — DELETE, OPTIONS
- CORS: allowed origin = `https://admin.deltaspmu.com`

**SSM Parameter Store:**
- `/deltaspmu/resend-api-key` — SecureString
- `/deltaspmu/webhook-secret` — SecureString
- `/deltaspmu/email-api-key` — SecureString

### 3.4 Terraform Variables
```hcl
variable "project_name"  { default = "deltaspmu" }
variable "environment"   { default = "dev" }
variable "db_password"   { type = string, sensitive = true }
variable "ssh_public_key" { type = string }
variable "ami_id"        { default = "ami-XXXXXXXXX" }  # Ubuntu 22.04 eu-central-1
```

---

## 4. BACKEND (Frappe LMS)

### 4.1 Server Setup Sequence
1. SSH into EC2 after Terraform provisions it
2. Install prerequisites (Node 18, Redis, Nginx, Python 3, pip, venv, wkhtmltopdf, Supervisor)
3. Create `frappe` user with sudo
4. `bench init deltaspmu --frappe-branch version-15`
5. `bench new-site api.deltaspmu.com` (use RDS endpoint for db_host)
6. `bench get-app lms` then `bench --site api.deltaspmu.com install-app lms`
7. Configure Nginx: `bench setup nginx && sudo service nginx reload`
8. Set up SSL (Let's Encrypt or Cloudflare origin cert)

### 4.2 Custom API Files

These go to: `/home/frappe/deltaspmu/apps/lms/lms/lms/`

#### File: `api.py` (~2500 lines)
The main API module. Key endpoints:

**Guest-accessible:**
- `get_csrf_token()` — Returns CSRF token for cross-origin clients
- `get_user_info()` — Current user profile
- `get_branding()` — Site branding data
- `get_translations()` — i18n strings
- `validate_billing_access(billing_type, name)` — Course access check
- `get_categories(doctype, filters)` — Category listings
- `get_lms_settings()` — Platform config

**Authenticated:**
- `save_current_lesson(course_name, lesson_name)` — Track current lesson
- `mark_lesson_progress(course, chapter_number, lesson_number)` — Mark lesson complete
- `get_enrollment_status(course)` — Check if enrolled
- `get_enrolled_courses()` — List user's courses
- `get_certificates()` — User's certificates
- `update_user_profile(data)` — Profile updates
- `get_user_bio()` / `update_notification_preferences(prefs)`
- `delete_user_account()` — GDPR-compliant account deletion
- `get_transaction_history(limit, offset)` — Payment history
- `delete_course(course)` — Admin: delete course
- `delete_lesson(lesson, chapter)` — Admin: delete lesson

**CRITICAL FRAPPE PATTERN:**
```python
# For guest-accessible endpoints, NEVER use frappe.get_doc()
# It throws PermissionError for non-logged-in users
# ALWAYS use frappe.db.get_value() or frappe.db.get_list() instead

# WRONG (will break for guests):
@frappe.whitelist(allow_guest=True)
def get_course_price(course):
    doc = frappe.get_doc("LMS Course", course)  # PERMISSION ERROR!
    return doc.course_price

# RIGHT:
@frappe.whitelist(allow_guest=True)
def get_course_price(course):
    price = frappe.db.get_value("LMS Course", course, "course_price")
    return price or 5000
```

#### File: `custom_api.py` (~830 lines)
Learning progress, quizzes, certificates:

- `get_instructor_profile(user)` [guest] — Instructor display info
- `mark_lesson_complete(course, lesson)` [auth] — Marks lesson done, triggers certificate check
- `get_course_progress(course)` [auth/guest] — Progress percentage + completed lessons
- `get_quiz(quiz)` [guest] — Quiz with questions (correct answers NOT exposed)
- `submit_quiz(quiz, answers)` [auth] — Server-side grading, creates submission record
- `check_lesson_access(course, lesson)` [auth] — Sequential gating (must complete previous)
- `check_final_quiz_access(course)` [auth] — All lessons must be 100% before final quiz
- `check_and_generate_certificate(course, member)` [auth] — Auto-generates if eligible
- `get_quiz_questions(quiz)` / `add_quiz_question(...)` / `delete_quiz_question(...)` — Admin quiz management
- `save_instructor_profile(user, title, bio)` [auth] — Admin saves instructor info

**Quiz grading logic:**
- Single choice: exact text match against correct option
- Multiple choice: compare sets of selected vs correct options
- Optional negative marking (deduct for wrong answers)
- Pass threshold: configurable per quiz (default 70%)
- Max attempts enforced per quiz

**Certificate auto-generation triggers when:**
1. All lessons marked complete (100%)
2. All lesson quizzes passed at threshold
3. Final course quiz passed (if configured)
4. Certificate not already issued

#### File: `payments_api.py` (~870 lines)
Payment processing:

**Constants (CHANGE THESE FOR DELTA SPMU):**
```python
BASE_PRICE = 5000  # ETB per course
ACCESS_DURATION_DAYS = 30
BUNDLE_ID = "all-courses-bundle"
BUNDLE_PRICE = 5000  # ETB for all 4 courses (was 6 in Afritutors)
```

**Endpoints:**
- `get_course_price(course, currency)` [auth] — Returns pricing with discounts
- `initiate_payment(course, payment_method, phone, currency)` [auth] — Creates Payment Transaction, routes to provider
- `check_payment_status(transaction_id)` [auth] — Polls provider for completion
- `verify_payment(transaction_id, reference)` [auth] — Manual payment verification (CBE)
- `get_user_transactions(limit, offset)` [auth] — Payment history
- `get_course_access(course)` [auth/guest] — Check access + expiry dates
- `telebirr_notify()` [guest, webhook] — telebirr callback (RSA signature verified)
- `chapa_webhook()` [guest, webhook] — Chapa callback (HMAC verified)
- `ethswitch_webhook()` / `ethswitch_return()` [guest] — EthSwitch handlers

**Transaction ID format:** `DS-{YYYYMMDDHHMMSS}-{6-char-hash}` (change prefix from AT- to DS-)

**Payment flow:**
1. User clicks Buy → `initiate_payment()` creates `Payment Transaction` record with 30-min expiry
2. Routes to provider (telebirr checkout URL, Chapa hosted page, etc.)
3. User pays on provider's site
4. Provider sends webhook → backend verifies signature → marks transaction Completed
5. Creates `Course Access` record (30-day window) + `LMS Enrollment`
6. Sends confirmation email

#### File: `telebirr.py` (~970 lines)
telebirr integration with RSA-PSS signing:
- `get_fabric_token()` — Auth with telebirr API
- `create_order(transaction_doc)` — Creates payment order
- `verify_callback_signature(payload)` — RSA-PSS SHA256 verification
- `process_callback(payload)` — Handles payment notification
- `create_enrollment(transaction)` — Creates course access after payment

**Required config keys (set via `bench set-config`):**
- `telebirr_fabric_app_id`, `telebirr_app_secret`, `telebirr_merchant_app_id`
- `telebirr_merchant_code`, `telebirr_private_key`, `telebirr_public_key`
- `telebirr_environment` ("sandbox" or "production")
- `telebirr_notify_url`, `telebirr_redirect_url`

#### File: `vimeo_api.py` (~470 lines)
Server-side Vimeo proxy (token never exposed to frontend):

- `vimeo_list_videos(page, per_page, query)` — List videos
- `vimeo_get_video(video_id)` — Get details
- `vimeo_create_upload(name, description, size)` — TUS resumable upload ticket
- `vimeo_complete_upload(video_id)` — Finalize upload
- `vimeo_update_video(video_id, name, description, privacy)` — Update metadata
- `vimeo_delete_video(video_id)` — Delete video
- `vimeo_set_embed_domains(video_id, domains)` — Whitelist embed domains

**IMPORTANT:** Change the Vimeo tag from `afritutors-lms` to `deltaspmu-lms` and update embed domains list:
```python
DEFAULT_EMBED_DOMAINS = [
    "deltaspmu.com", "learn.deltaspmu.com", "admin.deltaspmu.com",
    "api.deltaspmu.com", "localhost"
]
```

#### File: `security.py` (~300 lines)
Rate limiting & user management:
- `check_rate_limit(action, identifier, max_attempts, window_seconds)` — Redis-based
- `rate_limited_sign_up(email, full_name)` — 5/hour per email, 10/hour per IP
- `rate_limited_reset_password(user)` — 3/hour per email
- `ban_user(email)` / `unban_user(email)` — System Manager only
- `admin_delete_user(email)` — Hard delete user + all data

#### File: `exchange_rate.py` (~170 lines)
ETB/USD conversion with fallback chain:
1. Redis cache (6 hours) → 2. Live API → 3. Fallback API → 4. Last known → 5. Hardcoded 130.0

#### File: `user.py` (~34 lines)
User hooks: validate_username_duplicates, on_login, after_insert

### 4.3 Custom DocTypes

**Payment Transaction:**
Fields: user, course, course_title, original_amount, currency, discount_percent, discount_amount, final_amount, payment_method, status (Pending/Processing/Completed/Failed/Pending Verification), expires_at, prepay_id, trade_no, completed_at, error_message, notify_received, notify_payload, ethswitch_order_id, phone, user_reference

**Course Access:**
Fields: user, course, access_start, access_end, is_active, payment_transaction

### 4.4 Frappe Configuration Commands
```bash
bench set-config vimeo_access_token "<SAME-VIMEO-TOKEN-AS-AFRITUTORS>"
bench set-config telebirr_fabric_app_id "<NEW-DELTA-MERCHANT>"
bench set-config telebirr_app_secret "<NEW>"
bench set-config telebirr_merchant_app_id "<NEW>"
bench set-config telebirr_merchant_code "<NEW>"
bench set-config telebirr_private_key "<NEW-RSA-KEY>"
bench set-config telebirr_public_key "<TELEBIRR-PUBLIC-KEY>"
bench set-config telebirr_environment "sandbox"
bench set-config telebirr_notify_url "https://api.deltaspmu.com/api/method/lms.lms.payments_api.telebirr_notify"
bench set-config telebirr_redirect_url "https://learn.deltaspmu.com/payment/success"
bench set-config chapa_secret_key "<NEW>"
bench set-config chapa_webhook_secret "<NEW>"
bench set-config chapa_callback_url "https://api.deltaspmu.com/api/method/lms.lms.payments_api.chapa_webhook"
bench set-config chapa_return_url "https://learn.deltaspmu.com/payment/success"
```

---

## 5. STUDENT PORTAL (React + TypeScript)

### 5.1 Exact Dependencies (package.json)
```json
{
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@tanstack/react-query": "^5.90.12",
    "@vimeo/player": "^2.30.1",
    "autoprefixer": "^10.4.22",
    "axios": "^1.13.2",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dompurify": "^3.3.1",
    "i18next": "^25.8.5",
    "i18next-browser-languagedetector": "^8.2.0",
    "lucide-react": "^0.562.0",
    "postcss": "^8.5.6",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-helmet-async": "^2.0.5",
    "react-hook-form": "^7.68.0",
    "react-hot-toast": "^2.6.0",
    "react-i18next": "^16.5.4",
    "react-router-dom": "^7.10.1",
    "tailwindcss": "^4.1.18",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/postcss": "^4.1.18",
    "@types/dompurify": "^3.0.5",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "typescript": "~5.9.3",
    "vite": "^7.2.4"
  }
}
```

### 5.2 Directory Structure
```
frontend/student-portal/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router + providers
│   ├── index.css                   # Tailwind + theme + fonts
│   ├── api/
│   │   └── client.ts              # Axios + all Frappe API methods
│   ├── context/
│   │   └── AuthContext.tsx         # Auth state (cookie-based)
│   ├── hooks/
│   │   ├── useCourseAccess.ts     # Enrollment + expiry check
│   │   ├── useCoursePrice.ts      # Dynamic pricing
│   │   ├── usePayment.ts          # Payment flow orchestration
│   │   ├── useWishlist.ts         # localStorage wishlist
│   │   └── useNotifications.ts    # In-app notifications
│   ├── pages/
│   │   ├── Login.tsx, Register.tsx, ForgotPassword.tsx, ResetPassword.tsx, VerifyEmail.tsx
│   │   ├── Courses.tsx, CourseDetail.tsx
│   │   ├── Learn.tsx              # Main lesson player
│   │   ├── Quiz.tsx
│   │   ├── Dashboard.tsx, MyCourses.tsx, Profile.tsx
│   │   ├── Certificates.tsx, Wishlist.tsx, Transactions.tsx
│   │   ├── Payment.tsx, PaymentSuccess.tsx
│   │   └── About.tsx, Contact.tsx, HelpCenter.tsx, TermsOfService.tsx, PrivacyPolicy.tsx, RefundPolicy.tsx, CookiePolicy.tsx
│   ├── components/
│   │   ├── Layout.tsx             # Header + nav
│   │   ├── VimeoPlayer.tsx        # Vimeo SDK player
│   │   ├── VideoWatermark.tsx     # Anti-piracy overlay
│   │   ├── CoursePreviewPlayer.tsx
│   │   ├── HeroBannerCarousel.tsx, FeaturedCoursesRow.tsx, BundleOffer.tsx
│   │   ├── CourseReviews.tsx, StarRating.tsx
│   │   ├── LanguageSwitcher.tsx   # EN/AM toggle
│   │   ├── AccessExpiredModal.tsx, AccessExpiringBanner.tsx
│   │   ├── SafeHTML.tsx, SEO.tsx, ErrorBoundary.tsx
│   │   ├── Pagination.tsx, Skeleton.tsx, ScrollToTop.tsx
│   │   └── Toast.tsx, SkipLink.tsx
│   ├── lib/
│   │   ├── utils.ts              # URL builders, formatters
│   │   ├── analytics.ts          # GA4 integration
│   │   └── dateLocale.ts
│   ├── i18n/
│   │   ├── i18n.ts               # i18next config
│   │   └── locales/
│   │       ├── en/ (common.json, pages.json, legal.json)
│   │       └── am/ (common.json, pages.json, legal.json)
│   └── types/
│       └── index.ts              # TypeScript interfaces
├── vercel.json
├── vite.config.ts
├── tailwind.config.js (or index.css @theme)
├── tsconfig.json
└── index.html
```

### 5.3 Key Architecture Patterns

**API Client Pattern** (`api/client.ts`):
```typescript
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://api.deltaspmu.com');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,  // Frappe cookie-based auth
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// CSRF interceptor - REQUIRED for POST/PUT/DELETE to Frappe
api.interceptors.request.use((config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf_token='))
      ?.split('=')[1];
    if (csrfToken) {
      config.headers['X-Frappe-CSRF-Token'] = decodeURIComponent(csrfToken);
    }
  }
  return config;
});

// Session expiry handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

**Auth Context Pattern:**
- Cookie-based sessions (Frappe sets httpOnly session cookie)
- `withCredentials: true` on all Axios requests
- User stored in localStorage for persistence across refreshes
- Admin users redirected to Frappe Desk (skip with env flag in dev)

**Route Structure:**
```
/login, /register, /forgot-password, /reset-password, /verify  (Public)
/courses, /course/:courseId                                      (Public)
/dashboard, /my-courses, /profile, /certificates, /wishlist     (Protected)
/learn/:courseId, /learn/:courseId/:lessonId                     (Protected)
/quiz/:quizId                                                    (Protected)
/payment/:courseId, /payment/success                             (Protected)
/transactions                                                    (Protected)
/terms, /privacy, /refund, /cookies, /help, /contact, /about    (Public)
```

**Vite Dev Proxy** (`vite.config.ts`):
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'https://api.deltaspmu.com', changeOrigin: true, secure: true },
      '/files': { target: 'https://api.deltaspmu.com', changeOrigin: true, secure: true },
    },
  },
});
```

**Vercel Config** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/((?!api|files|assets).*)", "destination": "/" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### 5.4 Vimeo Integration Pattern
- Uses `@vimeo/player` SDK
- Videos are **unlisted** with privacy hashes
- Stored in DB as `"video_id/hash"` format
- Frontend extracts: `id = value.split('/')[0]`, `hash = value.split('/')[1]`
- Progress saved to localStorage: `vimeo_progress_{lessonId}`
- Completion threshold: 90% watched triggers lesson complete
- Watermark overlay shows user email (anti-piracy)

### 5.5 i18n Setup
- i18next with browser language detection
- localStorage persistence (`i18nextLng` key)
- 3 namespaces: `common` (nav/buttons), `pages` (page-specific), `legal` (terms/privacy)
- Language switcher component toggles EN/AM
- Updates `document.documentElement.lang` attribute

---

## 6. ADMIN PORTAL (React + TypeScript)

### 6.1 Exact Dependencies (package.json)
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.12",
    "@tiptap/extension-link": "^3.20.0",
    "@tiptap/extension-placeholder": "^3.20.0",
    "@tiptap/pm": "^3.20.0",
    "@tiptap/react": "^3.20.0",
    "@tiptap/starter-kit": "^3.20.0",
    "autoprefixer": "^10.4.22",
    "axios": "^1.13.2",
    "date-fns": "^4.1.0",
    "i18next": "^25.8.5",
    "i18next-browser-languagedetector": "^8.2.0",
    "lucide-react": "^0.575.0",
    "postcss": "^8.5.6",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-i18next": "^16.5.4",
    "react-router-dom": "^7.10.1",
    "tailwindcss": "^4.1.18",
    "tus-js-client": "^4.3.1"
  }
}
```

### 6.2 Directory Structure
```
frontend/admin-portal/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Sidebar layout + routes
│   ├── index.css
│   ├── api/
│   │   ├── client.ts             # Frappe API client (with CSRF)
│   │   ├── vimeo.ts              # Vimeo service (direct + proxy modes)
│   │   └── emailClient.ts        # Email Lambda API client
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── components/
│   │   └── LanguageSwitcher.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx          # Stats, recent courses, enrollments
│   │   ├── Courses.tsx            # Course list (grid/list, filter, search)
│   │   ├── CourseEditor.tsx       # Create/edit course, chapters, lessons, video picker
│   │   ├── Videos.tsx             # Video library (Vimeo), upload, delete
│   │   ├── Users.tsx              # User CRUD, role management, ban/unban
│   │   ├── Enrollments.tsx        # Track enrollments
│   │   ├── Payments.tsx           # Revenue dashboard
│   │   ├── Quizzes.tsx            # Quiz CRUD with questions
│   │   ├── Certificates.tsx       # Issued certificates
│   │   ├── Analytics.tsx          # Progress distribution, top courses
│   │   ├── Categories.tsx         # Course categories
│   │   ├── Reviews.tsx            # Course reviews
│   │   ├── Settings.tsx           # Platform config
│   │   ├── EmailInbox.tsx         # Email management
│   │   ├── EmailCompose.tsx       # Compose/reply
│   │   └── EmailAddresses.tsx     # Verified email addresses
│   ├── types/
│   │   ├── index.ts
│   │   └── email.ts
│   └── i18n/
│       ├── i18n.ts
│       └── locales/ (en/, am/)
├── vercel.json
├── vite.config.ts
└── package.json
```

### 6.3 Admin Routes
```
/login                                    (Public)
/dashboard                                (Protected - all below)
/courses, /courses/new, /courses/:id
/categories
/videos
/users
/enrollments
/quizzes
/certificates
/reviews
/payments
/analytics
/email, /email/compose, /email/:id
/email/addresses
/settings
```

### 6.4 Vimeo Service Pattern (`api/vimeo.ts`)
Two modes:
- **Dev**: Direct Vimeo API with `VITE_VIMEO_ACCESS_TOKEN`
- **Prod**: Proxy through Frappe backend at `/api/method/lms.lms.api.vimeo_*`

Toggle via `VITE_USE_VIMEO_PROXY` env var.

**Tag videos as `deltaspmu-lms`** (not `afritutors-lms`) to filter in shared Vimeo account.

**Upload flow**: Create video → get TUS URL → upload via `tus-js-client` → tag → whitelist embed domains

### 6.5 CSRF Token Pattern (Admin Portal)
The admin portal uses a **different** CSRF approach than the student portal because it's cross-origin (Vercel vs api.deltaspmu.com):
```typescript
// Cannot read csrf_token cookie cross-origin
// Instead: fetch token via API endpoint, cache it
let cachedToken: string | null = null;

async function getCSRFToken() {
  if (!cachedToken) {
    const response = await axios.get('/api/method/lms.lms.api.get_csrf_token');
    cachedToken = response.data.message;
  }
  return cachedToken;
}

// Request interceptor
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-Frappe-CSRF-Token'] = await getCSRFToken();
  }
  return config;
});
```

### 6.6 Admin Vercel Config
```json
{
  "build": {
    "env": {
      "VITE_API_URL": "https://api.deltaspmu.com",
      "VITE_USE_VIMEO_PROXY": "true"
    }
  },
  "rewrites": [{ "source": "/((?!api|files).*)", "destination": "/" }],
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

---

## 7. MARKETING SITE

**Already built** at `C:\Users\ASUS\Desktop\Delta_SPMU\`. React + Vite + Tailwind + Framer Motion.

### What Needs to Change
1. **Footer links**: Currently points to `learn.afritutors.com` / `admin.afritutors.com` → change to Delta SPMU domains
2. **Add config.js**: Centralized URL configuration with `studentPortalLive` toggle
3. **Add legal pages**: `/privacy`, `/terms`, `/refund` with React Router
4. **Add SEO meta tags**: OG tags, Twitter cards in `index.html`
5. **Deployment**: Build → S3 sync → CloudFront invalidation
6. **CloudFront**: Error pages 403/404 → `/index.html` (for client-side routing)

---

## 8. DEPLOYMENT PROCEDURES

### 8.1 Backend (Frappe on EC2)
```bash
# Copy files to server
scp backend/frappe-lms/lms/lms/*.py ubuntu@<EC2-IP>:/tmp/
ssh ubuntu@<EC2-IP> "sudo cp /tmp/*.py /home/frappe/deltaspmu/apps/lms/lms/lms/"
ssh ubuntu@<EC2-IP> "sudo chown -R frappe:frappe /home/frappe/deltaspmu/apps/lms/"

# If new @frappe.whitelist() methods added, clear .pyc cache:
ssh ubuntu@<EC2-IP> "sudo rm -f /home/frappe/deltaspmu/apps/lms/lms/lms/__pycache__/*.pyc"

# Restart
ssh ubuntu@<EC2-IP> "cd /home/frappe/deltaspmu && sudo -u frappe /home/frappe/.local/bin/bench restart"
```

### 8.2 Frontend (Vercel)
- Push to GitHub → Vercel auto-deploys
- Set env vars in Vercel dashboard:
  - `VITE_API_URL=https://api.deltaspmu.com`
  - `VITE_USE_VIMEO_PROXY=true` (admin only)
- Custom domains: `learn.deltaspmu.com`, `admin.deltaspmu.com`

### 8.3 Marketing (S3 + CloudFront)
```bash
cd frontend/marketing-site
npm run build
aws s3 sync dist/ s3://deltaspmu-marketing --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

---

## 9. CRITICAL PITFALLS & LESSONS LEARNED

These are hard-won lessons from building Afritutors. Follow them exactly:

### Frappe Backend
1. **NEVER use `frappe.get_doc()` in guest endpoints** — it throws PermissionError. Use `frappe.db.get_value()` or `frappe.db.get_list()` instead.
2. **The course price field is `course_price`**, not `price`. The LMS Course doctype uses this specific field name.
3. **CSRF is required on all POST/PUT/DELETE** to Frappe. GET requests bypass CSRF entirely. When in doubt, use GET-based endpoints.
4. **After adding new `@frappe.whitelist()` methods**, you MUST clear `.pyc` cache files on the server, then restart bench. Otherwise the old cached bytecode runs.
5. **Frappe sessions are cookie-based**. The frontend must use `withCredentials: true` on all Axios requests.
6. **`@frappe.whitelist()` (without `allow_guest=True`)** will block unauthenticated requests. This is expected behavior, not a bug.

### Frontend
7. **Cross-origin CSRF**: The admin portal (on Vercel) cannot read the `csrf_token` cookie set by the API (different domain). Solution: Fetch token via a dedicated API endpoint and cache it.
8. **Vimeo videos are unlisted** with privacy hashes stored as `"id/hash"` in the `lesson.youtube` field. The frontend must split this to pass `id` and `h` separately to the Vimeo SDK.
9. **Payment endpoints use GET** (not POST) to bypass cross-origin CSRF issues. This was a deliberate architectural decision.
10. **localStorage keys must be namespaced per-project**: Use `deltaspmu_` prefix (not `afritutors_`) for wishlist, payments, pending_payment.

### Infrastructure
11. **No NAT Gateway** — saves ~$35/month. All subnets are public.
12. **RDS is not publicly accessible** — only reachable from EC2 security group. This is correct and intentional.
13. **Cloudflare SSL mode must be "Full (strict)"** for proper HTTPS.
14. **CloudFront error pages**: MUST return `/index.html` for 403/404 errors with HTTP 200 status code. Without this, React Router URLs will fail on direct navigation.

### Vimeo
15. **Tag-based filtering**: Since both Afritutors and Delta SPMU share the same Vimeo account, use different tags (`deltaspmu-lms` vs `afritutors-lms`) to filter videos per platform.
16. **Embed domain whitelist**: Videos must have Delta SPMU domains whitelisted, otherwise they won't play in the portals.

---

## 10. CLAUDE PROMPTS (Copy-Paste Ready)

Below are the exact prompts to use with Claude Opus in sequence. Each prompt builds on the previous work.

---

### PROMPT 1: Project Initialization

```
I'm building a new e-learning platform called "Delta SPMU Academy" for permanent makeup training. I have a complete build guide document at DELTA_SPMU_BUILD_GUIDE.md in my project root — read it thoroughly before proceeding.

Initialize the project with this structure:

Delta-SPMU-elearning/
├── frontend/
│   ├── marketing-site/     # (I'll move this in manually)
│   ├── student-portal/
│   └── admin-portal/
├── backend/
│   ├── frappe-lms/
│   │   └── lms/
│   │       └── lms/        # Custom API files go here
│   └── payments/           # Payment provider integrations
├── infrastructure/         # Terraform
├── scripts/                # Deployment scripts
├── docs/
└── .claude/

Create:
1. A root .gitignore (Node, Python, Terraform, IDE files, .env, tfstate, tfvars)
2. A CLAUDE.md with project overview, key URLs (using deltaspmu.com domain), server commands, API patterns, and the critical Frappe notes from the build guide
3. A README.md with project overview
4. Empty placeholder directories

Do NOT create any source code yet — just the project scaffold and documentation.
```

---

### PROMPT 2: Terraform Infrastructure

```
Read DELTA_SPMU_BUILD_GUIDE.md section 3 (Infrastructure).

Create the complete Terraform configuration for Delta SPMU:

1. infrastructure/main.tf — All core AWS resources:
   - VPC (10.0.0.0/16) with 2 public subnets in eu-central-1
   - Internet Gateway + route table
   - EC2 t3.small with 30GB gp3, user data script for Frappe prerequisites
   - Elastic IP
   - RDS MariaDB 10.11 db.t3.micro, 20GB, database "deltaspmu"
   - Security groups (web: 80,443,22,8000; db: 3306 from web SG)
   - S3 bucket for assets
   - SSH key pair
   - All proper tags with project_name and environment variables

2. infrastructure/.gitignore — Ignore tfstate, tfvars, .terraform

Use project_name="deltaspmu", environment="dev", region eu-central-1.
Use the exact same patterns as described in the build guide.
Do NOT create email.tf yet — we'll do that separately.
```

---

### PROMPT 3: Email Infrastructure (Terraform)

```
Read DELTA_SPMU_BUILD_GUIDE.md section 3.3 (Email Infrastructure).

Create infrastructure/email.tf with:
1. DynamoDB tables (emails + email-contacts) with all GSIs
2. S3 bucket for email attachments (versioned, encrypted, lifecycle policy)
3. Lambda functions (8 functions, Node.js 20.x, 256MB, 30s timeout) — create placeholder handler code
4. API Gateway (REST, Regional) with all routes and CORS config
5. IAM roles and policies for Lambda
6. SSM Parameter Store entries for secrets

CORS origin should be https://admin.deltaspmu.com
All resource names use deltaspmu prefix.
```

---

### PROMPT 4: Backend API Files

```
Read DELTA_SPMU_BUILD_GUIDE.md section 4 (Backend) thoroughly.

Create all the custom Frappe API files for Delta SPMU. These are Python files that go in backend/frappe-lms/lms/lms/:

1. api.py — Main API module with all endpoints listed in the build guide. This is the largest file (~2500 lines). Include:
   - get_csrf_token, get_user_info, get_branding
   - Course CRUD helpers
   - Enrollment management
   - Certificate endpoints
   - User profile management
   - All the endpoints listed in section 4.2

2. custom_api.py — Learning progress, quizzes, certificates:
   - get_instructor_profile, mark_lesson_complete, get_course_progress
   - Quiz CRUD and grading (server-side, never expose correct answers)
   - check_lesson_access (sequential gating)
   - check_final_quiz_access
   - check_and_generate_certificate (auto-generate)

3. payments_api.py — Payment endpoints:
   - Use BASE_PRICE=5000, BUNDLE_PRICE=5000, ACCESS_DURATION_DAYS=30
   - Transaction ID prefix: "DS-" (not "AT-")
   - BUNDLE_ID = "all-courses-bundle"
   - All payment endpoints from the build guide

4. telebirr.py — telebirr integration with RSA-PSS signing

5. vimeo_api.py — Vimeo proxy with tag "deltaspmu-lms" and Delta SPMU embed domains

6. security.py — Rate limiting, ban/unban, admin delete user

7. exchange_rate.py — ETB/USD conversion with fallback chain

8. user.py — User hooks

CRITICAL RULES:
- Use frappe.db.get_value() for guest endpoints, NEVER frappe.get_doc()
- Course price field is "course_price" not "price"
- All webhook endpoints must verify signatures before processing
- Payment GET endpoints bypass CSRF (intentional design)
```

---

### PROMPT 5: Payment Provider Integrations

```
Read DELTA_SPMU_BUILD_GUIDE.md sections 4.2 (payments_api.py) and the payment provider details.

Create backend/payments/:
1. chapa.py — Chapa payment integration:
   - initialize_transaction(transaction_doc, currency) → hosted checkout
   - verify_transaction(tx_ref) → check payment status
   - verify_webhook_signature(payload, signature) → HMAC SHA256
   - process_webhook(payload) → handle payment notification
   - create_enrollment(transaction) → create Course Access + LMS Enrollment
   - Base URL: https://api.chapa.co/v1

2. ethswitch.py — EthSwitch NPG integration:
   - register_order(transaction_doc) → POST /register.do
   - get_order_status(order_id) → GET /getOrderStatus.do
   - reverse_order / refund_order
   - process_return / process_webhook
   - Currency code 230 (ETB), amount in santim (ETB × 100)
   - Base URL from config: ethswitch_base_url

3. README.md — Document all payment providers, their endpoints, and required config keys

All payment modules must:
- Create Course Access records (30-day window) after successful payment
- Create LMS Enrollment records
- Send confirmation emails
- Verify webhook signatures before processing
- Log all payment events
```

---

### PROMPT 6: Student Portal — Scaffold & Core

```
Read DELTA_SPMU_BUILD_GUIDE.md section 5 (Student Portal).

Create the student portal at frontend/student-portal/. Set up:

1. package.json with exact dependencies from the build guide
2. vite.config.ts with proxy to api.deltaspmu.com
3. tsconfig.json, postcss.config.js, eslint.config.js
4. vercel.json (from build guide)
5. index.html with Delta SPMU branding, meta tags, OG tags

6. src/index.css — Tailwind v4 imports + custom theme:
   - Primary: #D1BFAE (nude)
   - Dark: #121212 (charcoal)
   - Font faces for Wensley (heading) and Visia Pro (body) — use Inter as fallback since we don't have these fonts for the portal, we'll add them later
   - Selection color, scrollbar, focus styles

7. src/main.tsx — Entry point with i18n init
8. src/App.tsx — Full router setup with:
   - BrowserRouter
   - AuthProvider + QueryClientProvider
   - All routes from build guide (lazy-loaded non-critical pages)
   - ProtectedRoute + PublicRoute HOCs

9. src/api/client.ts — Complete Axios client with:
   - CSRF interceptor (cookie extraction for same-origin)
   - 401 session expiry handler
   - ALL Frappe API methods (50+ endpoints from build guide)

10. src/context/AuthContext.tsx — Complete auth context
11. src/types/index.ts — All TypeScript interfaces (User, Course, Chapter, Lesson, Quiz, Certificate, PaymentInfo, etc.)

Use "deltaspmu" namespace for all localStorage keys.
Admin emails: ['Administrator', 'administrator@deltaspmu.com']
```

---

### PROMPT 7: Student Portal — Hooks & Utilities

```
Create the custom hooks and utility files for the student portal:

1. src/hooks/useCourseAccess.ts — Check enrollment + access expiry
   - Try get_course_access API first
   - Fallback to Course Membership
   - Track days remaining, isExpiringSoon (<7 days)

2. src/hooks/useCoursePrice.ts — Dynamic pricing with currency support
   - Fetch from get_course_price API
   - Fallback to 5000 ETB default
   - Support ETB/USD

3. src/hooks/usePayment.ts — Payment orchestration
   - Transaction storage in localStorage (per-user, max 50)
   - Poll-based async verification (5s intervals, 5min timeout)
   - Pending payment recovery on page reload
   - Support: telebirr, cbe, chapa, chapa_international, ethswitch

4. src/hooks/useWishlist.ts — localStorage wishlist (per-user)
5. src/hooks/useNotifications.ts — In-app toast notifications

6. src/lib/utils.ts — Helper functions:
   - getFileUrl(path) — Frappe file URL resolution
   - getCourseImageUrl(course) — Course image with fallback
   - getUserAvatarUrl(user) — Avatar with placeholder
   - formatPrice(amount, currency)
   - formatDuration(minutes)

7. src/lib/analytics.ts — GA4 integration (event tracking, page views)

8. src/i18n/i18n.ts — i18next config with browser detection + localStorage
9. src/i18n/locales/en/common.json — Navigation, buttons, labels (use "Delta SPMU Academy")
10. src/i18n/locales/en/pages.json — Page-specific text
11. src/i18n/locales/en/legal.json — Legal page text
12. src/i18n/locales/am/ — Amharic translations (can be placeholder text for now)
```

---

### PROMPT 8: Student Portal — Pages (Auth + Courses)

```
Create the authentication and course browsing pages:

1. src/pages/Login.tsx — Split layout (branding left, form right)
   - Email/password login
   - Redirect tracking (return to original page after login)
   - Error handling for disabled/unverified accounts
   - Links to register/forgot-password

2. src/pages/Register.tsx — Two-step: form → success
   - Uses Frappe sign_up endpoint
   - Resend verification email with cooldown
   - Handles response codes (0=exists, 1=sent, 2=created)

3. src/pages/ForgotPassword.tsx — Email input → reset link sent
4. src/pages/ResetPassword.tsx — New password form with key validation
5. src/pages/VerifyEmail.tsx — Email verification with resend option

6. src/pages/Courses.tsx — Course browsing
   - Hero carousel
   - Category filters + search
   - Responsive course grid (12 per page, pagination)
   - Course card: image, title, instructor, price, rating

7. src/pages/CourseDetail.tsx — Full course overview
   - Preview Vimeo video player
   - Course description, instructor, reviews
   - Lesson outline with progress
   - Enroll/purchase button based on access status
   - Bundle offer promo

Use Delta SPMU branding: nude (#D1BFAE) primary, charcoal (#121212) dark.
All text should reference "Delta SPMU Academy" not "Afritutors".
```

---

### PROMPT 9: Student Portal — Learning Pages

```
Create the core learning experience pages:

1. src/pages/Learn.tsx — Main lesson player (most complex page):
   - Two-column: video player + course outline sidebar
   - VimeoPlayer component with progress tracking
   - VideoWatermark overlay (user email, anti-piracy)
   - EditorJS content rendering (paragraphs, headers, lists, images, code)
   - Lesson completion at 90% watched
   - Access control: check enrollment + validate lesson access
   - Access expiry banner if <7 days remaining
   - Next/Previous lesson navigation
   - Quiz indicator in sidebar

2. src/pages/Quiz.tsx — Quiz taking
   - Single + multiple choice questions
   - Answer submission with validation
   - Server-side grading (score, pass/fail)
   - Auto-marks lesson complete on pass

3. src/components/VimeoPlayer.tsx — Vimeo SDK integration
   - Supports listed (by ID) and unlisted (ID + hash) videos
   - Progress callbacks, completion threshold
   - Resume from localStorage position
   - Error handling with fallback

4. src/components/VideoWatermark.tsx — Semi-transparent overlay
5. src/components/CoursePreviewPlayer.tsx — Preview video for course detail page

Handle the "id/hash" video format: split on "/" to get id and privacy hash.
```

---

### PROMPT 10: Student Portal — Dashboard, Profile, Payments

```
Create the remaining student portal pages:

1. src/pages/Dashboard.tsx — Learning stats (enrolled, completed, hours, certificates), in-progress courses, recommendations
2. src/pages/MyCourses.tsx — Enrolled courses with progress, filter by status
3. src/pages/Profile.tsx — Avatar upload, name/bio editing, password change, notification preferences, account deletion
4. src/pages/Certificates.tsx — Earned certificates with download links
5. src/pages/Wishlist.tsx — Saved courses
6. src/pages/Transactions.tsx — Payment history (date, course, amount, status, method)

7. src/pages/Payment.tsx — Multi-step payment flow:
   - Method selection (telebirr, cbe, chapa, chapa_international, ethswitch)
   - Dynamic pricing (ETB/USD)
   - Bundle purchase for all 4 courses
   - Transaction history in localStorage
   - Polling for async verification

8. src/pages/PaymentSuccess.tsx — Confirmation + course access setup

9. Static pages: About.tsx, Contact.tsx, HelpCenter.tsx, TermsOfService.tsx, PrivacyPolicy.tsx, RefundPolicy.tsx, CookiePolicy.tsx
   - All with Delta SPMU Academy branding and SPMU-specific content
```

---

### PROMPT 11: Student Portal — Shared Components

```
Create all remaining shared components for the student portal:

1. src/components/Layout.tsx — App shell with header, navigation, mobile menu. Delta SPMU logo.
2. src/components/HeroBannerCarousel.tsx — Featured courses carousel for homepage
3. src/components/FeaturedCoursesRow.tsx — Course grid display
4. src/components/BundleOffer.tsx — "All 4 courses" bundle promotion
5. src/components/CourseReviews.tsx — Star ratings and review display
6. src/components/StarRating.tsx — 5-star component
7. src/components/WishlistButton.tsx — Heart icon toggle
8. src/components/NotificationDropdown.tsx — Notification bell
9. src/components/LanguageSwitcher.tsx — EN/AM toggle
10. src/components/AccessExpiredModal.tsx — "Your access has expired" modal
11. src/components/AccessExpiringBanner.tsx — "7 days remaining" warning
12. src/components/SafeHTML.tsx — DOMPurify wrapper for user content
13. src/components/SEO.tsx — react-helmet-async meta tags
14. src/components/ErrorBoundary.tsx — React error boundary
15. src/components/Pagination.tsx — Page navigation
16. src/components/Skeleton.tsx — Loading skeleton UI
17. src/components/ScrollToTop.tsx — Auto-scroll on route change
18. src/components/Toast.tsx — react-hot-toast container
19. src/components/SkipLink.tsx — Accessibility skip link
```

---

### PROMPT 12: Admin Portal — Complete Build

```
Read DELTA_SPMU_BUILD_GUIDE.md section 6 (Admin Portal).

Create the complete admin portal at frontend/admin-portal/. This is a sidebar-layout dashboard for managing the e-learning platform.

Build ALL of the following in one go:

1. Project setup: package.json (deps from build guide), vite.config.ts, vercel.json, tsconfig, postcss, eslint, index.html

2. Core: main.tsx, App.tsx (sidebar + routes), index.css (Delta SPMU theme)

3. API layer:
   - api/client.ts — Frappe API with CSRF token fetched via API (cross-origin pattern)
   - api/vimeo.ts — VimeoService + VimeoProxyService with tag "deltaspmu-lms"
   - api/emailClient.ts — Email Lambda API client

4. Auth: context/AuthContext.tsx

5. ALL pages:
   - Login.tsx — Admin login
   - Dashboard.tsx — Stats grid, recent courses/enrollments, quick actions
   - Courses.tsx — List with grid/list view, filter, search, clone, delete
   - CourseEditor.tsx — Full course editor with chapters, lessons, video picker modal, rich text (Tiptap)
   - Videos.tsx — Vimeo video library, upload with TUS, delete
   - Users.tsx — User CRUD, role management, ban/unban
   - Enrollments.tsx — Enrollment tracking
   - Payments.tsx — Revenue dashboard with stats
   - Quizzes.tsx — Quiz CRUD with question management
   - Certificates.tsx — Issued certificates
   - Analytics.tsx — Charts, progress distribution, top courses
   - Categories.tsx — Course category management
   - Reviews.tsx — Course reviews
   - Settings.tsx — Platform settings, integrations, account
   - EmailInbox.tsx, EmailCompose.tsx, EmailAddresses.tsx — Email system

6. Types: types/index.ts, types/email.ts
7. i18n: English + Amharic translations
8. Component: LanguageSwitcher.tsx

Use Delta SPMU branding. The sidebar should use charcoal background with nude accent.
Admin URL: https://admin.deltaspmu.com
API URL: https://api.deltaspmu.com
```

---

### PROMPT 13: Marketing Site Updates

```
The Delta SPMU marketing site already exists. Update it:

1. Add src/config.js with:
   - studentPortalLive: false (toggle when ready)
   - studentPortalUrl: https://learn.deltaspmu.com
   - signupUrl, loginUrl, coursesUrl

2. Update FooterCTA.jsx:
   - Change portal links from afritutors.com to deltaspmu.com domains

3. Add React Router with legal pages:
   - /privacy — Privacy policy (SPMU-specific)
   - /terms — Terms of service
   - /refund — Refund policy

4. Update index.html with proper SEO meta tags, OG tags, Twitter cards

5. Create DEPLOYMENT.md with S3 + CloudFront deployment steps
```

---

### PROMPT 14: Deployment Scripts & Documentation

```
Create deployment tooling:

1. scripts/deploy-backend.sh — Automates: scp files → clear pyc cache → restart bench
2. scripts/deploy-marketing.sh — Automates: build → s3 sync → cloudfront invalidation
3. scripts/setup-frappe.sh — EC2 setup: install deps, create frappe user, bench init, new site, install LMS
4. scripts/configure-frappe-email.sh — Set up Frappe email account

5. docs/ARCHITECTURE_OVERVIEW.md — Platform architecture with diagrams
6. docs/DEPLOYMENT_GUIDE.md — Step-by-step for all components
7. docs/PAYMENT_INTEGRATION.md — Payment provider setup and troubleshooting
8. docs/BACKEND_QUICK_REFERENCE.md — Common server commands

All scripts should use deltaspmu naming and the correct server IP (to be filled in after Terraform).
```

---

### PROMPT 15: Integration Testing & Polish

```
Review the entire Delta SPMU codebase for:

1. Any remaining "afritutors" or "Afritutors" references — replace with "deltaspmu" / "Delta SPMU Academy"
2. Any hardcoded URLs pointing to afritutors.com domains
3. localStorage keys that should use deltaspmu_ prefix
4. Vimeo tags that should be deltaspmu-lms
5. Admin email lists
6. Transaction ID prefixes (should be DS-, not AT-)
7. Bundle references (should say "all 4 courses", not "all 6 courses")
8. Color values (should use #D1BFAE nude, not #F05537 orange)

Fix all issues found. Then verify:
- All API endpoints in client.ts match backend endpoint names
- All routes in App.tsx have corresponding page components
- All imports resolve correctly
- TypeScript types are consistent between frontend and backend
```

---

### BONUS PROMPT: If You Need to Debug Frappe Issues

```
I'm having an issue with my Frappe backend for the Delta SPMU e-learning platform.

Key context:
- Frappe LMS on EC2 (api.deltaspmu.com)
- Custom APIs at /home/frappe/deltaspmu/apps/lms/lms/lms/
- Frontend on Vercel (cross-origin)
- MariaDB on RDS

Critical Frappe patterns to remember:
1. frappe.db.get_value() for guest endpoints (not frappe.get_doc())
2. course_price field (not price)
3. CSRF required on POST/PUT/DELETE (GET bypasses)
4. Clear .pyc cache after adding new @frappe.whitelist() methods
5. withCredentials: true on all Axios requests
6. Cross-origin CSRF: fetch token via API, don't try to read cookies

The issue is: [DESCRIBE YOUR ISSUE HERE]
```

---

## APPENDIX: Environment Variables Reference

### Student Portal (.env)
```
VITE_API_URL=https://api.deltaspmu.com
VITE_FRAPPE_DESK_URL=https://api.deltaspmu.com
VITE_SKIP_ADMIN_REDIRECT=false
VITE_GA_MEASUREMENT_ID=
```

### Admin Portal (.env)
```
VITE_API_URL=https://api.deltaspmu.com
VITE_VIMEO_ACCESS_TOKEN=<token>        # Dev only
VITE_USE_VIMEO_PROXY=false             # true in production
VITE_EMAIL_API_URL=<api-gateway-url>
VITE_EMAIL_API_KEY=<api-key>
```

### Marketing Site (.env.production)
```
VITE_STUDENT_PORTAL_URL=https://learn.deltaspmu.com
```

### Terraform (terraform.tfvars) — DO NOT COMMIT
```
project_name    = "deltaspmu"
environment     = "dev"
db_password     = "<secure-password>"
ssh_public_key  = "<your-ssh-public-key>"
ami_id          = "<ubuntu-ami-id>"
```

### Frappe Server (bench set-config)
```
vimeo_access_token
telebirr_fabric_app_id, telebirr_app_secret, telebirr_merchant_app_id
telebirr_merchant_code, telebirr_private_key, telebirr_public_key
telebirr_environment, telebirr_notify_url, telebirr_redirect_url
chapa_secret_key, chapa_webhook_secret, chapa_callback_url, chapa_return_url
ethswitch_username, ethswitch_password, ethswitch_base_url, ethswitch_return_url
```
