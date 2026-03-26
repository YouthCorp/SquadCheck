// packages/analysis/src/data-access.ts
//
// All Prisma queries for the analysis package are concentrated here.
// This is the ONLY file with a runtime @prisma/client dependency.

import { PrismaClient, Prisma } from '@prisma/client';
import { buildExclusionFilter } from '@squadcheck/database';
import type {
  PlayerWeightInput,
  PerformanceDeltaInput,
  TeamPerformanceDeltasInput,
  ActiveInjuryInput,
  AbsenceTransitionInput,
  InjuryImpactInput,
  LineupEntry,
  AvailabilityRecord,
  DeploymentEntry,
  RecentFormationEntry,
} from './ports';

// ── Re-export Prisma-specific constants ──────────────────

/** Prisma where-clause filter for non-injury absences (disciplinary, loan, etc.) */
export const NON_INJURY_EXCLUSION_FILTER: Prisma.InjuryWhereInput = buildExclusionFilter();

// ── Fetch: Player Weights ────────────────────────────────

export async function fetchPlayerWeightData(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
): Promise<PlayerWeightInput> {
  const allStats = await prisma.playerSeasonStats.findMany({
    where: { teamId, seasonId: { in: seasonIds } },
    include: { player: { select: { id: true, name: true, position: true } } },
  });

  return {
    allStats: allStats.map(ps => ({
      playerId: ps.playerId,
      seasonId: ps.seasonId,
      playerName: ps.player.name,
      playerPosition: ps.player.position,
      lineups: ps.lineups || 0,
      minutes: ps.minutes,
      rating: ps.rating,
      appearances: ps.appearances,
      goalsTotal: ps.goalsTotal,
      assists: ps.assists,
      passesKey: ps.passesKey,
      tacklesTotal: ps.tacklesTotal,
      interceptions: ps.interceptions,
      duelsTotal: ps.duelsTotal,
      duelsWon: ps.duelsWon,
      dribblesAttempts: ps.dribblesAttempts,
      dribblesSuccess: ps.dribblesSuccess,
      shotsTotal: ps.shotsTotal,
    })),
    seasonIds,
  };
}

// ── Fetch: Performance Delta ─────────────────────────────

export async function fetchPerformanceDeltaData(
  prisma: PrismaClient,
  teamId: number,
  playerId: number,
  season: number,
): Promise<PerformanceDeltaInput | null> {
  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ]);
  if (!team || !player) return null;

  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
    include: { statistics: { where: { teamId } } },
    orderBy: { date: 'asc' },
  });

  const lineupFixtures = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId,
      isStarting: true,
      lineup: { teamId, fixture: { season } },
    },
    select: { lineup: { select: { fixtureId: true } } },
  });

  return {
    teamId,
    teamName: team.name,
    season,
    playerId,
    playerName: player.name,
    fixtures: fixtures.map(f => ({
      id: f.id,
      homeTeamId: f.homeTeamId,
      goalsHome: f.goalsHome,
      goalsAway: f.goalsAway,
      date: f.date,
      statistics: f.statistics.map(s => ({
        possession: s.possession,
        expectedGoals: s.expectedGoals,
      })),
    })),
    startedFixtureIds: new Set(lineupFixtures.map(lf => lf.lineup.fixtureId)),
  };
}

export async function fetchTeamPerformanceDeltasData(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  playerIds: number[],
): Promise<TeamPerformanceDeltasInput> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
    include: { statistics: { where: { teamId } } },
    orderBy: { date: 'asc' },
  });

  const fixtureIds = fixtures.map(f => f.id);
  const lineupEntries = fixtureIds.length > 0
    ? await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: playerIds },
          isStarting: true,
          lineup: { teamId, fixtureId: { in: fixtureIds } },
        },
        select: { playerId: true, lineup: { select: { fixtureId: true } } },
      })
    : [];

  return {
    teamId,
    fixtures: fixtures.map(f => ({
      id: f.id,
      homeTeamId: f.homeTeamId,
      goalsHome: f.goalsHome,
      goalsAway: f.goalsAway,
      date: f.date,
      statistics: f.statistics.map(s => ({
        possession: s.possession,
        expectedGoals: s.expectedGoals,
      })),
    })),
    lineupEntries: lineupEntries.map(e => ({
      playerId: e.playerId,
      fixtureId: e.lineup.fixtureId,
    })),
    playerIds,
  };
}

