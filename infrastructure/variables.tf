variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "deltaspmu"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-central-1"
}

variable "db_password" {
  description = "RDS MariaDB master password"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access"
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 22.04 AMI ID for eu-central-1"
  type        = string
  default     = "ami-0faab6bdbac9486fb" # Ubuntu 22.04 LTS eu-central-1 (update as needed)
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
