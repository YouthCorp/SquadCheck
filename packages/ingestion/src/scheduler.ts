import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from './client/api-football';
import { Orchestrator } from './orchestrator';

const CRON_SCHEDULE = process.env.SYNC_CRON_SCHEDULE || '0 0,6,12,18 * * *';

const prisma = new PrismaClient();
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error('Missing API_FOOTBALL_KEY in .env');
  process.exit(1);
}

const perMinute = parseInt(process.env.API_FOOTBALL_PER_MINUTE || '280');
const dailyLimit = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT || '7500');
const api = new ApiFootballClient(apiKey, perMinute, dailyLimit);
const orchestrator = new Orchestrator(api, prisma);

let isRunning = false;

async function runSync() {
  if (isRunning) {
    console.log('[Scheduler] Sync already running, skipping');
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] Starting sync at ${new Date().toISOString()}`);

  try {
    await orchestrator.incrementalSync();
  } catch (err) {
    console.error('[Scheduler] Sync failed:', err);
  } finally {
    isRunning = false;
  }
}

console.log(`[Scheduler] Cron scheduled: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runSync);

// Run once immediately on startup
runSync();