// ── Fetch: Active Injuries ───────────────────────────────

export async function fetchActiveInjuryData(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<ActiveInjuryInput> {
  // Step 1: All injuries for team+season
  const injuries = await prisma.injury.findMany({
    where: { teamId, season },
    orderBy: { fixtureDate: 'desc' },
    select: {
      playerId: true,
      teamId: true,
      leagueId: true,
      fixtureId: true,
      fixtureDate: true,
      type: true,
      reason: true,
    },
  });

  if (injuries.length === 0) {
    return { injuries: [], fixtureInfoMap: new Map(), appearances: [] };
  }

  // Collect all unique fixture IDs from injuries
  const injuryFixtureIds = [...new Set(injuries.map(i => i.fixtureId))];

  // All unique player IDs from injuries
  const allPlayerIds = [...new Set(injuries.map(i => i.playerId))];

  // Step 2: Fixture info for all injury-referenced fixtures
  const fixtureInfos = await prisma.fixture.findMany({
    where: { id: { in: injuryFixtureIds } },
    select: { id: true, date: true, status: true },
  });
  const fixtureInfoMap = new Map(
    fixtureInfos.map(f => [f.id, { id: f.id, date: f.date, status: f.status }]),
  );

  // Step 3: All lineup appearances for injury players in team+season
  // Include both completed and non-completed fixtures (pure function filters as needed)
  const rawAppearances = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: allPlayerIds },
      lineup: {
        teamId,
        fixture: { season },
      },
    },
    select: {
      playerId: true,
      lineup: {
        select: {
          fixture: {
            select: { date: true, status: true },
          },
        },
      },
    },
  });

  const COMPLETED_STATUSES = new Set(['FT', 'AET', 'PEN']);
  const appearances = rawAppearances.map(a => ({
    playerId: a.playerId,
    fixtureDate: a.lineup.fixture.date,
    fixtureCompleted: COMPLETED_STATUSES.has(a.lineup.fixture.status),
  }));

  return { injuries, fixtureInfoMap, appearances };
}

// ── Fetch: Absence Transitions ───────────────────────────

export async function fetchAbsenceTransitionData(
  prisma: PrismaClient,
  season: number,
  leagueApiIds: number[],
  options: { cutoffDays?: number; minResults?: number; limit?: number } = {},
): Promise<AbsenceTransitionInput> {
  const ONE_DAY_MS = 86_400_000;
  const now = new Date();

  // Step 1: Candidate player IDs
  const candidateGroups = await prisma.injury.groupBy({
    by: ['playerId'],
    where: {
      season,
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
  });
  const candidatePlayerIds = candidateGroups.map(g => g.playerId);

  if (candidatePlayerIds.length === 0) {
    return {
      candidatePlayerIds: [],
      lineupAppearances: [],
      candidateInjuries: [],
      firstTeamPlayerIds: new Set(),
      fullRecords: [],
    };
  }

  // Step 2: Lineup appearances
  const lineupAppearances = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: candidatePlayerIds },
      lineup: { fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } } },
    },
    select: {
      playerId: true,
      lineup: { select: { fixture: { select: { id: true, date: true } } } },
    },
  });

  // Step 3: Individual injury records
  const candidateInjuries = await prisma.injury.findMany({
    where: {
      season,
      playerId: { in: candidatePlayerIds },
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
    orderBy: { fixtureDate: 'asc' },
    select: { playerId: true, fixtureDate: true, fixtureId: true },
  });

  // Step 4: Quality filter — will be applied after pure function computes absences
  // For now, fetch all player season stats for candidate players
  const firstTeamStats = await prisma.playerSeasonStats.findMany({
    where: {
      playerId: { in: candidatePlayerIds },
      season: { year: season },
      leagueApiId: { in: leagueApiIds },
      OR: [
        { lineups: { gte: 5 }, rating: { gte: 6.8 } },
        { lineups: { gte: 8 } },
      ],
    },
    select: { playerId: true },
  });
  const firstTeamPlayerIds = new Set(firstTeamStats.map(s => s.playerId));

  // Step 5: Full records with includes
  const fullRecords = await prisma.injury.findMany({
    where: {
      season,
      playerId: { in: candidatePlayerIds },
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
    orderBy: { fixtureDate: 'asc' },
    include: {
      player: { select: { id: true, name: true, photo: true, position: true } },
      team: { select: { id: true, name: true, logo: true } },
      league: { select: { id: true, name: true, logo: true, apiFootballId: true } },
    },
  });

  return {
    candidatePlayerIds,
    lineupAppearances: lineupAppearances.map(a => ({
      playerId: a.playerId,
      fixtureId: a.lineup.fixture.id,
      fixtureDate: a.lineup.fixture.date,
    })),
    candidateInjuries,
    firstTeamPlayerIds,
    fullRecords: fullRecords as AbsenceTransitionInput['fullRecords'],
  };
}

// ── Fetch: Injury Impact ─────────────────────────────────

export async function fetchInjuryImpactData(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  injuryLeagueId?: number | null,
): Promise<InjuryImpactInput | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const injuries = await prisma.injury.findMany({
    where: { teamId, season, ...(injuryLeagueId ? { leagueId: injuryLeagueId } : {}) },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { fixtureDate: 'asc' },
  });

  return {
    teamId,
    teamName: team.name,
    season,
    injuries: injuries.map(inj => ({
      playerId: inj.playerId,
      playerName: inj.player.name,
      type: inj.type,
      reason: inj.reason,
      fixtureDate: inj.fixtureDate,
    })),
  };
}

