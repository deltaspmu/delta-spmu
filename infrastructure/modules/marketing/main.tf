##############################################################################
# Marketing module — assets bucket, marketing website bucket, CloudFront
# (verbatim move from the original flat main.tf)
#
# NOTE: as of 2026-07 the live marketing site is served by Vercel; these
# resources exist in prod but are empty/idle (docs/PROD_INVENTORY.md).
# The module exists so prod can import them; decommissioning is a separate
# user decision.
##############################################################################

# Assets bucket (certificates, general assets)
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${var.bucket_suffix}"

  tags = {
    Name = "${var.name_prefix}-assets"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Marketing site bucket
resource "aws_s3_bucket" "marketing" {
  bucket = "${var.project_name}-marketing-${var.bucket_suffix}"

  tags = {
    Name = "${var.name_prefix}-marketing"
  }
}

resource "aws_s3_bucket_website_configuration" "marketing" {
  bucket = aws_s3_bucket.marketing.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "marketing" {
  bucket = aws_s3_bucket.marketing.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "marketing" {
  bucket = aws_s3_bucket.marketing.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.marketing.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.marketing]
}

##############################################################################
# CloudFront Distribution (Marketing Site)
##############################################################################

resource "aws_cloudfront_distribution" "marketing" {
  origin {
    domain_name = aws_s3_bucket_website_configuration.marketing.website_endpoint
    origin_id   = "S3-${aws_s3_bucket.marketing.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name} marketing site"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.marketing.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # SPA routing — return index.html for 403/404
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.name_prefix}-cdn"
  }
}
