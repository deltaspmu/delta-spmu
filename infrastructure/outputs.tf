##############################################################################
# Outputs
##############################################################################

output "ec2_public_ip" {
  description = "Elastic IP of the EC2 instance"
  value       = aws_eip.web.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.web.id
}

output "rds_endpoint" {
  description = "RDS MariaDB endpoint (use as db_host in Frappe)"
  value       = aws_db_instance.main.endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "assets_bucket_name" {
  description = "S3 assets bucket name"
  value       = aws_s3_bucket.assets.id
}

output "marketing_bucket_name" {
  description = "S3 marketing site bucket name"
  value       = aws_s3_bucket.marketing.id
}

output "marketing_website_url" {
  description = "S3 marketing site website URL"
  value       = aws_s3_bucket_website_configuration.marketing.website_endpoint
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.marketing.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.marketing.domain_name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "web_security_group_id" {
  description = "Web security group ID"
  value       = aws_security_group.web.id
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh ubuntu@${aws_eip.web.public_ip}"
}
