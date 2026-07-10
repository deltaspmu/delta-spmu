#!/bin/bash
# Deploy marketing site to S3 + invalidate CloudFront.
# Usage: ./scripts/deploy-marketing.sh <staging|prod> [S3-BUCKET] [CLOUDFRONT-ID]
#
# NOTE: as of 2026-07, the live marketing site is served by VERCEL, not
# S3+CloudFront (see docs/PROD_INVENTORY.md) — the prod bucket/distribution
# exist but receive no traffic. This script is kept for the day that changes.

set -e
source "$(cd "$(dirname "$0")" && pwd)/lib/load-env.sh" "$1"

S3_BUCKET="${2:-$S3_MARKETING_BUCKET}"
CF_ID="${3:-$CLOUDFRONT_ID}"
: "${S3_BUCKET:?No S3 bucket configured for ${ENV_NAME} (set S3_MARKETING_BUCKET in scripts/env/${ENV_NAME}.env or pass as arg 2)}"
: "${CF_ID:?No CloudFront ID configured for ${ENV_NAME} (set CLOUDFRONT_ID in scripts/env/${ENV_NAME}.env or pass as arg 3)}"

echo "==> Building marketing site..."
npm run build

echo "==> Syncing to S3..."
aws s3 sync dist/ s3://${S3_BUCKET} --delete

echo "==> Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ${CF_ID} --paths "/*"

echo "==> Marketing deployment complete!"
