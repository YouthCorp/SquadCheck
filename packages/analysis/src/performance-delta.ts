import { PrismaClient } from '@prisma/client';

export interface PerformanceDelta {
  teamId: number;
  teamName: string;
  season: number;
  playerId: number;
  playerName: string;
  withPlayer: MatchAggregates;
  withoutPlayer: MatchAggregates;
  delta: {
    winRateDelta: number;
    avgGoalsDelta: number;
    avgConcededDelta: number;
    avgXgDelta: number | null;
    avgPossessionDelta: number | null;
  };
}

export interface MatchAggregates {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  avgGoals: number;
  avgConceded: number;
  avgXg: number | null;
  avgPossession: number | null;
}

export async function computePerformanceDelta(
  prisma: PrismaClient,
  teamId: number,
  playerId: number,
  season: number,
): Promise<PerformanceDelta | null> {
  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ]);
  if (!team || !player) return null;

  // Get all finished fixtures for this team in this season
  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
    include: {
      statistics: { where: { teamId } },
    },
    orderBy: { date: 'asc' },
  });

  // Get fixture IDs where this player was in the lineup (started)
  const lineupFixtures = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId,
      isStarting: true,
      lineup: {
        teamId,
        fixture: { season },
      },
    },
    select: { lineup: { select: { fixtureId: true } } },
  });

  const startedFixtureIds = new Set(lineupFixtures.map((lf) => lf.lineup.fixtureId));

  const withMatches: typeof fixtures = [];
  const withoutMatches: typeof fixtures = [];

  for (const f of fixtures) {
    if (startedFixtureIds.has(f.id)) {
      withMatches.push(f);
    } else {
      withoutMatches.push(f);
    }
  }

  const withAgg = aggregate(withMatches, teamId);
  const withoutAgg = aggregate(withoutMatches, teamId);

  return {
    teamId,
    teamName: team.name,
    season,
    playerId,
    playerName: player.name,
    withPlayer: withAgg,
    withoutPlayer: withoutAgg,
    delta: {
      winRateDelta: round(withAgg.winRate - withoutAgg.winRate),
      avgGoalsDelta: round(withAgg.avgGoals - withoutAgg.avgGoals),
      avgConcededDelta: round(withAgg.avgConceded - withoutAgg.avgConceded),
      avgXgDelta:
        withAgg.avgXg !== null && withoutAgg.avgXg !== null
          ? round(withAgg.avgXg - withoutAgg.avgXg)
          : null,
      avgPossessionDelta:
        withAgg.avgPossession !== null && withoutAgg.avgPossession !== null
          ? round(withAgg.avgPossession - withoutAgg.avgPossession)
          : null,
    },
  };
}

// ── Batch: compute performance deltas for multiple players at once ──
export interface PerformanceDeltaSummary {
  playerId: number;
  withPlayer: MatchAggregates;
  withoutPlayer: MatchAggregates;
  delta: PerformanceDelta['delta'];
  hasSignificantSample: boolean;
}

export async function computeTeamPerformanceDeltas(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  playerIds: number[],
): Promise<Map<number, PerformanceDeltaSummary>> {
  if (playerIds.length === 0) return new Map();

  // Single query: all finished fixtures for this team in this season
  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
    include: {
      statistics: { where: { teamId } },
    },
    orderBy: { date: 'asc' },
  });

  const fixtureIds = fixtures.map(f => f.id);
  if (fixtureIds.length === 0) return new Map();

  // Single query: all lineup entries for requested players in these fixtures
  const lineupEntries = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: playerIds },
      isStarting: true,
      lineup: {
        teamId,
        fixtureId: { in: fixtureIds },
      },
    },
    select: {
      playerId: true,
      lineup: { select: { fixtureId: true } },
    },
  });

  // Build player → Set<fixtureId> map
  const playerFixtureMap = new Map<number, Set<number>>();
  for (const pid of playerIds) {
    playerFixtureMap.set(pid, new Set());
  }
  for (const entry of lineupEntries) {
    playerFixtureMap.get(entry.playerId)?.add(entry.lineup.fixtureId);
  }

  // Compute per-player with/without from in-memory data
  const results = new Map<number, PerformanceDeltaSummary>();

  for (const pid of playerIds) {
    const startedIds = playerFixtureMap.get(pid)!;
    const withMatches: typeof fixtures = [];
    const withoutMatches: typeof fixtures = [];

    for (const f of fixtures) {
      if (startedIds.has(f.id)) {
        withMatches.push(f);
      } else {
        withoutMatches.push(f);
      }
    }

    const withAgg = aggregate(withMatches, teamId);
    const withoutAgg = aggregate(withoutMatches, teamId);
    const hasSignificantSample = withAgg.matches >= 5 && withoutAgg.matches >= 5;

    results.set(pid, {
      playerId: pid,
      withPlayer: withAgg,
      withoutPlayer: withoutAgg,
      delta: {
        winRateDelta: round(withAgg.winRate - withoutAgg.winRate),
        avgGoalsDelta: round(withAgg.avgGoals - withoutAgg.avgGoals),
        avgConcededDelta: round(withAgg.avgConceded - withoutAgg.avgConceded),
        avgXgDelta:
          withAgg.avgXg !== null && withoutAgg.avgXg !== null
            ? round(withAgg.avgXg - withoutAgg.avgXg)
            : null,
        avgPossessionDelta:
          withAgg.avgPossession !== null && withoutAgg.avgPossession !== null
            ? round(withAgg.avgPossession - withoutAgg.avgPossession)
            : null,
      },
      hasSignificantSample,
    });
  }

  return results;
}

// ── Aggregation helper ──────────────────────────────────────
function aggregate(
  fixtures: Array<{
    homeTeamId: number;
    goalsHome: number | null;
    goalsAway: number | null;
    statistics: Array<{ possession: number | null; expectedGoals: number | null }>;
  }>,
  teamId: number,
): MatchAggregates {
  if (fixtures.length === 0) {
    return { matches: 0, wins: 0, draws: 0, losses: 0, winRate: 0, avgGoals: 0, avgConceded: 0, avgXg: null, avgPossession: null };
  }

  let wins = 0, draws = 0, losses = 0;
  let totalGoals = 0, totalConceded = 0;
  const xgs: number[] = [];
  const possessions: number[] = [];

  for (const f of fixtures) {
    const isHome = f.homeTeamId === teamId;
    const scored = isHome ? (f.goalsHome ?? 0) : (f.goalsAway ?? 0);
    const conceded = isHome ? (f.goalsAway ?? 0) : (f.goalsHome ?? 0);

    totalGoals += scored;
    totalConceded += conceded;

    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;

    const stats = f.statistics[0];
    if (stats?.expectedGoals !== null && stats?.expectedGoals !== undefined) xgs.push(stats.expectedGoals);
    if (stats?.possession !== null && stats?.possession !== undefined) possessions.push(stats.possession);
  }

  const n = fixtures.length;
  return {
    matches: n,
    wins,
    draws,
    losses,
    winRate: round((wins / n) * 100),
    avgGoals: round(totalGoals / n),
    avgConceded: round(totalConceded / n),
    avgXg: xgs.length > 0 ? round(xgs.reduce((a, b) => a + b, 0) / xgs.length) : null,
    avgPossession: possessions.length > 0 ? round(possessions.reduce((a, b) => a + b, 0) / possessions.length) : null,
  };
}

function round(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
