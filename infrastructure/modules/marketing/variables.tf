variable "name_prefix" {
  description = "Resource name prefix (tags)"
  type        = string
}

variable "project_name" {
  description = "Project name (bucket name stems — no environment, matches live prod naming)"
  type        = string
}

variable "bucket_suffix" {
  description = "Random hex suffix for globally-unique bucket names (from the env root's random_id)"
  type        = string
}
