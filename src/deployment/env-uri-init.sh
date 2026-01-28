#!/bin/sh
set -eu

placeholder="$(printenv 'BACKEND-URL-PLACEHOLDER-ContentControl' 2>/dev/null || true)"

if [ -z "$placeholder" ]; then
  echo "BACKEND-URL-PLACEHOLDER-ContentControl is not set; aborting." >&2
  exit 1
fi

echo "Replacing BACKEND-URL-PLACEHOLDER-ContentControl with $placeholder"

escaped_placeholder=$(printf '%s\n' "$placeholder" | sed 's/[&|]/\\&/g')

target_dir="/usr/share/nginx/html"

find "$target_dir" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
  -exec sed -i "s|BACKEND-URL-PLACEHOLDER-ContentControl|$escaped_placeholder|g" {} +

# Inject Azure AD OAuth config at runtime
AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-common}"

if [ -n "$AZURE_CLIENT_ID" ]; then
  echo "Injecting Azure AD config: CLIENT_ID=$AZURE_CLIENT_ID, TENANT_ID=$AZURE_TENANT_ID"
  
  # Create config script to inject into index.html
  cat > "$target_dir/config.js" <<EOF
window.APP_CONFIG = {
  AZURE_CLIENT_ID: "$AZURE_CLIENT_ID",
  AZURE_TENANT_ID: "$AZURE_TENANT_ID"
};
EOF
  
  # Inject config.js into index.html before other scripts
  sed -i 's|<head>|<head><script src="/config.js"></script>|' "$target_dir/index.html"
else
  echo "AZURE_CLIENT_ID not set, using build-time values"
fi

echo "Starting nginx"

# Build VSIX at container startup (requires tfx)
echo "Building VSIX (startup)..."
/bin/sh /tmp/deployment/create-vsix.sh || true

exec nginx -g "daemon off;"
