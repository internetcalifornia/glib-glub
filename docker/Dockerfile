# syntax=docker/dockerfile:1-labs
# The labs frontend supplies COPY --parents, which is what lets each stage pull
# in every workspace manifest by glob instead of by a hand-maintained list.

# Must match package.json's "packageManager" field. A bare `npm i -g pnpm`
# installs the latest major, which then tries to self-manage down to the pinned
# version by fetching a binary it cannot verify against this lockfile.
ARG PNPM_VERSION=10.33.0
# The build's git commit, baked into every stage so the loggers can stamp each
# row with the exact code that produced it (0.1.0+sha).
ARG GIT_COMMIT=unknown

# ---------------------------------------------------------------------------
# builder: installs everything, compiles the migrate bundle, builds Next.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION}

# Manifests first, so the dependency install caches independently of source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

# A production build writes into apps/web/.next WITHOUT clearing it; a
# developer's Turbopack dev output must not ride into the image.
RUN rm -rf apps/web/.next

RUN node packages/db/scripts/build-migrations.js
RUN pnpm --filter web build

# ---------------------------------------------------------------------------
# web: the Next.js app.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS web
ARG PNPM_VERSION
WORKDIR /app
RUN apk add --no-cache dumb-init && npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json ./
# Optionals are kept: Next ships its native SWC binary as an optionalDependency.
RUN pnpm install --frozen-lockfile --prod --filter web... && \
    rm -rf /root/.pnpm-store /root/.npm

# Workspace packages ship TypeScript source (transpilePackages); the links
# need the sources present, and each "main" points into src/.
COPY --parents packages/*/src ./

# Create the non-root user BEFORE anything it needs to own: a trailing
# `chown -R` rewrites every file's metadata into a new overlay layer.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --chown=nextjs:nodejs --from=builder /app/apps/web/.next ./apps/web/.next
COPY --chown=nextjs:nodejs --from=builder /app/apps/web/public ./apps/web/public
COPY --chown=nextjs:nodejs --from=builder /app/apps/web/next.config.ts /app/apps/web/tsconfig.json ./apps/web/
RUN mkdir -p /app/apps/web/.next/cache && chown -R nextjs:nodejs /app/apps/web/.next/cache

USER nextjs
EXPOSE 3000
ARG GIT_COMMIT
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 GIT_COMMIT=${GIT_COMMIT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "--filter", "web", "start"]

# ---------------------------------------------------------------------------
# voice-gateway: the WebSocket service. Runs TypeScript through tsx, so it
# ships source — its own and every workspace package it imports.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS voice-gateway
ARG PNPM_VERSION
WORKDIR /app
RUN apk add --no-cache dumb-init && npm install -g pnpm@${PNPM_VERSION}
RUN addgroup -g 1001 -S nodejs && adduser -S gateway -u 1001

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile --prod --filter voice-gateway... && \
    rm -rf /root/.pnpm-store /root/.npm

COPY --chown=gateway:nodejs --parents packages/*/src ./
COPY --chown=gateway:nodejs apps/voice-gateway/src ./apps/voice-gateway/src
COPY --chown=gateway:nodejs apps/voice-gateway/tsconfig.json ./apps/voice-gateway/

USER gateway
EXPOSE 8787
ARG GIT_COMMIT
ENV NODE_ENV=production GIT_COMMIT=${GIT_COMMIT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.VOICE_GATEWAY_PORT || 8787) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "--filter", "voice-gateway", "start"]

# ---------------------------------------------------------------------------
# migrate: applies pending migrations and exits. Run deliberately, never as a
# side effect of starting the app.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS migrate
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S migrate -u 1001

# The bundle is self-contained except for pg (native-optional, left external).
COPY --chown=migrate:nodejs --from=builder /app/packages/db/dist ./packages/db/dist
COPY --chown=migrate:nodejs --from=builder /app/node_modules/.pnpm/node_modules/pg ./node_modules/pg
COPY --chown=migrate:nodejs --from=builder /app/node_modules/.pnpm/node_modules ./node_modules/.pnpm/node_modules

USER migrate
ARG GIT_COMMIT
ENV NODE_ENV=production GIT_COMMIT=${GIT_COMMIT} MIGRATIONS_DIR=/app/packages/db/dist/migrations
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/db/dist/migrate.cjs"]
