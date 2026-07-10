variable "name_prefix" {
  description = "Resource name prefix (e.g. deltaspmu-staging; prod uses the legacy deltaspmu-dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS region (used for AZ names)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "create_db_sg" {
  description = "Create the RDS security group (false for envs with on-instance MariaDB)"
  type        = bool
  default     = true
}

variable "extra_web_ingress" {
  description = "Additional inline ingress rules on the web SG"
  type = list(object({
    description = string
    protocol    = string
    from_port   = number
    to_port     = number
    cidr        = string
  }))
  default = []
}
