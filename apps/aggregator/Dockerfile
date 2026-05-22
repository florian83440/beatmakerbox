# syntax=docker/dockerfile:1.7

# ---- Build stage --------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /workspace

RUN corepack enable

# Copy the workspace skeleton needed to install + build the aggregator.
# Build context must be the monorepo root (compose uses `context: ../..`).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/dsp ./packages/dsp
COPY apps/aggregator ./apps/aggregator

# pnpm 9 install — uses the lockfile if present, falls back to fresh resolve.
RUN pnpm install --frozen-lockfile --filter @beatmakerbox/aggregator... \
 || pnpm install --filter @beatmakerbox/aggregator...

RUN pnpm --filter @beatmakerbox/aggregator build

# `pnpm deploy` produces a self-contained directory with a real (NOT
# symlinked) node_modules and the package's own files (incl. dist/).
# `--prod` keeps only runtime deps. This is the canonical fix for the
# pnpm-symlinks-in-Docker problem: a plain `COPY node_modules` would
# preserve the symlinks pointing into .pnpm/, which no longer exist
# in the runtime image — every require() then fails with ERR_MODULE_NOT_FOUND.
RUN pnpm --filter @beatmakerbox/aggregator deploy --prod /deploy

# ---- Runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Production mode → Fastify uses the JSON pino transport (no pino-pretty).
ENV NODE_ENV=production

RUN apk add --no-cache wget tini

# Copy the standalone deploy directory: package.json, node_modules (flat),
# dist/, etc.
COPY --from=build /deploy ./

# SQLite file lives here, mount as a volume.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/healthz >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
