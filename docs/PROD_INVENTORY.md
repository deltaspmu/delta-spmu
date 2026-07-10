# Production AWS Inventory — Delta SPMU

> Read-only discovery performed 2026-07-10 against account **534727954268** (`andenet-admin`), region **eu-central-1**.
> This is the source of truth for `infrastructure/envs/prod/terraform.tfvars` and the Phase-5 import blocks.
> The account also hosts two unrelated projects (`receipt`, `bingo`) — excluded from this inventory.

## Headline findings

1. **All resources are named `deltaspmu-dev-*`** with `Environment=dev` tags — created by a single `terraform apply` on **2026-06-17** with the default `environment="dev"`, even though this stack serves production. Import will mirror these names exactly (renaming = destroy/recreate = out of scope).
2. **The marketing site is NOT on S3+CloudFront.** `deltaspmu.com` + `www` resolve to Vercel (`76.76.21.21` / `cname.vercel-dns.com`). The marketing S3 bucket is **empty** and the CloudFront distribution has **no aliases** (default cert only) — both are orphaned scaffolding. `scripts/deploy-marketing.sh` and CLAUDE.md's S3 deploy commands describe a pipeline that was never used in this account.
3. **The email CRM stack was never activated.** All 8 Lambdas still run the 434-byte placeholder handler (`"Placeholder — deploy real handler"`, last-modified = creation time), all 3 SSM params are Version 1 (never changed from `PLACEHOLDER_CHANGE_ME`), and the attachments bucket is empty. The prod email CRM is non-functional scaffolding. → The "Lambda code clobber" import landmine is moot; `ignore_changes` stays as future-proofing.
4. **Manual drift on the web SG:** 3 hand-added ingress rules for Ethio Telecom IPsec (telebirr C2B): proto-50 ESP, UDP 500, UDP 4500, all from `213.55.125.36/32`. These must be added to the prod Terraform config or the import plan won't converge.
5. **Manual drift on RDS (hardening, good):** `BackupRetentionPeriod=1` (code says 0), `DeletionProtection=true` (code says false), `MaxAllocatedStorage=100`. Prod tfvars must use the live values.
6. **All three S3 buckets are empty** (assets, marketing, email-attachments). Certificates etc. are evidently stored on the EC2 instance, not S3.

## DNS (GoDaddy — ns09/ns10.domaincontrol.com)

| Record | Value | Serves |
|---|---|---|
| `deltaspmu.com` A | `76.76.21.21` (Vercel apex) | Marketing (Vercel) |
| `www` CNAME | `cname.vercel-dns.com` | Marketing (Vercel) |
| `learn` CNAME | `cname.vercel-dns.com` | Student portal (Vercel) |
| `admin` CNAME | `cname.vercel-dns.com` | Admin portal (Vercel) |
| `api` A | `3.126.36.245` | Frappe EC2 (EIP) |

## Core stack (created 2026-06-17T12:41Z)

