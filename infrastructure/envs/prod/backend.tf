terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    # Bucket is bootstrapped once via AWS CLI — see docs/ENVIRONMENTS.md
    bucket       = "deltaspmu-tfstate-534727954268"
    key          = "prod/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
