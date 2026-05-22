# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# pnpm via corepack — keep lockfile install reproducible
RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime

# Drop the default site, install our SPA-aware config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine listens on 80 by default; vps-ops/Traefik route to it.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
