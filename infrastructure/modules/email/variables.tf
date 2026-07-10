variable "name_prefix" {
  description = "Resource name prefix (prod: deltaspmu-dev — matches live)"
  type        = string
}

variable "project_name" {
  description = "Project name (lambda PROJECT_NAME env var)"
  type        = string
}

variable "environment" {
  description = "Environment label (lambda ENVIRONMENT env var)"
  type        = string
}

variable "aws_region" {
  description = "AWS region (IAM policy ARNs)"
  type        = string
}

variable "cors_origin" {
  description = "Admin-portal origin allowed by CORS (per environment)"
  type        = string
}

variable "ssm_prefix" {
  description = "SSM parameter path prefix. Prod keeps the legacy /deltaspmu; other envs must use a distinct prefix (e.g. /deltaspmu/staging) to avoid collisions."
  type        = string
  default     = "/deltaspmu"
}

variable "stage_name" {
  description = "API Gateway stage name (prod live stage is 'dev')"
  type        = string
}

variable "bucket_suffix" {
  description = "Random hex suffix for the attachments bucket name"
  type        = string
}
