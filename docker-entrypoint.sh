#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx -w packages/database prisma migrate deploy

if [ "$SERVICE_MODE" = "scheduler" ]; then
  echo "[entrypoint] Starting Ingestion Scheduler..."
  exec node packages/ingestion/dist/scheduler.js
else
  echo "[entrypoint] Starting API server..."
  exec node packages/api/dist/index.js
fi
