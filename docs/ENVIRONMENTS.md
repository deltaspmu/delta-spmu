# Environments

Three environments: **dev** (local, $0), **staging** (AWS, ~$23/mo), **prod** (AWS + Vercel, live).

## Matrix


|                    | Dev                                               | Staging                                                  | Prod                                                  |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Backend            | Docker on your machine (`dev/docker-compose.yml`) | EC2 t3.small `63.181.17.70`, MariaDB **on-instance**     | EC2 t3.small `3.126.36.245` + RDS `deltaspmu-dev-db`  |
| Frappe site        | `lms.localhost`                                   | `staging-api.deltaspmu.com`                              | `api.deltaspmu.com`                                   |
| Student portal     | `localhost:5173` (vite)                           | `staging-learn.deltaspmu.com` (Vercel, `staging` branch) | `learn.deltaspmu.com` (Vercel, `main`)                |
| Admin portal       | `localhost:5174` (vite)                           | `staging-admin.deltaspmu.com` (Vercel, `staging` branch) | `admin.deltaspmu.com` (Vercel, `main`)                |
| Marketing          | `npm run dev` locally                             | — (test locally)                                         | `deltaspmu.com` (**Vercel**, separate project)        |
| Payments           | not configured (or sandbox keys manually)         | telebirr **sandbox**, Chapa **test**, EthSwitch test     | live keys                                             |
| Email (Resend)     | not configured (enable Mailpit)                   | shared key, from `noreply-staging@`                      | live key, from `noreply@`                             |
| Email CRM (Lambda) | inert (`VITE_EMAIL_API_URL` unset)                | inert — stack not deployed                               | **inert — lambdas are placeholders, never activated** |
| Telegram bot       | not configured                                    | not configured                                           | site-config driven                                    |
| Terraform root     | —                                                 | `infrastructure/envs/staging`                            | `infrastructure/envs/prod`                            |
| TF state key       | —                                                 | `staging/terraform.tfstate`                              | `prod/terraform.tfstate`                              |
| Resource names     | —                                                 | `deltaspmu-staging-*`                                    | `deltaspmu-dev-*` (legacy — see Known debt)           |
| Deploy backend     | `./scripts/dev-sync-backend.sh`                   | `./scripts/deploy-backend.sh staging`                    | `./scripts/deploy-backend.sh prod`                    |


Staging logins: Frappe `Administrator` password = the `db_password` value in
`infrastructure/envs/staging/terraform.tfvars` (local, gitignored) — same value
as the on-instance MariaDB root password.

Secrets live in each site's `site_config.json` via `bench set-config` (payments, Vimeo, Telegram) — never in git. Terraform secrets live in each env root's local `terraform.tfvars` (gitignored); the RDS password is also in TF state (the state bucket is private + versioned).

## Terraform

- **State**: S3 bucket `deltaspmu-tfstate-534727954268` (eu-central-1, versioned, public-access-blocked), native lockfile locking (`use_lockfile = true`, requires TF ≥ 1.10). Bootstrap (already done, for reference):
  ```bash
  aws s3api create-bucket --bucket deltaspmu-tfstate-534727954268 --region eu-central-1 \
    --create-bucket-configuration LocationConstraint=eu-central-1
  aws s3api put-bucket-versioning --bucket deltaspmu-tfstate-534727954268 \
    --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket deltaspmu-tfstate-534727954268 \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  ```
- **Layout**: shared `infrastructure/modules/{network,backend-server,rds,marketing,email}` + per-env roots `infrastructure/envs/{staging,prod}`. Staging instantiates only network + backend-server (no RDS — MariaDB on-instance; no email/marketing).
- **Workflow**: `cd infrastructure/envs/<env> && terraform init && terraform plan` — always review the plan. Copy `terraform.tfvars.example` → `terraform.tfvars` first.



### Prod import runbook (✅ EXECUTED 2026-07-12 — kept for reference)

The live prod stack was imported into `prod/terraform.tfstate` on 2026-07-12:
118 resources, zero AWS mutations, final `terraform plan` = "No changes."
The process, for reference:

