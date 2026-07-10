##############################################################################
# Delta SPMU — STAGING environment
# Cost-optimized: single EC2 with on-instance MariaDB. No RDS, no email
# stack (prod's lambdas are placeholder-only anyway), no marketing S3/CDN.
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

module "network" {
  source = "../../modules/network"

  name_prefix  = var.name_prefix
  aws_region   = var.aws_region
  create_db_sg = false # MariaDB is on-instance; nothing listens on 3306 externally
}

module "backend_server" {
  source = "../../modules/backend-server"

  name_prefix           = var.name_prefix
  ami_id                = var.ami_id
  instance_type         = var.ec2_instance_type
  subnet_id             = module.network.public_subnet_a_id
  security_group_ids    = [module.network.web_sg_id]
  ssh_public_key        = var.ssh_public_key
  install_mariadb       = true
  mariadb_root_password = var.db_password
}
