# ─────────────────────────────────────────────────────────────────────────────
# Foresight Atlas — self-hosted production image
#
# Runs the Express API server (port 3001) and, when SIGNAL_* env vars are set,
# the Signal check-in poller inside the same process. Data is read/written to
# the Google Sheet only (no database.json at runtime).
#
# Build:  docker build -t foresightatlas .
#
# Run (env from file; .env.local should have SPREADSHEET_ID and
#      GOOGLE_SERVICE_ACCOUNT_KEY with the full JSON, or use -e for each):
#   docker run --env-file .env.local -p 3001:3001 foresightatlas
#
# Or mount the keys folder and use the key file:
#   docker run -v "$(pwd)/keys:/app/keys" \
#     -e SPREADSHEET_ID=your-sheet-id \
#     -e GOOGLE_APPLICATION_CREDENTIALS=/app/keys/service-account.json \
#     -p 3001:3001 foresightatlas
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install deps ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# ── Stage 2: build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Stage 3: production image ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY api ./api
COPY scripts/sheet-schema.js ./scripts/sheet-schema.js
COPY public/data ./public/data

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