1. `envs/prod/terraform.tfvars` from `terraform.tfvars.example` + the live secrets.
2. Write `envs/prod/imports.tf` with `import` blocks per live resource — IDs in `docs/PROD_INVENTORY.md` (incl. `random_id.bucket_suffix` with hex `176af819`).
3. `terraform plan` until it reads **"N to import, 0 to add, 0 to change, 0 to destroy"**. Any residual change = drift → report, don't fix.
  - Known acceptable exception: `aws_api_gateway_deployment` will show a one-time replace (its `triggers` can't be imported); it republishes identical API config.
4. **Apply only after explicit approval** (writes state only). Delete `imports.tf`; `terraform plan` → "no changes" is the exit criterion.
5. Never run `terraform destroy` in `envs/prod`. RDS has `deletion_protection = true` live.



### Deferred hardening (each needs a separate approved apply)

- RDS: `backup_retention_period` 1 → 7, `skip_final_snapshot` → false
- Web SG: close 8000 and restrict 22 (currently 0.0.0.0/0)
- Decommission or start using the empty marketing S3 + CloudFront and assets bucket
- Vendor the email Lambda handler source into the repo (currently placeholders everywhere)
- **CSRF verification is disabled on ALL environments** (`ignore_csrf: 1`, inherited from prod where it was a cross-origin workaround). A malicious site could forge requests from a logged-in browser. Proper fix: make the admin portal attach valid tokens on every POST, verify on staging, then remove the flag everywhere.
- `get_course_price` USD-conversion bug (float on dict) is fixed in the repo and deployed to staging+dev, but **prod still has it** — ships with the next `./scripts/deploy-backend.sh prod`.



## Staging bring-up (after `terraform apply`)

```bash
# 1. DNS (GoDaddy — manual):
#    A     staging-api    -> <staging EIP from terraform output>
#    CNAME staging-learn  -> cname.vercel-dns.com
#    CNAME staging-admin  -> cname.vercel-dns.com

# 2. Frappe on the staging box (MariaDB is already installed by user_data):
ssh ubuntu@<STAGING-IP> "SITE_NAME=staging-api.deltaspmu.com DB_HOST=localhost \
  DB_PASSWORD=<staging tfvars db_password> bash -s" < scripts/setup-frappe.sh

# 3. Swap in the LMS fork (tarball on the box at /tmp/afritutors-lms.tar.gz), overlay, HTTPS, CORS.
#    NOTE: the fork declares required_apps = ["frappe/payments"] — run
#          `bench get-app payments --branch version-15` first (main targets Frappe v16).
#    NOTE: stock frappe/lms@main needs Node >= 22 and will NOT build on the Node-18 box;
#          only the fork (with prebuilt assets) works here.
scp scripts/swap-lms-fork.sh ubuntu@<STAGING-IP>:/tmp/ && ssh ubuntu@<STAGING-IP> "sudo bash /tmp/swap-lms-fork.sh"
./scripts/deploy-backend.sh staging
./scripts/setup-api-https.sh staging
./scripts/configure-cors.sh staging

# 4. Sandbox payments + Resend:
ssh ubuntu@<STAGING-IP> "SITE_NAME=staging-api.deltaspmu.com API_URL=https://staging-api.deltaspmu.com \
  PORTAL_URL=https://staging-learn.deltaspmu.com TELEBIRR_ENV=sandbox bash -s" < scripts/configure-payments.sh
./scripts/configure-resend.sh staging <RESEND-KEY>

# 5. Seed content:
scp scripts/seed_delta_spmu.py ubuntu@<STAGING-IP>:/tmp/
ssh ubuntu@<STAGING-IP> "sudo -u frappe bash -c 'cd /home/frappe/deltaspmu && \
  SEED_SITE=staging-api.deltaspmu.com ./env/bin/python /tmp/seed_delta_spmu.py'"
```



## Syncing prod course content down

`./scripts/sync-prod-courses.sh [staging] [dev]` copies course CONTENT
(courses, chapters, lessons, quizzes, questions, categories, public files)
from prod into staging/dev. Read-only on prod; excludes all user activity
and PII (enrollments, progress, reviews, certificates, submissions, users,
transactions). First run: 2026-07-12 — all three envs verified identical.

## Vercel staging (Hobby plan)

Same two Vercel projects as prod:

1. Push/keep a long-lived `staging` git branch (branched from `main`).
2. In each project: **Settings → Domains** → add `staging-learn.deltaspmu.com` (student) / `staging-admin.deltaspmu.com` (admin), assigned to the `staging` branch.
3. `vercel.json` (both portals) has **host-conditional rewrites**: requests arriving on the staging hostnames proxy to `staging-api.deltaspmu.com`; all other hostnames (prod domains, bare `*.vercel.app` previews) fall through to the prod rewrites. No per-branch env vars needed for the API URL.
4. Deploy flow: merge to `staging` → staging portals update; merge to `main` → prod portals update.

> Vercel Hobby ToS technically prohibits commercial use — if that ever becomes an issue, Pro is the fix.



## Prod SSH access

The prod key pair (`deltaspmu-dev-key`, RSA) has no private key on this machine — it stayed
behind in the account migration. Until a key is durably installed, use **EC2 Instance Connect**
(ephemeral, 60-second window, nothing persisted on the server):

```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-0c4404a6aab59c80a --availability-zone eu-central-1a \
  --instance-os-user ubuntu --ssh-public-key file://~/.ssh/id_ed25519.pub
ssh ubuntu@3.126.36.245   # within 60s
```

To make access durable (your call — run it yourself):

```bash
# inside that ssh session:
echo "<your ~/.ssh/id_ed25519.pub line>" >> ~/.ssh/authorized_keys
```

Multi-command scripts against prod (e.g. `deploy-backend.sh prod`) open several SSH
connections over >60s; either install the durable key first, or add a ControlMaster
block to `~/.ssh/config` so one authenticated connection is reused:

```
Host 3.126.36.245
  ControlMaster auto
  ControlPath ~/.ssh/cm-%r@%h:%p
  ControlPersist 10m
```



## Service credentials per environment

Configured from `~/.deltaspmu/staging-keys.env` (gitignored, outside the repo):

Canonical site branding is stored in the Frappe singleton settings. Apply it
after the backend overlay is deployed (the command is idempotent):

```bash
./scripts/configure-branding.sh staging
./scripts/configure-lms-settings.sh staging
./scripts/normalize-ombre-chapters.sh staging
```

The LMS settings command creates any Delta feature fields absent from the
installed upstream LMS version, then enables self-enrollment, reviews,
progress, certificates, enrollment emails, and Chapa payments in ETB. It is
safe to run again after a deploy.

The chapter-normalization command repairs persisted ombre-course numbering
without deleting or recreating content. It preserves indexed order, resolves
duplicate positions by creation order, renumbers from 1, and is safe to run
repeatedly.

| Service | dev | staging | prod |
|---|---|---|---|
| Vimeo | shared token, tag `deltaspmu-lms-dev` | shared token, tag `deltaspmu-lms-staging` | tag `deltaspmu-lms` |
| Chapa | — | TEST keys | live |
| Resend | Mailpit (localhost:8025) | key, from `noreply-staging@` | live |
| Telegram | — | staging bot + webhook | live bot |
| telebirr / EthSwitch | — | pending (add later) | live |

Vimeo `vimeo_tag` (site_config) isolates each env's uploaded library. New uploads
on staging/dev are tagged per-env and whitelisted to that env's domains by the
upload code (`_get_tag()` in vimeo_api.py). NOTE: existing course lessons
reference videos in PROD's Vimeo account; those won't play on staging/dev unless
re-uploaded there (or the prod token adds staging domains to each video's embed
whitelist) — expected with isolated libraries. Dev email goes to Mailpit
(enable in `dev/docker-compose.yml`, UI at http://localhost:8025).

## Site-config behavioral parity (prod = source of truth)

Applied to staging + dev (2026-07-12): `ignore_csrf: 1` (matches prod — see
Known debt), `cors_allow_headers/methods`, `host_name`; staging additionally
mirrors `cookie_secure`/`session_cookie_samesite`/`session_cookie_secure`
(dev is plain http). Frappe core carries three patches replicated from prod:
samesite-from-config, force-secure, cookie_domain (`scripts/patch_frappe_*`).
The prod-only overlay modules (course_import_export, _cert_backfill,
_migrate_doctypes) are now vendored in `backend/frappe-lms/lms/lms/`.

## Known debt

- **Prod resources are named** `deltaspmu-dev-`* with `Environment=dev` tags (created with the old default). Renaming requires destroy/recreate — accepted; `envs/prod/` is the source of truth for what's production.
- Prod email CRM stack is placeholder-only scaffolding (never activated); staging doesn't replicate it.
- Marketing S3 + CloudFront + assets bucket are empty/unused (site moved to Vercel).
- Docs history: DNS is at **GoDaddy** (not Cloudflare as DEPLOYMENT_GUIDE.md once said); old EC2 IP `18.194.169.111` is dead — live is `3.126.36.245`.