// ── Fetch: Recovery Signals ──────────────────────────────

export async function fetchRecoverySignalData(
  prisma: PrismaClient,
  injuredIds: Set<number>,
  upcomingFixtureId: number | null,
): Promise<AvailabilityRecord[]> {
  if (!upcomingFixtureId || injuredIds.size === 0) return [];

  const { AVAILABILITY_THRESHOLD, CONFIDENCE_THRESHOLD } = await import('@squadcheck/database');

  const availabilities = await prisma.playerAvailability.findMany({
    where: {
      playerId: { in: [...injuredIds] },
      fixtureId: upcomingFixtureId,
      expired: false,
      predictedAvailability: { gte: AVAILABILITY_THRESHOLD },
      confidenceLevel: { gte: CONFIDENCE_THRESHOLD },
    },
  });

  return availabilities.map(a => ({
    playerId: a.playerId,
    predictedAvailability: a.predictedAvailability,
    latestSignalStage: a.latestSignalStage,
    lastSignalAt: a.lastSignalAt,
    confidenceLevel: a.confidenceLevel,
    fixtureId: a.fixtureId,
  }));
}

// ── Fetch: Upcoming Fixture ──────────────────────────────

export async function fetchUpcomingFixtureId(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<number | null> {
  const fixture = await prisma.fixture.findFirst({
    where: {
      season,
      status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD'] },
      date: { gte: new Date() },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { date: 'asc' },
    select: { id: true },
  });
  return fixture?.id ?? null;
}

// ── Fetch: Team Power Loss (additional data) ─────────────

export async function fetchTeamPowerLossData(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  injuredPlayerIds: number[],
): Promise<{ teamName: string; teamFixtures: number; lineupData: LineupEntry[] } | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const teamFixtures = await prisma.fixture.count({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
  });

  const lineupData = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: injuredPlayerIds },
      lineup: { teamId, fixture: { season } },
    },
    select: {
      playerId: true,
      isStarting: true,
      lineup: { select: { fixture: { select: { date: true } } } },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

  return {
    teamName: team.name,
    teamFixtures,
    lineupData: lineupData.map(e => ({
      playerId: e.playerId,
      isStarting: e.isStarting,
      fixtureDate: e.lineup.fixture.date,
    })),
  };
}

// ── Fetch: Predicted Lineup (additional data) ────────────

