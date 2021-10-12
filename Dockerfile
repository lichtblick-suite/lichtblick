# Build stage
FROM node:16 as build
WORKDIR /src
COPY . ./

RUN yarn install --immutable
RUN yarn run web:build:prod

# Release stage
FROM caddy:2
WORKDIR /src
COPY --from=build /src/web/.webpack ./

EXPOSE 8080
CMD ["caddy", "file-server", "--listen", ":8080"]
