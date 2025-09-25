#!/bin/sh
set -eu

placeholder="${BACKEND-URL-PLACEHOLDER-ContentControl:-}"

if [ -z "$placeholder" ]; then
  echo "BACKEND_URL_PLACEHOLDER_ContentControl is not set; aborting." >&2
  exit 1
fi

echo "Replacing BACKEND-URL-PLACEHOLDER-ContentControl with $placeholder"

escaped_placeholder=$(printf '%s\n' "$placeholder" | sed 's/[&|]/\\&/g')

target_dir="/usr/share/nginx/html"

find "$target_dir" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
  -exec sed -i "s|BACKEND-URL-PLACEHOLDER-ContentControl|$escaped_placeholder|g" {} +

echo "Starting nginx"
exec nginx -g "daemon off;"