export async function fetchPredictedLineupData(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  allPlayerIds: number[],
): Promise<{
  teamName: string;
  teamLogo: string | null;
  teamFixtures: number;
  lineupData: LineupEntry[];
  deploymentEntries: DeploymentEntry[];
  recentFormations: RecentFormationEntry[];
} | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const teamFixtures = await prisma.fixture.count({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
  });

  const lineupData = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: allPlayerIds },
      lineup: { teamId, fixture: { season } },
    },
    select: {
      playerId: true,
      isStarting: true,
      lineup: { select: { fixture: { select: { date: true } } } },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

  const deploymentData = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: allPlayerIds },
      isStarting: true,
      lineup: {
        teamId,
        fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } },
      },
    },
    select: {
      playerId: true,
      grid: true,
      lineup: {
        select: {
          formation: true,
          fixture: { select: { date: true } },
        },
      },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

  const recentLineups = await prisma.fixtureLineup.findMany({
    where: {
      teamId,
      fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } },
    },
    select: {
      formation: true,
      fixture: { select: { date: true } },
    },
    orderBy: { fixture: { date: 'desc' } },
    take: 10,
  });

  return {
    teamName: team.name,
    teamLogo: team.logo,
    teamFixtures,
    lineupData: lineupData.map(e => ({
      playerId: e.playerId,
      isStarting: e.isStarting,
      fixtureDate: e.lineup.fixture.date,
    })),
    deploymentEntries: deploymentData.map(e => ({
      playerId: e.playerId,
      grid: e.grid,
      formation: e.lineup.formation,
      fixtureDate: e.lineup.fixture.date,
    })),
    recentFormations: recentLineups.map(lu => ({
      formation: lu.formation,
      fixtureDate: lu.fixture.date,
    })),
  };
}

export async function fetchPlayerPhotos(
  prisma: PrismaClient,
  playerIds: number[],
): Promise<Map<number, string | null>> {
  const records = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, photo: true },
  });
  return new Map(records.map(p => [p.id, p.photo]));
}

// ── Fetch: Season Resolver ───────────────────────────────

export async function fetchSeasonChainData(
  prisma: PrismaClient,
  leagueId: number,
  currentYear: number,
  lookback = 2,
): Promise<{ ids: number[]; years: number[] }> {
  const years = Array.from({ length: lookback + 1 }, (_, i) => currentYear - i);
  const seasons = await prisma.season.findMany({
    where: { leagueId, year: { in: years } },
    orderBy: { year: 'desc' },
  });

  const ids: number[] = [];
  const foundYears: number[] = [];
  for (const y of years) {
    const s = seasons.find(s => s.year === y);
    if (s) {
      ids.push(s.id);
      foundYears.push(s.year);
    }
  }
  return { ids, years: foundYears };
}

export async function fetchTeamLeagueId(
  prisma: PrismaClient,
  teamId: number,
): Promise<number | null> {
  const statsEntry = await prisma.playerSeasonStats.findFirst({
    where: { teamId },
    select: { season: { select: { leagueId: true } } },
    orderBy: { seasonId: 'desc' },
  });
  if (statsEntry) return statsEntry.season.leagueId;

  const standingEntry = await prisma.standingEntry.findFirst({
    where: { teamId },
    select: { standing: { select: { leagueId: true } } },
    orderBy: { id: 'desc' },
  });
  return standingEntry?.standing.leagueId ?? null;
}

// ── Fetch: Facade-specific data ──────────────────────────

export async function fetchOutcomeImpactData(
  prisma: PrismaClient,
  teamId: number,
  seasonId: number,
): Promise<{
  teamSeasonStats: { avgXg: number | null; avgXgAgainst: number | null; totalGoals: number | null; totalConceded: number | null } | null;
  standingEntry: { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number } | null;
}> {
  const [teamSeasonStats, standingEntry] = await Promise.all([
    prisma.teamSeasonStats.findUnique({
      where: { teamId_seasonId: { teamId, seasonId } },
      select: { avgXg: true, avgXgAgainst: true, totalGoals: true, totalConceded: true },
    }),
    prisma.standingEntry.findFirst({
      where: { teamId, seasonId },
      select: { played: true, wins: true, draws: true, losses: true, goalsFor: true, goalsAgainst: true },
      orderBy: { rank: 'asc' },
    }),
  ]);
  return { teamSeasonStats, standingEntry };
}
