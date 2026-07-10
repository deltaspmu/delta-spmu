# TEMPORARY — Phase 5 prod import blocks (delete after the import apply).
# IDs from docs/PROD_INVENTORY.md. Run `terraform plan` and require
# "N to import, 0 to add, 0 to change, 0 to destroy" before applying.
# Known exception: aws_api_gateway_deployment shows a one-time replace
# (triggers are not importable) — republishes identical API config.


import {
  to = random_id.bucket_suffix
  id = "F2r4GQ"
}

import {
  to = module.network.aws_vpc.main
  id = "vpc-07636dc6932cf7d9d"
}

import {
  to = module.network.aws_subnet.public_a
  id = "subnet-0ad34f7ad90f45155"
}

import {
  to = module.network.aws_subnet.public_b
  id = "subnet-09e83f9d7f8c98454"
}

import {
  to = module.network.aws_internet_gateway.main
  id = "igw-0b35847320320fc8d"
}

import {
  to = module.network.aws_route_table.public
  id = "rtb-00bfa5eee0a8fb058"
}

import {
  to = module.network.aws_route_table_association.public_a
  id = "subnet-0ad34f7ad90f45155/rtb-00bfa5eee0a8fb058"
}

import {
  to = module.network.aws_route_table_association.public_b
  id = "subnet-09e83f9d7f8c98454/rtb-00bfa5eee0a8fb058"
}

import {
  to = module.network.aws_security_group.web
  id = "sg-05bbc25f157b578f0"
}

import {
  to = module.network.aws_security_group.db[0]
  id = "sg-095b16621e3422d6f"
}

import {
  to = module.backend_server.aws_key_pair.main
  id = "deltaspmu-dev-key"
}

import {
  to = module.backend_server.aws_instance.web
  id = "i-0c4404a6aab59c80a"
}

import {
  to = module.backend_server.aws_eip.web
  id = "eipalloc-042523c6bcb4244df"
}

import {
  to = module.rds.aws_db_subnet_group.main
  id = "deltaspmu-dev-db-subnet"
}

import {
  to = module.rds.aws_db_instance.main
  id = "deltaspmu-dev-db"
}

import {
  to = module.marketing.aws_s3_bucket.assets
  id = "deltaspmu-assets-176af819"
}

import {
  to = module.marketing.aws_s3_bucket_public_access_block.assets
  id = "deltaspmu-assets-176af819"
}

import {
  to = module.marketing.aws_s3_bucket_server_side_encryption_configuration.assets
  id = "deltaspmu-assets-176af819"
}

import {
  to = module.marketing.aws_s3_bucket.marketing
  id = "deltaspmu-marketing-176af819"
}

import {
  to = module.marketing.aws_s3_bucket_website_configuration.marketing
  id = "deltaspmu-marketing-176af819"
}

import {
  to = module.marketing.aws_s3_bucket_public_access_block.marketing
  id = "deltaspmu-marketing-176af819"
}

import {
  to = module.marketing.aws_s3_bucket_policy.marketing
  id = "deltaspmu-marketing-176af819"
}

import {
  to = module.marketing.aws_cloudfront_distribution.marketing
  id = "E1TSUCT5RYUEY"
}

import {
  to = module.email.aws_dynamodb_table.emails
  id = "deltaspmu-dev-emails"
}

import {
  to = module.email.aws_dynamodb_table.email_contacts
  id = "deltaspmu-dev-email-contacts"
}

import {
  to = module.email.aws_s3_bucket.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_s3_bucket_versioning.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_s3_bucket_server_side_encryption_configuration.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_s3_bucket_public_access_block.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_s3_bucket_lifecycle_configuration.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_s3_bucket_cors_configuration.email_attachments
  id = "deltaspmu-dev-email-attachments-176af819"
}

import {
  to = module.email.aws_ssm_parameter.resend_api_key
  id = "/deltaspmu/resend-api-key"
}

import {
  to = module.email.aws_ssm_parameter.webhook_secret
  id = "/deltaspmu/webhook-secret"
}

import {
  to = module.email.aws_ssm_parameter.email_api_key
  id = "/deltaspmu/email-api-key"
}

import {
  to = module.email.aws_iam_role.email_lambda
  id = "deltaspmu-dev-email-lambda-role"
}

import {
  to = module.email.aws_iam_role_policy.email_lambda_logs
  id = "deltaspmu-dev-email-lambda-role:deltaspmu-dev-email-lambda-logs"
}

