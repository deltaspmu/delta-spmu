# Delta SPMU Academy — Deployment Guide

Step-by-step instructions to deploy all components of the Delta SPMU Academy platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Infrastructure (Terraform)](#2-infrastructure-terraform)
3. [Backend (Frappe on EC2)](#3-backend-frappe-on-ec2)
4. [Marketing Site (S3 + CloudFront)](#4-marketing-site-s3--cloudfront)
5. [Student Portal (Vercel)](#5-student-portal-vercel)
6. [Admin Portal (Vercel)](#6-admin-portal-vercel)
7. [DNS Setup (Cloudflare)](#7-dns-setup-cloudflare)
8. [SSL Configuration](#8-ssl-configuration)
9. [Post-Deployment Verification](#9-post-deployment-verification)

---

## 1. Prerequisites

Install these tools on your local machine before starting:

```bash
# AWS CLI v2
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
aws --version

# Terraform >= 1.5
# https://developer.hashicorp.com/terraform/install
terraform --version

# Node.js 18+
node --version
npm --version

# Git
git --version
```

Required accounts and credentials:

- **AWS account** with IAM user that has admin access (or scoped to EC2, RDS, S3, CloudFront, Lambda, DynamoDB, API Gateway, SSM)
- **Cloudflare account** with `deltaspmu.com` domain added
- **Vercel account** connected to your GitHub org
- **Vimeo Pro/Business account** with API access token
- **Payment provider accounts**: telebirr merchant, Chapa merchant, EthSwitch (via bank), CBE business account
- **SSH key pair**: generate one if you don't have it

```bash
# Generate SSH key (if needed)
ssh-keygen -t ed25519 -C "deltaspmu-deploy" -f ~/.ssh/deltaspmu
```

Configure AWS CLI:

```bash
aws configure
# Region: eu-central-1
# Output: json
```

---

## 2. Infrastructure (Terraform)

### 2.1 Configure variables

```bash
cd infrastructure/
```

Create `terraform.tfvars` (this file is gitignored):

```hcl
project_name   = "deltaspmu"
environment    = "dev"
aws_region     = "eu-central-1"
db_password    = "YOUR_SECURE_DB_PASSWORD"
ssh_public_key = "ssh-ed25519 AAAA... deltaspmu-deploy"
ami_id         = "ami-0faab6bdbac9486fb"  # Ubuntu 22.04 eu-central-1
```

### 2.2 Provision resources

```bash
terraform init
terraform plan        # Review what will be created
terraform apply       # Type 'yes' to confirm
```

### 2.3 Note the outputs

```bash
terraform output
```

Save these values -- you will need them:

- `ec2_public_ip` -- the Elastic IP for your EC2 instance
- `rds_endpoint` -- the MariaDB hostname for Frappe
- `s3_bucket_name` -- marketing site bucket
- `cloudfront_distribution_id` -- for cache invalidation

---

## 3. Backend (Frappe on EC2)

### 3.1 Initial server setup

SSH into the EC2 instance and run the setup script:

```bash
# Copy the setup script to the server
scp scripts/setup-frappe.sh ubuntu@<EC2-IP>:/tmp/

# SSH in and run it
ssh ubuntu@<EC2-IP>
```

Before running, edit the script to fill in your RDS endpoint and password:

```bash
nano /tmp/setup-frappe.sh
# Set: RDS_ENDPOINT="your-rds-instance.xxxx.eu-central-1.rds.amazonaws.com"
# Set: RDS_PASSWORD="your-db-password"

bash /tmp/setup-frappe.sh
```

### 3.2 Deploy custom API files

From your local machine:

```bash
./scripts/deploy-backend.sh <EC2-IP>
```

This copies all Python files from `backend/frappe-lms/lms/lms/` to the server, clears the bytecode cache, and restarts bench.

### 3.3 Configure payment providers and Vimeo

SSH into the server and run the configuration script:

```bash
scp scripts/configure-payments.sh ubuntu@<EC2-IP>:/tmp/

ssh ubuntu@<EC2-IP>
# Edit the script to fill in all API keys and secrets
nano /tmp/configure-payments.sh
bash /tmp/configure-payments.sh
```

Or preview the commands locally first:

```bash
bash scripts/configure-payments.sh --dry-run
```

### 3.4 Change admin password

```bash
ssh ubuntu@<EC2-IP>
cd /home/frappe/deltaspmu
sudo -u frappe /home/frappe/.local/bin/bench --site api.deltaspmu.com set-admin-password <STRONG-PASSWORD>
```

### 3.5 Verify backend is running

```bash
curl -s http://<EC2-IP>:8000/api/method/frappe.client.get_count?doctype=User
# Should return JSON with a count
```

---

## 4. Marketing Site (S3 + CloudFront)

### 4.1 Build and deploy

From the project root:

```bash
./scripts/deploy-marketing.sh <S3-BUCKET> <CLOUDFRONT-ID>
```

Or manually:

```bash
npm run build
aws s3 sync dist/ s3://<S3-BUCKET> --delete
aws cloudfront create-invalidation --distribution-id <CLOUDFRONT-ID> --paths "/*"
```

### 4.2 Configure CloudFront error pages

In the AWS Console (or via Terraform), set custom error responses:

| HTTP Error Code | Response Page Path | Response Code |
|-----------------|-------------------|---------------|
| 403             | `/index.html`     | 200           |
| 404             | `/index.html`     | 200           |

This is required for client-side routing to work on direct URL access.

---

## 5. Student Portal (Vercel)

### 5.1 Connect GitHub repo

1. Push `frontend/student-portal/` to a GitHub repository (or use a monorepo with root directory override)
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Set the **Root Directory** to `frontend/student-portal`
4. Framework preset: **Vite**

### 5.2 Set environment variables

In Vercel project settings > Environment Variables:

| Variable          | Value                            |
|-------------------|----------------------------------|
| `VITE_API_URL`    | `https://api.deltaspmu.com`      |

### 5.3 Configure custom domain

1. In Vercel project settings > Domains, add `learn.deltaspmu.com`
2. Vercel will provide a CNAME target (e.g., `cname.vercel-dns.com`)
3. Add the CNAME record in Cloudflare (see DNS section below)

### 5.4 Deploy

Push to the main branch. Vercel auto-deploys on every push.

```bash
cd frontend/student-portal
git add .
git commit -m "Deploy student portal"
git push origin main
```

---

## 6. Admin Portal (Vercel)

Same process as the student portal, with these differences:

### 6.1 Connect GitHub repo

- Set the **Root Directory** to `frontend/admin-portal`

### 6.2 Set environment variables

| Variable                | Value                            |
|-------------------------|----------------------------------|
| `VITE_API_URL`          | `https://api.deltaspmu.com`      |
| `VITE_USE_VIMEO_PROXY`  | `true`                           |

The `VITE_USE_VIMEO_PROXY` flag tells the admin portal to route Vimeo API calls through the Frappe backend (so the Vimeo access token is never exposed to the browser).

### 6.3 Configure custom domain

Add `admin.deltaspmu.com` in Vercel project settings > Domains.

---

## 7. DNS Setup (Cloudflare)

In Cloudflare dashboard for `deltaspmu.com`, create these DNS records:

| Type  | Name    | Target                          | Proxy  |
|-------|---------|----------------------------------|--------|
| A     | `@`     | CloudFront (via CNAME flattening)| Yes    |
| A     | `api`   | `<EC2-ELASTIC-IP>`              | Yes    |
| CNAME | `learn` | `cname.vercel-dns.com`          | No     |
| CNAME | `admin` | `cname.vercel-dns.com`          | No     |

Important notes:

- The `api` record should be **proxied** (orange cloud) for DDoS protection and SSL
- The `learn` and `admin` CNAMEs should be **DNS only** (grey cloud) because Vercel manages its own SSL
- For the root domain pointing to CloudFront, use Cloudflare's CNAME flattening: create a CNAME record for `@` pointing to your CloudFront distribution domain (e.g., `d1234abcdef.cloudfront.net`)

---

## 8. SSL Configuration

### Cloudflare SSL

1. Go to Cloudflare dashboard > SSL/TLS
2. Set encryption mode to **Full (strict)**
3. Enable **Always Use HTTPS**
4. Enable **Automatic HTTPS Rewrites**

### EC2 (API server)

Choose one approach:

**Option A: Cloudflare Origin Certificate (recommended)**

1. Cloudflare dashboard > SSL/TLS > Origin Server > Create Certificate
2. Generate certificate for `api.deltaspmu.com`
3. Copy the certificate and private key to the EC2 instance:

```bash
sudo mkdir -p /etc/ssl/api.deltaspmu.com
sudo nano /etc/ssl/api.deltaspmu.com/cert.pem    # Paste certificate
sudo nano /etc/ssl/api.deltaspmu.com/key.pem     # Paste private key
sudo chmod 600 /etc/ssl/api.deltaspmu.com/key.pem
```

4. Update Nginx config to use the certificate

**Option B: Let's Encrypt**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.deltaspmu.com
```

Note: Requires the `api` DNS record to be set to DNS-only (grey cloud) during certificate issuance, then switch back to proxied.

---

## 9. Post-Deployment Verification

Run through this checklist after deploying all components.

### Infrastructure

- [ ] EC2 instance is running and accessible via SSH
- [ ] RDS is accessible from EC2 (not publicly)
- [ ] S3 bucket exists and CloudFront distribution is deployed
- [ ] Elastic IP is attached to EC2

### Backend

- [ ] `curl https://api.deltaspmu.com/api/method/frappe.client.get_count?doctype=User` returns JSON
- [ ] `curl https://api.deltaspmu.com/api/method/lms.lms.api.get_csrf_token` returns a token
- [ ] `curl https://api.deltaspmu.com/api/method/lms.lms.api.get_branding` returns branding data
- [ ] Admin login works at `https://api.deltaspmu.com` (Frappe desk)
- [ ] Payment config values are set: `bench --site api.deltaspmu.com show-config`

### Marketing Site

- [ ] `https://deltaspmu.com` loads correctly
- [ ] All pages and navigation work
- [ ] Direct URL access works (CloudFront error pages configured)
- [ ] Links to student portal (`learn.deltaspmu.com`) work

### Student Portal

- [ ] `https://learn.deltaspmu.com` loads correctly
- [ ] Registration flow works (creates user, sends verification email)
- [ ] Login works (cookie-based session with Frappe)
- [ ] Course listing loads from API
- [ ] Payment flow works in sandbox mode
- [ ] Video playback works (Vimeo embed)
- [ ] Language switcher (EN/AM) works

### Admin Portal

- [ ] `https://admin.deltaspmu.com` loads correctly
- [ ] Admin login works
- [ ] Course management (create, edit, delete) works
- [ ] Video upload via Vimeo proxy works
- [ ] Student list and enrollment management works

### SSL and Security

- [ ] All domains serve HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] No mixed content warnings
- [ ] CORS headers are correct (check browser console)
- [ ] CSRF token flow works for POST requests

### Payments (Sandbox)

- [ ] telebirr: initiate payment returns checkout URL
- [ ] Chapa: initiate payment redirects to Chapa hosted page
- [ ] EthSwitch: initiate payment redirects to bank selection page
- [ ] CBE: manual transfer instructions display correctly
- [ ] Webhook URLs are reachable from payment providers
- [ ] Successful payment creates Course Access record