| Resource | TF address (module layout) | Live ID / name | Key config |
|---|---|---|---|
| VPC | `module.network.aws_vpc.main` | `vpc-07636dc6932cf7d9d` | 10.0.0.0/16, DNS support+hostnames |
| Subnet a | `module.network.aws_subnet.public_a` | `subnet-0ad34f7ad90f45155` | 10.0.1.0/24, eu-central-1a, map-public-ip |
| Subnet b | `module.network.aws_subnet.public_b` | `subnet-09e83f9d7f8c98454` | 10.0.2.0/24, eu-central-1b, map-public-ip |
| IGW | `module.network.aws_internet_gateway.main` | `igw-0b35847320320fc8d` | |
| Route table | `module.network.aws_route_table.public` | `rtb-00bfa5eee0a8fb058` | 0.0.0.0/0 → IGW |
| RT assoc a | `module.network.aws_route_table_association.public_a` | `rtbassoc-032586488920e3af6` | |
| RT assoc b | `module.network.aws_route_table_association.public_b` | `rtbassoc-0915858ad88cf03ac` | |
| Web SG | `module.network.aws_security_group.web` | `sg-05bbc25f157b578f0` | 22/80/443/8000 tcp from 0.0.0.0/0 **+ manual: proto-50, udp 500, udp 4500 from 213.55.125.36/32** |
| DB SG | `module.network.aws_security_group.db` | `sg-095b16621e3422d6f` | 3306 from web SG |
| Key pair | `module.backend_server.aws_key_pair.main` | `deltaspmu-dev-key` | RSA, fp `cf:d5:22:ed:05:a5:d6:9f:45:2c:6d:82:fb:ad:5c:2d` |
| EC2 | `module.backend_server.aws_instance.web` | `i-0c4404a6aab59c80a` | t3.small, `ami-0faab6bdbac9486fb`, 30GB gp3 encrypted (`vol-042deef30fb5e1136`), private 10.0.1.140 |
| EIP | `module.backend_server.aws_eip.web` | `eipalloc-042523c6bcb4244df` | **3.126.36.245** (the live API IP; docs' 18.194.169.111 is dead) |
| DB subnet grp | `module.rds.aws_db_subnet_group.main` | `deltaspmu-dev-db-subnet` | both subnets |
| RDS | `module.rds.aws_db_instance.main` | `deltaspmu-dev-db` | mariadb **10.11.16**, db.t3.micro, 20GB gp2 (max 100), encrypted, db `deltaspmu`, user `admin`, not public, **backup_retention=1, deletion_protection=true**, endpoint `deltaspmu-dev-db.cnwsquukgkwj.eu-central-1.rds.amazonaws.com` |

## S3 + CloudFront (all orphaned/empty)

| Resource | Live name | Status |
|---|---|---|
| `random_id.bucket_suffix` | hex **`176af819`** | import with this value |
| Assets bucket | `deltaspmu-assets-176af819` | **empty**, private, AES256 |
| Marketing bucket | `deltaspmu-marketing-176af819` | **empty**, website config, public policy — unused (site on Vercel) |
| CloudFront | `E1TSUCT5RYUEY` (`d158ct505123n.cloudfront.net`) | enabled, **no aliases**, default cert, origin = marketing website endpoint — receives no traffic |

**Follow-up candidate (user decision, not part of import):** decommission marketing bucket + CloudFront + assets bucket, or start using them. Until then they are imported as-is (cost ≈ $0 while empty/idle).

## Email stack (placeholder-only, never activated)

| Resource | Live name/ID |
|---|---|
| DynamoDB | `deltaspmu-dev-emails`, `deltaspmu-dev-email-contacts` (both PAY_PER_REQUEST) |
| Attachments bucket | `deltaspmu-dev-email-attachments-176af819` (empty) |
| 8 Lambdas | `deltaspmu-dev-email-{get-all,get-one,send,update,delete,webhook,attachments,addresses}` — nodejs20.x, 30s/256MB, **all placeholder code**, env CORS_ORIGIN=`https://admin.deltaspmu.com` |
| IAM role | `deltaspmu-dev-email-lambda-role` + 4 inline policies (`-dynamodb`, `-logs`, `-s3`, `-ssm`) |
| API Gateway | `64tl7py3r6` (`deltaspmu-dev-email-api`), REGIONAL, stage **`dev`** |
| SSM params | `/deltaspmu/resend-api-key`, `/deltaspmu/webhook-secret`, `/deltaspmu/email-api-key` — all SecureString **Version 1 (placeholders)** |
| Log groups | `/aws/lambda/deltaspmu-dev-email-*` (14-day retention per TF) |

## Values for `envs/prod/terraform.tfvars`

```hcl
project_name      = "deltaspmu"
environment       = "dev"              # matches live names/tags — accepted debt
name_prefix       = "deltaspmu-dev"
aws_region        = "eu-central-1"
ami_id            = "ami-0faab6bdbac9486fb"
ec2_instance_type = "t3.small"
db_instance_class = "db.t3.micro"
# db_password / ssh_public_key from local tfvars (gitignored) — unchanged live values
# RDS live-drift values:
backup_retention_period = 1
deletion_protection     = true
skip_final_snapshot     = true          # verify at import; live console value unknown via CLI here
max_allocated_storage   = 100
# random_id.bucket_suffix imported with hex 176af819
cors_origin = "https://admin.deltaspmu.com"
ssm_prefix  = "/deltaspmu"
# Web SG extra rules (manual drift, keep):
extra_web_ingress = [
  { protocol = "50",  from = 0,    to = 0,    cidr = "213.55.125.36/32", desc = "IPsec ESP (raw proto-50, no NAT-T) from Ethio Telecom gateway" },
  { protocol = "udp", from = 500,  to = 500,  cidr = "213.55.125.36/32", desc = "Ethio Telecom IPsec eims-mor" },
  { protocol = "udp", from = 4500, to = 4500, cidr = "213.55.125.36/32", desc = "Ethio Telecom IPsec eims-mor" },
]
```

## Notes for the import (Phase 5)

- `skip_final_snapshot` is not readable via CLI; keep code value `true` and let the import plan confirm.
- API GW deployment resource can't be imported meaningfully with `timestamp()` trigger — module replaces it with a content hash; expect the deployment+stage import to need care (stage `dev` imports fine; the deployment ID is visible in stage).
- CloudWatch log groups for Lambdas exist and are TF-managed resources — include in import blocks.
- The `aws_s3_bucket_*` sub-resources (website config, policy, PAB, SSE, versioning, lifecycle, CORS) each import separately with the bucket name as ID.
