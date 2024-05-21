echo replace BACKEND-URL-PLACEHOLDER-ContentControl
echo "$BACKEND_URL_PLACEHOLDER_ContentControl"
find '/usr/share/nginx/html/static/js' -name '*.js' -exec sed -i 's,BACKEND-URL-PLACEHOLDER-ContentControl,'"$BACKEND_URL_PLACEHOLDER_ContentControl"',g' {} \;

echo starting server
nginx -g "daemon off;"

