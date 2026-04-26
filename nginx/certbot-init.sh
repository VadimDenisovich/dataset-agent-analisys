#!/bin/bash
# ============================================================
# Certbot SSL Certificate Initialization Script
# Run this ONCE on the server to get the initial certificate
# ============================================================

set -e

DOMAIN="vadim-denisovich.space"
EMAIL="vadim@vadim-denisovich.space"  # Change to your email
DATA_PATH="./nginx/certbot"

echo "=== SSL Certificate Setup for $DOMAIN ==="

# Step 1: Create required directories
echo "[1/4] Creating directories..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

# Step 2: Start nginx with HTTP only (for ACME challenge)
echo "[2/4] Starting Nginx (HTTP only for ACME verification)..."

# Create a temporary nginx config without SSL
cat > ./nginx/nginx-temp.conf << 'NGINX_TEMP'
worker_processes auto;
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name vadim-denisovich.space;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 'SSL setup in progress...';
            add_header Content-Type text/plain;
        }
    }
}
NGINX_TEMP

# Start nginx with temp config
docker compose run -d --rm --name nginx-temp \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot:ro" \
  nginx nginx

sleep 3

# Step 3: Get certificate
echo "[3/4] Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 4: Stop temp nginx and start full stack
echo "[4/4] Cleaning up and restarting with SSL..."
docker stop nginx-temp 2>/dev/null || true
rm -f ./nginx/nginx-temp.conf

echo ""
echo "=== Done! ==="
echo "Certificate obtained for $DOMAIN"
echo "Now run: docker compose up -d"
echo ""
echo "Certificate auto-renewal is handled by the certbot container."
echo "Certificates are stored in: $DATA_PATH/conf/"
