#!/bin/sh
set -e

echo "=========================================="
echo "Frontend Container Starting"
echo "=========================================="
echo "API_URL environment variable: ${API_URL:-NOT SET}"
echo ""

# Check if API_URL is set
if [ -z "$API_URL" ]; then
    echo "WARNING: API_URL is not set!"
    echo "Using default: http://localhost:3001"
    API_URL="http://localhost:3001"
fi

echo "Configuring nginx to proxy /api/* to: $API_URL"
echo ""

# Replace API_URL_PLACEHOLDER in nginx config using sed
sed "s|API_URL_PLACEHOLDER|${API_URL}|g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "Generated nginx config:"
echo "----------------------------------------"
cat /etc/nginx/conf.d/default.conf | grep -A 15 "location /api/"
echo "----------------------------------------"
echo ""

# Test if API is reachable (optional, non-blocking)
echo "Testing API connectivity..."
if wget --spider --timeout=5 "${API_URL}/health" 2>/dev/null; then
    echo "✓ API is reachable at ${API_URL}/health"
else
    echo "⚠ Could not reach API at ${API_URL}/health (this may be normal during startup)"
fi
echo ""

echo "Starting nginx..."
echo "=========================================="

# Start nginx
exec nginx -g 'daemon off;'
