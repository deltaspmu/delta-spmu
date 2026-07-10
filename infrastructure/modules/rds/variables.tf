variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "db_name" {
  description = "Initial database name"
  type        = string
}

variable "db_password" {
  description = "Master password"
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "engine_version" {
  description = "MariaDB engine version"
  type        = string
  default     = "10.11"
}

variable "subnet_ids" {
  description = "Subnets for the DB subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "DB security group"
  type        = string
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling (GB)"
  type        = number
  default     = 100
}

variable "backup_retention_period" {
  description = "Automated backup retention in days (0 disables)"
  type        = number
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on destroy"
  type        = bool
}

variable "deletion_protection" {
  description = "Protect the instance from deletion"
  type        = bool
}