import {
  to = module.email.aws_iam_role_policy.email_lambda_dynamodb
  id = "deltaspmu-dev-email-lambda-role:deltaspmu-dev-email-lambda-dynamodb"
}

import {
  to = module.email.aws_iam_role_policy.email_lambda_s3
  id = "deltaspmu-dev-email-lambda-role:deltaspmu-dev-email-lambda-s3"
}

import {
  to = module.email.aws_iam_role_policy.email_lambda_ssm
  id = "deltaspmu-dev-email-lambda-role:deltaspmu-dev-email-lambda-ssm"
}

import {
  to = module.email.aws_lambda_function.email["email-get-all"]
  id = "deltaspmu-dev-email-get-all"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-get-all"]
  id = "/aws/lambda/deltaspmu-dev-email-get-all"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-get-all"]
  id = "deltaspmu-dev-email-get-all/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-get-one"]
  id = "deltaspmu-dev-email-get-one"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-get-one"]
  id = "/aws/lambda/deltaspmu-dev-email-get-one"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-get-one"]
  id = "deltaspmu-dev-email-get-one/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-send"]
  id = "deltaspmu-dev-email-send"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-send"]
  id = "/aws/lambda/deltaspmu-dev-email-send"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-send"]
  id = "deltaspmu-dev-email-send/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-update"]
  id = "deltaspmu-dev-email-update"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-update"]
  id = "/aws/lambda/deltaspmu-dev-email-update"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-update"]
  id = "deltaspmu-dev-email-update/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-delete"]
  id = "deltaspmu-dev-email-delete"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-delete"]
  id = "/aws/lambda/deltaspmu-dev-email-delete"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-delete"]
  id = "deltaspmu-dev-email-delete/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-webhook"]
  id = "deltaspmu-dev-email-webhook"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-webhook"]
  id = "/aws/lambda/deltaspmu-dev-email-webhook"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-webhook"]
  id = "deltaspmu-dev-email-webhook/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-attachments"]
  id = "deltaspmu-dev-email-attachments"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-attachments"]
  id = "/aws/lambda/deltaspmu-dev-email-attachments"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-attachments"]
  id = "deltaspmu-dev-email-attachments/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_lambda_function.email["email-addresses"]
  id = "deltaspmu-dev-email-addresses"
}

import {
  to = module.email.aws_cloudwatch_log_group.email_lambda["email-addresses"]
  id = "/aws/lambda/deltaspmu-dev-email-addresses"
}

import {
  to = module.email.aws_lambda_permission.api_gateway["email-addresses"]
  id = "deltaspmu-dev-email-addresses/AllowAPIGatewayInvoke"
}

import {
  to = module.email.aws_api_gateway_rest_api.email
  id = "64tl7py3r6"
}

import {
  to = module.email.aws_api_gateway_resource.emails
  id = "64tl7py3r6/6zb8wb"
}

import {
  to = module.email.aws_api_gateway_resource.emails_id
  id = "64tl7py3r6/i1239z"
}

import {
  to = module.email.aws_api_gateway_resource.webhook
  id = "64tl7py3r6/7jzfh5"
}

import {
  to = module.email.aws_api_gateway_resource.webhook_email
  id = "64tl7py3r6/2cyrya"
}

import {
  to = module.email.aws_api_gateway_resource.attachments
  id = "64tl7py3r6/svqfs5"
}

import {
  to = module.email.aws_api_gateway_resource.attachments_presign
  id = "64tl7py3r6/z0j5j4"
}

import {
  to = module.email.aws_api_gateway_resource.email_addresses
  id = "64tl7py3r6/bqndmb"
}

import {
  to = module.email.aws_api_gateway_resource.email_addresses_id
  id = "64tl7py3r6/osc10v"
}

import {
  to = module.email.aws_api_gateway_method.emails_get
  id = "64tl7py3r6/6zb8wb/GET"
}

import {
  to = module.email.aws_api_gateway_integration.emails_get
  id = "64tl7py3r6/6zb8wb/GET"
}

import {
  to = module.email.aws_api_gateway_method.emails_post
  id = "64tl7py3r6/6zb8wb/POST"
}

import {
  to = module.email.aws_api_gateway_integration.emails_post
  id = "64tl7py3r6/6zb8wb/POST"
}

