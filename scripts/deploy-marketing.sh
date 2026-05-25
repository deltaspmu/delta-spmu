#!/bin/bash
# Deploy marketing site to S3 + invalidate CloudFront
# Usage: ./scripts/deploy-marketing.sh <S3-BUCKET> <CLOUDFRONT-ID>

set -e

S3_BUCKET="${1:?Usage: deploy-marketing.sh <S3-BUCKET> <CLOUDFRONT-ID>}"
CF_ID="${2:?Usage: deploy-marketing.sh <S3-BUCKET> <CLOUDFRONT-ID>}"

echo "==> Building marketing site..."
npm run build

echo "==> Syncing to S3..."
aws s3 sync dist/ s3://${S3_BUCKET} --delete

echo "==> Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ${CF_ID} --paths "/*"

echo "==> Marketing deployment complete!"
