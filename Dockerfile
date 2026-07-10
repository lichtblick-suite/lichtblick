# Build stage
FROM node:22 AS build
WORKDIR /src
COPY . ./

RUN corepack enable
RUN yarn install --immutable

ARG API_URL
RUN if [ -n "$API_URL" ]; then \
			escaped_api_url=$(printf '%s\n' "$API_URL" | sed 's/[\\&#]/\\&/g'); \
			sed -i "s#^API_URL=.*#API_URL=\"$escaped_api_url\"#" .env; \
		fi && \
		resolved_api_url=$(grep '^API_URL=' .env | sed -E 's/^API_URL="?([^"]*)"?$/\1/') && \
		printf '%s' "$resolved_api_url" > /tmp/build-api-url.txt && \
		yarn run web:build:prod

# Release stage
FROM caddy:2.5.2-alpine
WORKDIR /src
COPY --from=build /src/web/.webpack ./
COPY --from=build /tmp/build-api-url.txt /src/.build-api-url

EXPOSE 8080

COPY <<'EOF' /entrypoint.sh
# Optionally override API_URL at runtime with API_URL env var (or API for backward compatibility)
runtime_api=${API_URL:-$API}
if [ -n "$runtime_api" ] && [ -f /src/.build-api-url ]; then
  build_api=$(cat /src/.build-api-url)
  if [ -n "$build_api" ] && [ "$build_api" != "$runtime_api" ]; then
    escaped_build_api=$(printf '%s\n' "$build_api" | sed 's/[][\/.*^$&|]/\\&/g')
    escaped_runtime_api=$(printf '%s\n' "$runtime_api" | sed 's/[\\&|]/\\&/g')
    find /src -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) \
      -exec sed -i "s|$escaped_build_api|$escaped_runtime_api|g" {} +
  fi
fi

# Optionally override the default layout with one provided via bind mount
mkdir -p /lichtblick
touch /lichtblick/default-layout.json
index_html=$(cat index.html)
replace_pattern='/*LICHTBLICK_SUITE_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=$(cat /lichtblick/default-layout.json)
escaped_pattern=$(printf '%s\n' "$replace_pattern" | sed 's/[][\/.*^$]/\\&/g')
escaped_value=$(printf '%s\n' "$replace_value" | sed 's/[\\&]/\\&/g')
printf '%s\n' "$index_html" | sed "s/$escaped_pattern/$escaped_value/" > index.html

# Continue executing the CMD
exec "$@"
EOF

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["caddy", "file-server", "--listen", ":8080"]
