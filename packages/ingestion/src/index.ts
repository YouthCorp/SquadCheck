import * as path from 'path';
import { config } from 'dotenv';

// Load .env from project root (2 levels up from packages/ingestion)
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from './client/api-football';
import { Orchestrator } from './orchestrator';

const prisma = new PrismaClient();

async function main() {
  const command = process.argv[2] || 'help';

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    console.error('Missing API_FOOTBALL_KEY in .env');
    process.exit(1);
  }

  const perMinute = parseInt(process.env.API_FOOTBALL_PER_MINUTE || '280');
  const dailyLimit = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT || '7500');
  const api = new ApiFootballClient(apiKey, perMinute, dailyLimit);
  const orchestrator = new Orchestrator(api, prisma);

  switch (command) {
    case 'seed': {
      // Full seed: all leagues, all seasons
      // Optional flags: --leagues=39 --seasons=2024
      const leagueArg = getArg('--leagues');
      const seasonArg = getArg('--seasons');

      const options: { leagues?: number[]; seasons?: number[] } = {};
      if (leagueArg) options.leagues = leagueArg.split(',').map(Number);
      if (seasonArg) options.seasons = seasonArg.split(',').map(Number);

      await orchestrator.fullSeed(options);
      break;
    }

    case 'sync': {
      // Incremental sync: current seasons only
      await orchestrator.incrementalSync();
      break;
    }

    case 'help':
    default:
      console.log(`
SquadCheck Ingestion CLI
========================

Commands:
  seed              Full seed (all leagues × all seasons)
  seed --leagues=39 --seasons=2024    Seed specific league/season
  sync              Incremental sync (current seasons only)
  help              Show this help

Environment:
  API_FOOTBALL_KEY          API key (required)
  API_FOOTBALL_PER_MINUTE   Rate limit per minute (default: 280)
  API_FOOTBALL_DAILY_LIMIT  Daily request limit (default: 7500)
`);
      break;
  }
}

function getArg(flag: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(flag + '='));
  return arg ? arg.split('=')[1] : undefined;
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
