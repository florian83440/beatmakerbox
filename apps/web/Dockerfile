# syntax=docker/dockerfile:1.7

# ---- Build stage --------------------------------------------------------
# Build context MUST be the monorepo root (compose uses `context: ../..`)
# because the web app depends on the @beatmakerbox/dsp workspace package.
FROM node:22-alpine AS build
WORKDIR /workspace

RUN corepack enable

# Workspace skeleton + lockfile.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./

# The two packages the web build needs.
COPY packages/dsp ./packages/dsp
COPY apps/web    ./apps/web

# Install + build only what's needed for the web app.
RUN pnpm install --frozen-lockfile --filter @beatmakerbox/web... \
 || pnpm install --filter @beatmakerbox/web...

RUN pnpm --filter @beatmakerbox/web build

# ---- Runtime stage ------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Drop the default site, install our SPA-aware config.
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

# nginx:alpine listens on 80 by default; Traefik routes to it.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
