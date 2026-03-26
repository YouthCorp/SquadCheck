import type { PrismaClient } from '@prisma/client';
import type { PerformanceDeltaInput, TeamPerformanceDeltasInput, FixtureWithStats } from './ports';
import { fetchPerformanceDeltaData, fetchTeamPerformanceDeltasData } from './data-access';

// ── Types ────────────────────────────────────────────────

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

export interface PerformanceDeltaSummary {
  playerId: number;
  withPlayer: MatchAggregates;
  withoutPlayer: MatchAggregates;
  delta: PerformanceDelta['delta'];
  hasSignificantSample: boolean;
}

// ── Pure functions ───────────────────────────────────────

/**
 * Pure version: compute performance delta from pre-fetched data.
 */
export function computePerformanceDeltaPure(data: PerformanceDeltaInput): PerformanceDelta {
  const { teamId, teamName, season, playerId, playerName, fixtures, startedFixtureIds } = data;

  const withMatches: FixtureWithStats[] = [];
  const withoutMatches: FixtureWithStats[] = [];

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
    teamName,
    season,
    playerId,
    playerName,
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

/**
 * Pure version: compute performance deltas for multiple players.
 */
export function computeTeamPerformanceDeltasPure(
  data: TeamPerformanceDeltasInput,
): Map<number, PerformanceDeltaSummary> {
  const { teamId, fixtures, lineupEntries, playerIds } = data;
  if (playerIds.length === 0 || fixtures.length === 0) return new Map();

  // Build player → Set<fixtureId> map
  const playerFixtureMap = new Map<number, Set<number>>();
  for (const pid of playerIds) {
    playerFixtureMap.set(pid, new Set());
  }
  for (const entry of lineupEntries) {
    playerFixtureMap.get(entry.playerId)?.add(entry.fixtureId);
  }

  const results = new Map<number, PerformanceDeltaSummary>();

  for (const pid of playerIds) {
    const startedIds = playerFixtureMap.get(pid)!;
    const withMatches: FixtureWithStats[] = [];
    const withoutMatches: FixtureWithStats[] = [];

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

// ── Legacy wrappers (backward-compatible) ────────────────

/**
 * @deprecated Use computePerformanceDeltaPure with fetchPerformanceDeltaData
 */
export async function computePerformanceDelta(
  prisma: PrismaClient,
  teamId: number,
  playerId: number,
  season: number,
): Promise<PerformanceDelta | null> {
  const data = await fetchPerformanceDeltaData(prisma, teamId, playerId, season);
  if (!data) return null;
  return computePerformanceDeltaPure(data);
}

/**
 * @deprecated Use computeTeamPerformanceDeltasPure with fetchTeamPerformanceDeltasData
 */
export async function computeTeamPerformanceDeltas(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  playerIds: number[],
): Promise<Map<number, PerformanceDeltaSummary>> {
  if (playerIds.length === 0) return new Map();
  const data = await fetchTeamPerformanceDeltasData(prisma, teamId, season, playerIds);
  return computeTeamPerformanceDeltasPure(data);
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
