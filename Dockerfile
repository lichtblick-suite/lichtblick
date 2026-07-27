# Build stage
FROM node:22 AS build
WORKDIR /src
COPY . ./

RUN corepack enable
RUN yarn install --immutable

RUN yarn run web:build:prod

# Release stage
FROM caddy:2.5.2-alpine
WORKDIR /src
COPY --from=build /src/web/.webpack ./

EXPOSE 8080

COPY <<'EOF' /entrypoint.sh
# Optionally override API_URL at runtime using environment variable
index_html=$(cat index.html)
runtime_api_url="${API_URL:-}"
runtime_api_placeholder='/*LICHTBLICK_SUITE_RUNTIME_API_URL_PLACEHOLDER*/'
index_html="${index_html/"$runtime_api_placeholder"/$runtime_api_url}"

# Optionally override the default layout with one provided via bind mount
mkdir -p /lichtblick
touch /lichtblick/default-layout.json
replace_pattern='/*LICHTBLICK_SUITE_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=$(cat /lichtblick/default-layout.json)
index_html="${index_html/"$replace_pattern"/$replace_value}"
echo "$index_html" > index.html

# Continue executing the CMD
exec "$@"
EOF

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["caddy", "file-server", "--listen", ":8080"]