import {
  to = module.email.aws_api_gateway_method.emails_options
  id = "64tl7py3r6/6zb8wb/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.emails_options
  id = "64tl7py3r6/6zb8wb/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method.emails_id_get
  id = "64tl7py3r6/i1239z/GET"
}

import {
  to = module.email.aws_api_gateway_integration.emails_id_get
  id = "64tl7py3r6/i1239z/GET"
}

import {
  to = module.email.aws_api_gateway_method.emails_id_patch
  id = "64tl7py3r6/i1239z/PATCH"
}

import {
  to = module.email.aws_api_gateway_integration.emails_id_patch
  id = "64tl7py3r6/i1239z/PATCH"
}

import {
  to = module.email.aws_api_gateway_method.emails_id_delete
  id = "64tl7py3r6/i1239z/DELETE"
}

import {
  to = module.email.aws_api_gateway_integration.emails_id_delete
  id = "64tl7py3r6/i1239z/DELETE"
}

import {
  to = module.email.aws_api_gateway_method.emails_id_options
  id = "64tl7py3r6/i1239z/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.emails_id_options
  id = "64tl7py3r6/i1239z/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method.webhook_email_post
  id = "64tl7py3r6/2cyrya/POST"
}

import {
  to = module.email.aws_api_gateway_integration.webhook_email_post
  id = "64tl7py3r6/2cyrya/POST"
}

import {
  to = module.email.aws_api_gateway_method.webhook_email_options
  id = "64tl7py3r6/2cyrya/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.webhook_email_options
  id = "64tl7py3r6/2cyrya/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method.attachments_presign_post
  id = "64tl7py3r6/z0j5j4/POST"
}

import {
  to = module.email.aws_api_gateway_integration.attachments_presign_post
  id = "64tl7py3r6/z0j5j4/POST"
}

import {
  to = module.email.aws_api_gateway_method.attachments_presign_options
  id = "64tl7py3r6/z0j5j4/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.attachments_presign_options
  id = "64tl7py3r6/z0j5j4/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method.email_addresses_get
  id = "64tl7py3r6/bqndmb/GET"
}

import {
  to = module.email.aws_api_gateway_integration.email_addresses_get
  id = "64tl7py3r6/bqndmb/GET"
}

import {
  to = module.email.aws_api_gateway_method.email_addresses_post
  id = "64tl7py3r6/bqndmb/POST"
}

import {
  to = module.email.aws_api_gateway_integration.email_addresses_post
  id = "64tl7py3r6/bqndmb/POST"
}

import {
  to = module.email.aws_api_gateway_method.email_addresses_options
  id = "64tl7py3r6/bqndmb/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.email_addresses_options
  id = "64tl7py3r6/bqndmb/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method.email_addresses_id_delete
  id = "64tl7py3r6/osc10v/DELETE"
}

import {
  to = module.email.aws_api_gateway_integration.email_addresses_id_delete
  id = "64tl7py3r6/osc10v/DELETE"
}

import {
  to = module.email.aws_api_gateway_method.email_addresses_id_options
  id = "64tl7py3r6/osc10v/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_integration.email_addresses_id_options
  id = "64tl7py3r6/osc10v/OPTIONS"
}

import {
  to = module.email.aws_api_gateway_method_response.emails_options
  id = "64tl7py3r6/6zb8wb/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.emails_options
  id = "64tl7py3r6/6zb8wb/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_method_response.emails_id_options
  id = "64tl7py3r6/i1239z/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.emails_id_options
  id = "64tl7py3r6/i1239z/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_method_response.webhook_email_options
  id = "64tl7py3r6/2cyrya/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.webhook_email_options
  id = "64tl7py3r6/2cyrya/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_method_response.attachments_presign_options
  id = "64tl7py3r6/z0j5j4/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.attachments_presign_options
  id = "64tl7py3r6/z0j5j4/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_method_response.email_addresses_options
  id = "64tl7py3r6/bqndmb/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.email_addresses_options
  id = "64tl7py3r6/bqndmb/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_method_response.email_addresses_id_options
  id = "64tl7py3r6/osc10v/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_integration_response.email_addresses_id_options
  id = "64tl7py3r6/osc10v/OPTIONS/200"
}

import {
  to = module.email.aws_api_gateway_stage.email
  id = "64tl7py3r6/dev"
}

import {
  to = module.email.aws_api_gateway_deployment.email
  id = "64tl7py3r6/1x4i7f"
}
