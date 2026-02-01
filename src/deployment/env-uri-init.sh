#!/bin/sh
set -eu

target_dir="/usr/share/nginx/html"

# -----------------------------
# Backend URL (required)
# -----------------------------
JSON_DOCUMENT_URL="${JSON_DOCUMENT_URL:-}"

if [ -z "$JSON_DOCUMENT_URL" ]; then
  echo "JSON_DOCUMENT_URL is not set; aborting." >&2
  exit 1
fi

echo "Using JSON_DOCUMENT_URL=$JSON_DOCUMENT_URL"

# -----------------------------
# Azure AD config (optional)
# -----------------------------
AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-common}"

# -----------------------------
# Generate runtime config.js
# -----------------------------
cat > "$target_dir/config.js" <<EOF
window.APP_CONFIG = {
  JSON_DOCUMENT_URL: "$JSON_DOCUMENT_URL",
  AZURE_CLIENT_ID: "$AZURE_CLIENT_ID",
  AZURE_TENANT_ID: "$AZURE_TENANT_ID"
};
EOF

echo "Generated runtime config.js"

# -----------------------------
# Inject config.js into index.html (idempotent)
# -----------------------------
if ! grep -q 'config.js' "$target_dir/index.html"; then
  sed -i 's|<head>|<head><script src="/config.js"></script>|' \
    "$target_dir/index.html"
fi

# -----------------------------
# Start nginx
# -----------------------------
echo "Starting nginx"
exec nginx -g "daemon off;"