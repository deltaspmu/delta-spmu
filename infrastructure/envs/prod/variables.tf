variable "project_name" {
  description = "Project name"
  type        = string
  default     = "deltaspmu"
}

variable "environment" {
  description = "Environment label. Live prod resources are tagged 'dev' (legacy) — keep for import parity."
  type        = string
}

variable "name_prefix" {
  description = "Resource name prefix. Live prod is 'deltaspmu-dev' (legacy) — names cannot change without destroy/recreate."
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "db_password" {
  description = "RDS master password (the live one — set locally, never committed)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key (must match the live deltaspmu-dev-key pair)"
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 22.04 AMI (live instance uses this)"
  type        = string
  default     = "ami-0faab6bdbac9486fb"
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}
