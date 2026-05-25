#!/bin/bash
# Set up HTTPS for api.deltaspmu.com on the Frappe EC2 backend.
#
# Steps:
#   1. Install certbot + nginx plugin
#   2. Write nginx server block proxying to bench on localhost:8000
#   3. Reload nginx (HTTP-only block, used by Let's Encrypt for challenge)
#   4. Run certbot --nginx to issue cert + add 443 + redirect
#   5. Smoke test: curl https://api.deltaspmu.com/api/method/ping
#
# Prerequisites:
#   - DNS record api.deltaspmu.com -> 18.194.169.111 must already resolve
#     (run `dig +short api.deltaspmu.com` to confirm before running this).
#   - Bench must be running on port 8000.

set -e

EC2_HOST="ubuntu@18.194.169.111"
DOMAIN="api.deltaspmu.com"
CERT_EMAIL="admin@deltaspmu.com"

echo "==> Pre-flight: confirm DNS + bench are ready..."
RESOLVED=$(dig +short @8.8.8.8 ${DOMAIN} 2>/dev/null | head -1)
if [ -z "$RESOLVED" ]; then
  echo "  FAIL: ${DOMAIN} does not resolve. Wait for DNS propagation."
  exit 1
fi
echo "  ${DOMAIN} -> ${RESOLVED}"

if ! curl -fsS http://18.194.169.111:8000/api/method/ping > /dev/null; then
  echo "  FAIL: bench is not responding on port 8000."
  exit 1
fi
echo "  bench is responding."

echo ""
echo "==> Installing certbot..."
ssh -n ${EC2_HOST} "sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx > /tmp/certbot-install.log 2>&1" </dev/null

echo "==> Writing nginx server block..."
ssh -n ${EC2_HOST} "sudo tee /etc/nginx/conf.d/${DOMAIN}.conf > /dev/null" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Allow Let's Encrypt webroot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100M;
    }
}
NGINXEOF

echo "==> Testing nginx config..."
ssh -n ${EC2_HOST} "sudo nginx -t" </dev/null

echo "==> Reloading nginx..."
ssh -n ${EC2_HOST} "sudo systemctl reload nginx" </dev/null

echo ""
echo "==> Issuing Let's Encrypt certificate via certbot --nginx..."
ssh -n ${EC2_HOST} "sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${CERT_EMAIL} --redirect --no-eff-email" </dev/null

echo ""
echo "==> Smoke test:"
sleep 3
curl -fsS https://${DOMAIN}/api/method/ping || { echo "  FAIL"; exit 1; }
echo ""
echo "==> Done. Backend now reachable at https://${DOMAIN}/"
