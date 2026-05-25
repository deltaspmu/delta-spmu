##############################################################################
# Delta SPMU Academy — Email Infrastructure
# DynamoDB, S3 (attachments), Lambda, API Gateway, IAM, SSM
##############################################################################

locals {
  email_prefix = "${var.project_name}-${var.environment}"
  lambda_runtime = "nodejs20.x"
  lambda_timeout = 30
  lambda_memory  = 256
  cors_origin    = "https://admin.deltaspmu.com"

  lambda_functions = {
    "email-get-all"     = "Get all emails with filtering and pagination"
    "email-get-one"     = "Get a single email by ID"
    "email-send"        = "Send an email via Resend"
    "email-update"      = "Update email status (read, archived, etc.)"
    "email-delete"      = "Delete an email"
    "email-webhook"     = "Resend inbound webhook handler"
    "email-attachments" = "Generate presigned URLs for attachments"
    "email-addresses"   = "Manage verified email addresses"
  }
}

##############################################################################
# DynamoDB Tables
##############################################################################

# Emails table
resource "aws_dynamodb_table" "emails" {
  name         = "${local.email_prefix}-emails"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "threadId"
    type = "S"
  }

  attribute {
    name = "direction"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "ownerEmail"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # GSI: Query by thread
  global_secondary_index {
    name            = "ThreadIndex"
    hash_key        = "threadId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI: Query by direction (inbound/outbound)
  global_secondary_index {
    name            = "DirectionIndex"
    hash_key        = "direction"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI: Query by status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI: Query by owner email
  global_secondary_index {
    name            = "OwnerEmailIndex"
    hash_key        = "ownerEmail"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Name = "${local.email_prefix}-emails"
  }
}

# Email contacts table
resource "aws_dynamodb_table" "email_contacts" {
  name         = "${local.email_prefix}-email-contacts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Name = "${local.email_prefix}-email-contacts"
  }
}

##############################################################################
# S3 Bucket — Email Attachments
##############################################################################

resource "aws_s3_bucket" "email_attachments" {
  bucket = "${local.email_prefix}-email-attachments-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${local.email_prefix}-email-attachments"
  }
}

resource "aws_s3_bucket_versioning" "email_attachments" {
  bucket = aws_s3_bucket.email_attachments.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "email_attachments" {
  bucket = aws_s3_bucket.email_attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "email_attachments" {
  bucket = aws_s3_bucket.email_attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "email_attachments" {
  bucket = aws_s3_bucket.email_attachments.id

  rule {
    id     = "expire-old-attachments"
    status = "Enabled"

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "email_attachments" {
  bucket = aws_s3_bucket.email_attachments.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [local.cors_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

##############################################################################
# SSM Parameter Store — Secrets
##############################################################################

resource "aws_ssm_parameter" "resend_api_key" {
  name        = "/${var.project_name}/resend-api-key"
  description = "Resend API key for email sending"
  type        = "SecureString"
  value       = "PLACEHOLDER_CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.email_prefix}-resend-api-key"
  }
}

resource "aws_ssm_parameter" "webhook_secret" {
  name        = "/${var.project_name}/webhook-secret"
  description = "Resend webhook signing secret"
  type        = "SecureString"
  value       = "PLACEHOLDER_CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.email_prefix}-webhook-secret"
  }
}

resource "aws_ssm_parameter" "email_api_key" {
  name        = "/${var.project_name}/email-api-key"
  description = "API key for email API Gateway authentication"
  type        = "SecureString"
  value       = "PLACEHOLDER_CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.email_prefix}-email-api-key"
  }
}

##############################################################################
# IAM Role for Lambda Functions
##############################################################################

resource "aws_iam_role" "email_lambda" {
  name = "${local.email_prefix}-email-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.email_prefix}-email-lambda-role"
  }
}

# CloudWatch Logs policy
resource "aws_iam_role_policy" "email_lambda_logs" {
  name = "${local.email_prefix}-email-lambda-logs"
  role = aws_iam_role.email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      }
    ]
  })
}

# DynamoDB access policy
resource "aws_iam_role_policy" "email_lambda_dynamodb" {
  name = "${local.email_prefix}-email-lambda-dynamodb"
  role = aws_iam_role.email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.emails.arn,
          "${aws_dynamodb_table.emails.arn}/index/*",
          aws_dynamodb_table.email_contacts.arn,
          "${aws_dynamodb_table.email_contacts.arn}/index/*"
        ]
      }
    ]
  })
}

