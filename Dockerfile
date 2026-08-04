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

# Stamped into /api/health so a deploy can prove the running container is the
# one it just built. `.git` is excluded from the build context, so these have to
# arrive as build args rather than being read from the tree.
ARG GIT_COMMIT=unknown
ARG BUILT_AT=unknown

ENV NODE_ENV=production \
    PORT=3000 \
    NUXT_MIGRATIONS_DIR=/app/migrations \
    NUXT_GIT_COMMIT=$GIT_COMMIT \
    NUXT_BUILT_AT=$BUILT_AT
WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/server/database/migrations ./migrations

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
