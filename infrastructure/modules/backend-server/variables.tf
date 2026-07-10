variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 22.04 AMI ID"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "subnet_id" {
  description = "Subnet to launch in"
  type        = string
}

variable "security_group_ids" {
  description = "Security groups for the instance"
  type        = list(string)
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access"
  type        = string
}

variable "install_mariadb" {
  description = "Install MariaDB 10.11 on-instance via user_data (cost-optimized envs without RDS)"
  type        = bool
  default     = false
}

variable "mariadb_root_password" {
  description = "Root password for on-instance MariaDB (only used when install_mariadb = true). NOTE: user_data is readable via instance metadata — acceptable for staging."
  type        = string
  default     = ""
  sensitive   = true
}
