output "assets_bucket_name" {
  value = aws_s3_bucket.assets.id
}

output "marketing_bucket_name" {
  value = aws_s3_bucket.marketing.id
}

output "marketing_website_url" {
  value = aws_s3_bucket_website_configuration.marketing.website_endpoint
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.marketing.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.marketing.domain_name
}
