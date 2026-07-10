output "ec2_public_ip" {
  description = "EC2 public IP (Elastic IP) — api.deltaspmu.com"
  value       = module.backend_server.public_ip
}

output "ec2_instance_id" {
  value = module.backend_server.instance_id
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_database_name" {
  value = module.rds.db_name
}

output "assets_bucket_name" {
  value = module.marketing.assets_bucket_name
}

output "marketing_bucket_name" {
  value = module.marketing.marketing_bucket_name
}

output "marketing_website_url" {
  value = module.marketing.marketing_website_url
}

output "cloudfront_distribution_id" {
  value = module.marketing.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  value = module.marketing.cloudfront_domain_name
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "web_security_group_id" {
  value = module.network.web_sg_id
}

output "ssh_command" {
  value = "ssh ubuntu@${module.backend_server.public_ip}"
}

output "email_api_url" {
  value = module.email.email_api_url
}

output "email_api_id" {
  value = module.email.email_api_id
}

output "emails_table_name" {
  value = module.email.emails_table_name
}

output "email_contacts_table_name" {
  value = module.email.email_contacts_table_name
}

output "email_attachments_bucket" {
  value = module.email.email_attachments_bucket
}
