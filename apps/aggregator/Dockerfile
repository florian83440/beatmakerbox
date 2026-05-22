# syntax=docker/dockerfile:1.7

# ---- Build stage --------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /workspace

RUN corepack enable

# Copy the workspace skeleton needed to install + build the aggregator.
# Build context must be the monorepo root (see docker-compose).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/dsp ./packages/dsp
COPY apps/aggregator ./apps/aggregator

# pnpm 9 install — uses the lockfile if present, falls back to fresh resolve.
RUN pnpm install --frozen-lockfile --filter @beatmakerbox/aggregator... \
 || pnpm install --filter @beatmakerbox/aggregator...

RUN pnpm --filter @beatmakerbox/aggregator build

# ---- Runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache wget tini

# Copy node_modules + built artifact + package.json (for "type": "module").
COPY --from=build /workspace/apps/aggregator/dist           ./dist
COPY --from=build /workspace/apps/aggregator/package.json   ./package.json
COPY --from=build /workspace/apps/aggregator/node_modules   ./node_modules

# SQLite file lives here, mount as a volume.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/healthz >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
