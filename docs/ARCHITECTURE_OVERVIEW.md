# Delta SPMU Academy — Architecture Overview

## System Architecture

```
                         Cloudflare DNS + SSL
                    (Full strict mode, proxied)
                                |
         +----------------------+----------------------+
         |                      |                      |
    S3 + CloudFront          Vercel                 Vercel
    (Marketing Site)    (Student Portal)       (Admin Portal)
    deltaspmu.com       learn.deltaspmu.com    admin.deltaspmu.com
         |                      |                      |
         +----------------------+----------------------+
                                |
                         EC2 (t3.small)
                       api.deltaspmu.com
                     Frappe v15 + Nginx
                      Custom Python APIs
                                |
                   +------------+------------+
                   |                         |
             RDS MariaDB              Redis (local)
            (db.t3.micro)           (session cache)
            MariaDB 10.11
                   |
      +------------+------------+------------+
      |            |            |            |
   Vimeo      telebirr/     Resend     AWS Lambda
  (Videos)    Chapa/CBE    (Email)    + DynamoDB
             EthSwitch                (Email CRM)
            (Payments)
```

## Tech Stack

| Layer              | Technology                                          |
|--------------------|-----------------------------------------------------|
| Frontend framework | React 19 + TypeScript + Vite                        |
| Styling            | Tailwind CSS 4                                      |
| State management   | React Context (auth) + TanStack React Query (data)  |
| Backend framework  | Frappe v15 (Python) with LMS app                    |
| Database           | MariaDB 10.11 on AWS RDS                            |
| Compute            | AWS EC2 t3.small (Ubuntu 22.04)                     |
| Video hosting      | Vimeo (shared account, tag: `deltaspmu-lms`)        |
| Frontend hosting   | Vercel (auto-deploy from GitHub)                    |
| Marketing hosting  | AWS S3 + CloudFront                                 |
| DNS + SSL          | Cloudflare                                          |
| Email (transact.)  | Frappe email / Resend                                |
| Email (CRM)        | AWS Lambda + DynamoDB + API Gateway + Resend        |
| Payments           | telebirr, Chapa, EthSwitch, CBE                     |
| Infrastructure     | Terraform                                           |

## Component Descriptions

### Marketing Site (`deltaspmu.com`)

Static marketing site built with Vite + Tailwind CSS. Hosted on S3 behind CloudFront for global CDN delivery. Contains:

- Landing page with course overview
- Pricing and bundle offers
- FAQ and contact sections
- Links to student portal for enrollment

Source: project root (`src/`, `index.html`, `public/`).

### Student Portal (`learn.deltaspmu.com`)

Full React SPA for students. Hosted on Vercel with auto-deploy from GitHub. Features:

- Account registration, login, password reset
- Course browsing and enrollment
- Video lessons via Vimeo embed (unlisted, domain-whitelisted)
- Sequential lesson gating (must complete previous lesson)
- Quizzes with server-side grading
- Auto-generated certificates on course completion
- Payment integration (telebirr, Chapa, EthSwitch, CBE)
- Multi-language support (English + Amharic)
- 30-day access windows per course

Source: `frontend/student-portal/`.

### Admin Portal (`admin.deltaspmu.com`)

React SPA for administrators. Hosted on Vercel. Features:

- Course, chapter, and lesson management
- Quiz creation and management
- Video upload/management via Vimeo proxy (token never exposed to browser)
- Student enrollment and progress tracking
- Payment verification (manual CBE transfers)
- User management (ban, unban, delete)
- Email CRM (via Lambda backend)
- Instructor profile management

Source: `frontend/admin-portal/`.

### Backend API (`api.deltaspmu.com`)

Frappe v15 running on EC2 with Nginx reverse proxy. Custom Python API modules:

| File               | Purpose                                              |
|--------------------|------------------------------------------------------|
| `api.py`           | Core API: auth, courses, enrollment, profiles        |
| `custom_api.py`    | Learning progress, quizzes, certificates             |
| `payments_api.py`  | Payment initiation, verification, webhooks           |
| `telebirr.py`      | telebirr RSA-PSS integration                         |
| `vimeo_api.py`     | Server-side Vimeo proxy                              |
| `security.py`      | Rate limiting, user banning                          |
| `exchange_rate.py` | ETB/USD conversion with fallback chain               |
| `user.py`          | User lifecycle hooks                                 |

Files deployed to: `/home/frappe/deltaspmu/apps/lms/lms/lms/`

### Infrastructure

All AWS resources managed by Terraform in `infrastructure/`:

- **VPC**: `10.0.0.0/16` with 2 public subnets in `eu-central-1`
- **EC2**: t3.small with 30GB gp3, Elastic IP
- **RDS**: MariaDB 10.11 db.t3.micro, 20GB (private, EC2 access only)
- **S3**: Marketing site bucket + email attachments bucket
- **CloudFront**: CDN for marketing site
- **Lambda + DynamoDB + API Gateway**: Email CRM service
- **SSM Parameter Store**: Secrets (Resend API key, webhook secret)

## Data Flow: User Journey

```
1. DISCOVER
   User visits deltaspmu.com (S3/CloudFront)
   Browses courses, pricing, FAQs
        |
        v
2. SIGN UP
   Clicks "Enroll" -> redirected to learn.deltaspmu.com/register
   Frappe creates user account, sends verification email
        |
        v
3. ENROLL + PAY
   User selects course -> chooses payment method
   Frontend calls api.deltaspmu.com/api/method/lms.lms.payments_api.initiate_payment
   Redirected to payment provider (telebirr/Chapa/EthSwitch)
   Provider sends webhook -> backend verifies -> creates Course Access (30 days)
        |
        v
4. LEARN
   User accesses learn.deltaspmu.com/learn/<course>
   Sequential lesson gating: must complete lessons in order
   Videos streamed from Vimeo (unlisted, domain-restricted)
   Progress tracked per lesson via Frappe API
        |
        v
5. ASSESS
   Lesson quizzes: graded server-side, pass threshold per quiz
   Final course quiz: only accessible after 100% lesson completion
   Quiz attempts are limited and tracked
        |
        v
6. CERTIFY
   All lessons complete + all quizzes passed -> auto-generates certificate
   Certificate stored in Frappe, downloadable as PDF
   Course access expires after 30 days from purchase
```

## Monthly Cost Estimate

| Resource                | Cost        |
|-------------------------|-------------|
| EC2 t3.small            | ~$15/mo     |
| RDS db.t3.micro         | ~$12/mo     |
| S3 + CloudFront         | ~$2/mo      |
| Elastic IP (attached)   | $0          |
| Lambda + DynamoDB       | ~$1/mo      |
| Vercel (free tier x2)   | $0          |
| Cloudflare (free tier)  | $0          |
| **Total**               | **~$25-35/mo** |

Note: RDS may fall under AWS free tier for the first 12 months, reducing costs to ~$15-20/mo.
