# syntax=docker/dockerfile:1

# ---- Stage 1: build -------------------------------------------------------
# The "kitchen": has Node, npm and every build dependency. None of it ships.
FROM node:22.23.5-alpine AS build
WORKDIR /app

# Copy only the dependency manifests first. Docker caches each step, so
# `npm ci` re-runs only when dependencies change, not on every content edit.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: runtime -----------------------------------------------------
# The "dining room": nginx and the finished HTML/CSS, nothing else.
# nginx-unprivileged runs as uid 101 (not root) and listens on 8080, because
# non-root processes can't bind ports below 1024.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine

# Pull in the OS security fixes released since this base image was built (the
# CI vulnerability scan fails the build if fixable HIGH/CRITICAL ones remain).
# Needs root, so switch back to the unprivileged user right after.
USER root
RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Explicit even though the base image already does it: a reader (or a policy
# scanner) can see at a glance that this container never runs as root.
USER 101

EXPOSE 8080

# Docker-only health check. Kubernetes ignores this and uses its own probes
# (we'll point them at the same /healthz path).
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
