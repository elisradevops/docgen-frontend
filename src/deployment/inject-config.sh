#!/bin/sh
set -eu

TARGET_DIR="${TARGET_DIR:?TARGET_DIR must be set}"

JSON_DOCUMENT_URL="${JSON_DOCUMENT_URL:-}"
if [ -z "$JSON_DOCUMENT_URL" ]; then
  echo "JSON_DOCUMENT_URL is not set" >&2
  exit 1
fi

AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-common}"

cat > "$TARGET_DIR/config.js" <<EOF
window.APP_CONFIG = {
  JSON_DOCUMENT_URL: "$JSON_DOCUMENT_URL",
  AZURE_CLIENT_ID: "$AZURE_CLIENT_ID",
  AZURE_TENANT_ID: "$AZURE_TENANT_ID"
};
EOF

if [ -f "$TARGET_DIR/index.html" ] && ! grep -q 'config.js' "$TARGET_DIR/index.html"; then
  sed -i 's|<head>|<head><script src="config.js"></script>|' \
    "$TARGET_DIR/index.html"
fi

echo "Config injected into $TARGET_DIR"