# S3 access policy (attachments)
resource "aws_iam_role_policy" "email_lambda_s3" {
  name = "${local.email_prefix}-email-lambda-s3"
  role = aws_iam_role.email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.email_attachments.arn}/*"
      }
    ]
  })
}

# SSM Parameter Store access policy
resource "aws_iam_role_policy" "email_lambda_ssm" {
  name = "${local.email_prefix}-email-lambda-ssm"
  role = aws_iam_role.email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
      }
    ]
  })
}

##############################################################################
# Lambda Functions
##############################################################################

# Placeholder zip for all Lambda functions
data "archive_file" "email_lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/lambda_placeholder.zip"

  source {
    content  = <<-JS
      exports.handler = async (event) => {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "${local.cors_origin}",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
          },
          body: JSON.stringify({ message: "Placeholder — deploy real handler" })
        };
      };
    JS
    filename = "index.mjs"
  }
}

resource "aws_lambda_function" "email" {
  for_each = local.lambda_functions

  function_name = "${local.email_prefix}-${each.key}"
  description   = each.value
  role          = aws_iam_role.email_lambda.arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = local.lambda_timeout
  memory_size   = local.lambda_memory

  filename         = data.archive_file.email_lambda_placeholder.output_path
  source_code_hash = data.archive_file.email_lambda_placeholder.output_base64sha256

  environment {
    variables = {
      EMAILS_TABLE       = aws_dynamodb_table.emails.name
      CONTACTS_TABLE     = aws_dynamodb_table.email_contacts.name
      ATTACHMENTS_BUCKET = aws_s3_bucket.email_attachments.id
      PROJECT_NAME       = var.project_name
      ENVIRONMENT        = var.environment
      CORS_ORIGIN        = local.cors_origin
    }
  }

  tags = {
    Name = "${local.email_prefix}-${each.key}"
  }
}

# CloudWatch Log Groups (explicit, with retention)
resource "aws_cloudwatch_log_group" "email_lambda" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${local.email_prefix}-${each.key}"
  retention_in_days = 14

  tags = {
    Name = "${local.email_prefix}-${each.key}-logs"
  }
}

##############################################################################
# API Gateway (REST)
##############################################################################

resource "aws_api_gateway_rest_api" "email" {
  name        = "${local.email_prefix}-email-api"
  description = "Delta SPMU email management API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${local.email_prefix}-email-api"
  }
}

# ---- /emails ----
resource "aws_api_gateway_resource" "emails" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_rest_api.email.root_resource_id
  path_part   = "emails"
}

# GET /emails
resource "aws_api_gateway_method" "emails_get" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_get" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.emails.id
  http_method             = aws_api_gateway_method.emails_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-get-all"].invoke_arn
}

# POST /emails
resource "aws_api_gateway_method" "emails_post" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_post" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.emails.id
  http_method             = aws_api_gateway_method.emails_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-send"].invoke_arn
}

# OPTIONS /emails (CORS)
resource "aws_api_gateway_method" "emails_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails.id
  http_method = aws_api_gateway_method.emails_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "emails_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails.id
  http_method = aws_api_gateway_method.emails_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "emails_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails.id
  http_method = aws_api_gateway_method.emails_options.http_method
  status_code = aws_api_gateway_method_response.emails_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

# ---- /emails/{id} ----
resource "aws_api_gateway_resource" "emails_id" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_resource.emails.id
  path_part   = "{id}"
}

# GET /emails/{id}
resource "aws_api_gateway_method" "emails_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_id_get" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.emails_id.id
  http_method             = aws_api_gateway_method.emails_id_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-get-one"].invoke_arn
}

# PATCH /emails/{id}
resource "aws_api_gateway_method" "emails_id_patch" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails_id.id
  http_method   = "PATCH"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_id_patch" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.emails_id.id
  http_method             = aws_api_gateway_method.emails_id_patch.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-update"].invoke_arn
}

# DELETE /emails/{id}
resource "aws_api_gateway_method" "emails_id_delete" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails_id.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_id_delete" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.emails_id.id
  http_method             = aws_api_gateway_method.emails_id_delete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-delete"].invoke_arn
}

# OPTIONS /emails/{id} (CORS)
resource "aws_api_gateway_method" "emails_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.emails_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "emails_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails_id.id
  http_method = aws_api_gateway_method.emails_id_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "emails_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails_id.id
  http_method = aws_api_gateway_method.emails_id_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "emails_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.emails_id.id
  http_method = aws_api_gateway_method.emails_id_options.http_method
  status_code = aws_api_gateway_method_response.emails_id_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

# ---- /webhook/email ----
resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_rest_api.email.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_resource" "webhook_email" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_resource.webhook.id
  path_part   = "email"
}

# POST /webhook/email
resource "aws_api_gateway_method" "webhook_email_post" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.webhook_email.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_email_post" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.webhook_email.id
  http_method             = aws_api_gateway_method.webhook_email_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-webhook"].invoke_arn
}

# OPTIONS /webhook/email (CORS)
resource "aws_api_gateway_method" "webhook_email_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.webhook_email.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_email_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.webhook_email.id
  http_method = aws_api_gateway_method.webhook_email_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "webhook_email_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.webhook_email.id
  http_method = aws_api_gateway_method.webhook_email_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "webhook_email_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.webhook_email.id
  http_method = aws_api_gateway_method.webhook_email_options.http_method
  status_code = aws_api_gateway_method_response.webhook_email_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

# ---- /attachments/presign ----
resource "aws_api_gateway_resource" "attachments" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_rest_api.email.root_resource_id
  path_part   = "attachments"
}

resource "aws_api_gateway_resource" "attachments_presign" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_resource.attachments.id
  path_part   = "presign"
}

# POST /attachments/presign
resource "aws_api_gateway_method" "attachments_presign_post" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.attachments_presign.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "attachments_presign_post" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.attachments_presign.id
  http_method             = aws_api_gateway_method.attachments_presign_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-attachments"].invoke_arn
}

# OPTIONS /attachments/presign (CORS)
resource "aws_api_gateway_method" "attachments_presign_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.attachments_presign.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "attachments_presign_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.attachments_presign.id
  http_method = aws_api_gateway_method.attachments_presign_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "attachments_presign_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.attachments_presign.id
  http_method = aws_api_gateway_method.attachments_presign_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "attachments_presign_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.attachments_presign.id
  http_method = aws_api_gateway_method.attachments_presign_options.http_method
  status_code = aws_api_gateway_method_response.attachments_presign_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

# ---- /email-addresses ----
resource "aws_api_gateway_resource" "email_addresses" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_rest_api.email.root_resource_id
  path_part   = "email-addresses"
}

# GET /email-addresses
resource "aws_api_gateway_method" "email_addresses_get" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.email_addresses.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_addresses_get" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.email_addresses.id
  http_method             = aws_api_gateway_method.email_addresses_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-addresses"].invoke_arn
}

# POST /email-addresses
resource "aws_api_gateway_method" "email_addresses_post" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.email_addresses.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_addresses_post" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.email_addresses.id
  http_method             = aws_api_gateway_method.email_addresses_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-addresses"].invoke_arn
}

# OPTIONS /email-addresses (CORS)
resource "aws_api_gateway_method" "email_addresses_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.email_addresses.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_addresses_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses.id
  http_method = aws_api_gateway_method.email_addresses_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "email_addresses_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses.id
  http_method = aws_api_gateway_method.email_addresses_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "email_addresses_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses.id
  http_method = aws_api_gateway_method.email_addresses_options.http_method
  status_code = aws_api_gateway_method_response.email_addresses_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

# ---- /email-addresses/{id} ----
resource "aws_api_gateway_resource" "email_addresses_id" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  parent_id   = aws_api_gateway_resource.email_addresses.id
  path_part   = "{id}"
}

# DELETE /email-addresses/{id}
resource "aws_api_gateway_method" "email_addresses_id_delete" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.email_addresses_id.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_addresses_id_delete" {
  rest_api_id             = aws_api_gateway_rest_api.email.id
  resource_id             = aws_api_gateway_resource.email_addresses_id.id
  http_method             = aws_api_gateway_method.email_addresses_id_delete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email["email-addresses"].invoke_arn
}

# OPTIONS /email-addresses/{id} (CORS)
resource "aws_api_gateway_method" "email_addresses_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.email.id
  resource_id   = aws_api_gateway_resource.email_addresses_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_addresses_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses_id.id
  http_method = aws_api_gateway_method.email_addresses_id_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "email_addresses_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses_id.id
  http_method = aws_api_gateway_method.email_addresses_id_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "email_addresses_id_options" {
  rest_api_id = aws_api_gateway_rest_api.email.id
  resource_id = aws_api_gateway_resource.email_addresses_id.id
  http_method = aws_api_gateway_method.email_addresses_id_options.http_method
  status_code = aws_api_gateway_method_response.email_addresses_id_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${local.cors_origin}'"
  }
}

##############################################################################
# Lambda Permissions (allow API Gateway to invoke)
##############################################################################

resource "aws_lambda_permission" "api_gateway" {
  for_each = local.lambda_functions

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.email.execution_arn}/*/*"
}

##############################################################################
# API Gateway Deployment
##############################################################################

resource "aws_api_gateway_deployment" "email" {
  rest_api_id = aws_api_gateway_rest_api.email.id

  depends_on = [
    aws_api_gateway_integration.emails_get,
    aws_api_gateway_integration.emails_post,
    aws_api_gateway_integration.emails_id_get,
    aws_api_gateway_integration.emails_id_patch,
    aws_api_gateway_integration.emails_id_delete,
    aws_api_gateway_integration.webhook_email_post,
    aws_api_gateway_integration.attachments_presign_post,
    aws_api_gateway_integration.email_addresses_get,
    aws_api_gateway_integration.email_addresses_post,
    aws_api_gateway_integration.email_addresses_id_delete,
  ]

  triggers = {
    redeployment = timestamp()
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "email" {
  deployment_id = aws_api_gateway_deployment.email.id
  rest_api_id   = aws_api_gateway_rest_api.email.id
  stage_name    = var.environment

  tags = {
    Name = "${local.email_prefix}-email-api-${var.environment}"
  }
}

##############################################################################
# Email Outputs
##############################################################################

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
