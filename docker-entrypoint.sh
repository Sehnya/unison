#!/bin/sh
set -e

# Replace API_URL in nginx config
# Only substitute API_URL, not nginx variables like $host
envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
