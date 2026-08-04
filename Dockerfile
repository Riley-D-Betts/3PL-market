FROM node:22-alpine AS build
WORKDIR /app

# Optional corporate-proxy CA: drop a `.build-ca.crt` next to the Dockerfile
# and node/pnpm will trust it during the build. The [t] glob makes the COPY a
# no-op when the file does not exist.
COPY package.json pnpm-lock.yaml .build-ca.cr[t] ./
ENV NODE_EXTRA_CA_CERTS=/app/.build-ca.crt
RUN corepack enable && pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    NUXT_MIGRATIONS_DIR=/app/migrations
WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/server/database/migrations ./migrations

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
