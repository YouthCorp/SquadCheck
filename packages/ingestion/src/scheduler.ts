import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from './client/api-football';
import { Orchestrator } from './orchestrator';

const CRON_SCHEDULE = process.env.SYNC_CRON_SCHEDULE || '10 */2 * * *';
// Signal collection runs on odd hours to avoid overlap with main sync
const SIGNAL_CRON_SCHEDULE = process.env.SIGNAL_CRON_SCHEDULE || '0 1,3,5,7,9,11,13,15,17,19,21,23 * * *';

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
let isSignalRunning = false;

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

async function runSignalCollection() {
  if (isSignalRunning) {
    console.log('[SignalScheduler] Signal collection already running, skipping');
    return;
  }

  isSignalRunning = true;
  console.log(`[SignalScheduler] Starting signal collection at ${new Date().toISOString()}`);

  try {
    await orchestrator.collectSignals();
  } catch (err) {
    console.error('[SignalScheduler] Signal collection failed:', err);
  } finally {
    isSignalRunning = false;
  }
}

console.log(`[Scheduler] Main sync cron: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runSync);

if (process.env.ANTHROPIC_API_KEY) {
  console.log(`[Scheduler] Signal collection cron: ${SIGNAL_CRON_SCHEDULE}`);
  cron.schedule(SIGNAL_CRON_SCHEDULE, runSignalCollection);
} else {
  console.log('[Scheduler] Signal collection disabled (no ANTHROPIC_API_KEY)');
}

// Run once immediately on startup (set SKIP_STARTUP_SYNC=true to disable for local dev)
if (process.env.SKIP_STARTUP_SYNC !== 'true') {
  runSync();
  if (process.env.ANTHROPIC_API_KEY) {
    runSignalCollection();
  }
}
