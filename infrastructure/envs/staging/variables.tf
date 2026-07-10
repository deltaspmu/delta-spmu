variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "deltaspmu"
}

variable "environment" {
  description = "Environment name (no default — set explicitly per env)"
  type        = string
}

variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "db_password" {
  description = "MariaDB root password (on-instance DB). Set via TF_VAR_db_password or local tfvars — never committed."
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access"
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 22.04 AMI (eu-central-1)"
  type        = string
  default     = "ami-0faab6bdbac9486fb"
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}
