#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx -w packages/database prisma migrate deploy

echo "[entrypoint] Starting API server..."
exec node packages/api/dist/index.js
