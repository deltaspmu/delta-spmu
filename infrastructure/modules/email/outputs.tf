output "email_api_url" {
  description = "Email API Gateway invoke URL"
  value       = aws_api_gateway_stage.email.invoke_url
}

output "email_api_id" {
  description = "Email API Gateway ID"
  value       = aws_api_gateway_rest_api.email.id
}

output "emails_table_name" {
  description = "DynamoDB emails table name"
  value       = aws_dynamodb_table.emails.name
}

output "email_contacts_table_name" {
  description = "DynamoDB email contacts table name"
  value       = aws_dynamodb_table.email_contacts.name
}

output "email_attachments_bucket" {
  description = "S3 email attachments bucket name"
  value       = aws_s3_bucket.email_attachments.id
}
