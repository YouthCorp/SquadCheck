# ── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json tsconfig.base.json ./

# Copy all package.json files first (for better layer caching)
COPY packages/database/package.json packages/database/
COPY packages/analysis/package.json packages/analysis/
COPY packages/ingestion/package.json packages/ingestion/
COPY packages/api/package.json packages/api/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/database/ packages/database/
COPY packages/analysis/ packages/analysis/
COPY packages/ingestion/ packages/ingestion/
COPY packages/api/ packages/api/

# Generate Prisma client
RUN npx -w packages/database prisma generate

# Build packages in dependency order
RUN npx -w packages/database tsc \
 && npx -w packages/analysis tsc \
 && npx -w packages/ingestion tsc \
 && npx -w packages/api tsc

# ── Stage 2: Production ─────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/database/package.json packages/database/
COPY packages/analysis/package.json packages/analysis/
COPY packages/ingestion/package.json packages/ingestion/
COPY packages/api/package.json packages/api/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma schema + generated client
COPY packages/database/prisma/ packages/database/prisma/
COPY --from=builder /app/node_modules/.prisma/ node_modules/.prisma/
COPY --from=builder /app/node_modules/@prisma/ node_modules/@prisma/

# Copy built dist folders
COPY --from=builder /app/packages/database/dist/ packages/database/dist/
COPY --from=builder /app/packages/analysis/dist/ packages/analysis/dist/
COPY --from=builder /app/packages/ingestion/dist/ packages/ingestion/dist/
COPY --from=builder /app/packages/api/dist/ packages/api/dist/

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
