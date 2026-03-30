import * as path from 'path';
import { config } from 'dotenv';

// Load .env from project root (2 levels up from packages/ingestion)
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from './client/api-football';
import { Orchestrator } from './orchestrator';
import { backfillInjuryFeedFromCurrentState } from './scripts/backfill-injury-feed';

const prisma = new PrismaClient();

async function main() {
  const command = process.argv[2] || 'help';

  const ALL_PHASES = ['leagues', 'teams', 'standings', 'fixtures', 'injuries', 'players', 'fixture_details', 'aggregates'];

  switch (command) {
    case 'seed': {
      const orchestrator = createOrchestrator();
      const leagueArg = getArg('--leagues');
      const seasonArg = getArg('--seasons');
      const skipArg   = getArg('--skip');
      const onlyArg   = getArg('--only');
      const forceArg  = getArg('--force');

      const options: { leagues?: number[]; seasons?: number[]; skipPhases?: string[]; forcePhases?: string[] } = {};
      if (leagueArg) options.leagues = leagueArg.split(',').map(Number);
      if (seasonArg) options.seasons = seasonArg.split(',').map(Number);

      if (onlyArg) {
        // --only=players  →  skip everything except the listed phases
        const keep = new Set(onlyArg.split(',').map(s => s.trim()));
        options.skipPhases = ALL_PHASES.filter(p => !keep.has(p));
      } else if (skipArg) {
        // --skip=leagues,teams,...
        options.skipPhases = skipArg.split(',').map(s => s.trim());
      }

      if (forceArg) {
        // --force=players  or  --force=all
        options.forcePhases = forceArg === 'all'
          ? [...ALL_PHASES]
          : forceArg.split(',').map(s => s.trim());
        console.log(`  Force re-run phases: ${options.forcePhases.join(', ')}`);
      }

      if (options.skipPhases?.length) {
        console.log(`  Skipping phases: ${options.skipPhases.join(', ')}`);
      }

      await orchestrator.fullSeed(options);
      break;
    }

    case 'sync': {
      const orchestrator = createOrchestrator();
      // Incremental sync: current seasons only
      await orchestrator.incrementalSync();
      break;
    }

    case 'backfill:injury-feed': {
      await backfillInjuryFeedFromCurrentState(prisma, getArg('--season'));
      break;
    }

    case 'help':
    default:
      console.log(`
SquadCheck Ingestion CLI
========================

Commands:
  seed                               Full seed (all leagues × all seasons)
  seed --leagues=39 --seasons=2024   Seed specific league/season
  seed --only=players                Run only the players phase
  seed --skip=leagues,teams          Skip specific phases
  sync                               Incremental sync (current seasons only)
  backfill:injury-feed               Seed injury feed history from current DB state
  help                               Show this help

Available phases:
  ${ALL_PHASES.join(', ')}

Examples:
  # Ligue 1 player stats only (cheapest — ~40 API calls)
  seed --leagues=61 --seasons=2025,2024 --only=players --force=players

  # Full seed but skip expensive fixture_details
  seed --leagues=61 --seasons=2025 --skip=fixture_details,aggregates

  # Force re-run a specific phase (ignores COMPLETED checkpoint)
  seed --leagues=61 --seasons=2025 --only=players --force=players

  # Seed the injury feed from current active injuries and live recovery signals
  backfill:injury-feed --season=2025

Environment:
  API_FOOTBALL_KEY          API key (required)
  API_FOOTBALL_PER_MINUTE   Rate limit per minute (default: 280)
  API_FOOTBALL_DAILY_LIMIT  Daily request limit (default: 7500)
`);
      break;
  }
}

function createOrchestrator(): Orchestrator {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    console.error('Missing API_FOOTBALL_KEY in .env');
    process.exit(1);
  }

  const perMinute = parseInt(process.env.API_FOOTBALL_PER_MINUTE || '280');
  const dailyLimit = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT || '7500');
  const api = new ApiFootballClient(apiKey, perMinute, dailyLimit);
  return new Orchestrator(api, prisma);
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
