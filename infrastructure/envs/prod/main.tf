##############################################################################
# Delta SPMU — PRODUCTION environment
#
# Mirrors the LIVE stack exactly so it can be imported (Phase 5,
# docs/PROD_INVENTORY.md). The live resources are named deltaspmu-dev-*
# with Environment=dev tags — created 2026-06-17 with the old default
# environment value. Renaming would force destroy/recreate, so this root
# deliberately keeps name_prefix = "deltaspmu-dev" / environment = "dev".
# THIS DIRECTORY (and the prod/ state key) is the source of truth for
# "this is production", not the resource names.
#
# ⚠ NEVER `terraform apply` here until `terraform plan` shows
#   "0 to add, 0 to change, 0 to destroy" (plus imports) AND the user
#   has approved. See the import runbook in docs/ENVIRONMENTS.md.
##############################################################################

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = ["534727954268"]

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Live bucket suffix is 176af819 — imported, never regenerated.
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

module "network" {
  source = "../../modules/network"

  name_prefix  = var.name_prefix
  aws_region   = var.aws_region
  create_db_sg = true

  # Manually-added Ethio Telecom IPsec rules (telebirr C2B) — live drift,
  # kept. See docs/PROD_INVENTORY.md.
  extra_web_ingress = [
    {
      description = "IPsec ESP (raw proto-50, no NAT-T) from Ethio Telecom gateway"
      protocol    = "50"
      from_port   = 0
      to_port     = 0
      cidr        = "213.55.125.36/32"
    },
    {
      description = "Ethio Telecom IPsec eims-mor"
      protocol    = "udp"
      from_port   = 500
      to_port     = 500
      cidr        = "213.55.125.36/32"
    },
    {
      description = "Ethio Telecom IPsec eims-mor"
      protocol    = "udp"
      from_port   = 4500
      to_port     = 4500
      cidr        = "213.55.125.36/32"
    },
  ]
}

module "backend_server" {
  source = "../../modules/backend-server"

  name_prefix        = var.name_prefix
  ami_id             = var.ami_id
  instance_type      = var.ec2_instance_type
  subnet_id          = module.network.public_subnet_a_id
  security_group_ids = [module.network.web_sg_id]
  ssh_public_key     = var.ssh_public_key
  install_mariadb    = false # prod uses RDS
}

module "rds" {
  source = "../../modules/rds"

  name_prefix       = var.name_prefix
  db_name           = var.project_name
  db_password       = var.db_password
  instance_class    = var.db_instance_class
  subnet_ids        = [module.network.public_subnet_a_id, module.network.public_subnet_b_id]
  security_group_id = module.network.db_sg_id

  # Live values (manually hardened post-provision) — import parity:
  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = true
  max_allocated_storage   = 100
}

module "marketing" {
  source = "../../modules/marketing"

  name_prefix   = var.name_prefix
  project_name  = var.project_name
  bucket_suffix = random_id.bucket_suffix.hex
}

module "email" {
  source = "../../modules/email"

  name_prefix   = var.name_prefix
  project_name  = var.project_name
  environment   = var.environment
  aws_region    = var.aws_region
  cors_origin   = "https://admin.deltaspmu.com"
  ssm_prefix    = "/deltaspmu" # legacy path — matches live params
  stage_name    = var.environment
  bucket_suffix = random_id.bucket_suffix.hex
}
