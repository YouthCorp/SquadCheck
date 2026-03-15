import { PrismaClient } from '@prisma/client';
import { computePlayerWeights, PlayerWeight } from './player-weight';
import { computeTeamPerformanceDeltas, PerformanceDeltaSummary, MatchAggregates } from './performance-delta';

// ── Starter Profile ─────────────────────────────────────────
export type StarterRole = 'regular_starter' | 'rotation' | 'bench';

export interface StarterProfile {
  starterCount: number;
  substituteCount: number;
  totalTeamFixtures: number;
  starterFrequency: number;
  role: StarterRole;
  lastStartFixtureDate: Date | null;
}

function classifyStarterRole(frequency: number): StarterRole {
  if (frequency >= 0.60) return 'regular_starter';
  if (frequency >= 0.30) return 'rotation';
  return 'bench';
}

const STARTER_ROLE_MULTIPLIER: Record<StarterRole, number> = {
  regular_starter: 1.0,
  rotation: 0.70,
  bench: 0.40,
};

// ── Injury Context ──────────────────────────────────────────
export type InjuryContextType =
  | 'mid_season_loss'
  | 'extended_absence'
  | 'recent_injury'
  | 'early_season_loss'
  | 'pre_season_absence';

export interface InjuryContext {
  type: InjuryContextType;
  timingMultiplier: number;
  description: string;
}

const TIMING_MULTIPLIERS: Record<InjuryContextType, number> = {
  mid_season_loss: 1.0,
  extended_absence: 0.90,
  recent_injury: 0.80,
  early_season_loss: 0.75,
  pre_season_absence: 0.60,
};

function classifyInjuryContext(
  starterProfile: StarterProfile,
  lineups: number,
  totalTeamFixtures: number,
): InjuryContext {
  // Pre-season absence: 0 lineups this season
  if (lineups === 0) {
    return {
      type: 'pre_season_absence',
      timingMultiplier: TIMING_MULTIPLIERS.pre_season_absence,
      description: 'No appearances this season — weight based on historical data',
    };
  }

  // Early season loss: appeared in <25% of team fixtures
  const fixtureRatio = lineups / Math.max(totalTeamFixtures, 1);
  if (fixtureRatio < 0.25 && lineups <= 5) {
    return {
      type: 'early_season_loss',
      timingMultiplier: TIMING_MULTIPLIERS.early_season_loss,
      description: 'Injured early in the season after few appearances',
    };
  }

  // Recent injury: missed 4 or fewer fixtures since last start
  const fixturesSinceLastStart = totalTeamFixtures - starterProfile.starterCount - starterProfile.substituteCount;
  if (fixturesSinceLastStart <= 4) {
    return {
      type: 'recent_injury',
      timingMultiplier: TIMING_MULTIPLIERS.recent_injury,
      description: 'Recently injured — missed 4 or fewer matches',
    };
  }

  // Extended absence: was active but out for a long stretch
  if (starterProfile.starterCount >= 3) {
    return {
      type: 'extended_absence',
      timingMultiplier: TIMING_MULTIPLIERS.extended_absence,
      description: 'Extended absence after period of regular activity',
    };
  }

  // Mid-season loss (default for active starters who got injured)
  return {
    type: 'mid_season_loss',
    timingMultiplier: TIMING_MULTIPLIERS.mid_season_loss,
    description: 'Lost during mid-season while contributing significantly',
  };
}

// ── Severity ────────────────────────────────────────────────
export type Severity = 'critical' | 'high' | 'moderate' | 'low';

function classifySeverity(score: number): Severity {
  if (score >= 0.70) return 'critical';
  if (score >= 0.50) return 'high';
  if (score >= 0.30) return 'moderate';
  return 'low';
}

// ── Enriched Injured Player ─────────────────────────────────
export interface InjuredPlayer {
  playerId: number;
  playerName: string;
  position: string | null;
  weight: number;
  weightPct: number;
  injuryType: string;
  injuryReason: string;
  injuryDate: Date;
}

export interface EnrichedInjuredPlayer extends InjuredPlayer {
  positionGroup: PlayerWeight['positionGroup'];
  dataSource: PlayerWeight['dataSource'];
  starterProfile: StarterProfile;
  injuryContext: InjuryContext;
  performanceDelta: PerformanceDeltaSummary['delta'] | null;
  withPlayer: MatchAggregates | null;
  withoutPlayer: MatchAggregates | null;
  hasSignificantSample: boolean;
  winRateBoost: number;
  compositeImpactScore: number;
  severity: Severity;
}

// ── Team Power Loss (enriched) ──────────────────────────────
export interface TeamPowerLoss {
  teamId: number;
  teamName: string;
  season: number;
  totalWeight: number;
  injuredWeight: number;
  powerLossPct: number;
  injuredPlayers: InjuredPlayer[];
  healthyTopPlayers: PlayerWeight[];
}

export interface EnrichedTeamPowerLoss extends TeamPowerLoss {
  compositeImpactTotal: number;
  enrichedInjuredPlayers: EnrichedInjuredPlayer[];
}

// ── Main function ───────────────────────────────────────────
export async function computeTeamPowerLoss(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
  injuryLeagueId?: number | null,
): Promise<EnrichedTeamPowerLoss | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const weights = await computePlayerWeights(prisma, teamId, seasonIds, seasonYears);
  if (weights.length === 0) return null;

  const totalWeight = weights.reduce((sum, pw) => sum + pw.weight, 0);

  // Get current injuries (latest per player)
  const injuries = await prisma.injury.findMany({
    where: { teamId, season, ...(injuryLeagueId ? { leagueId: injuryLeagueId } : {}) },
    orderBy: { fixtureDate: 'desc' },
  });

  const latestInjuryByPlayer = new Map<number, typeof injuries[0]>();
  for (const inj of injuries) {
    if (!latestInjuryByPlayer.has(inj.playerId)) {
      latestInjuryByPlayer.set(inj.playerId, inj);
    }
  }

  // ── Remove already-served absences ────────────────────────
  // A player's absence is considered served when BOTH hold:
  //   1. Their latest injury fixture is already completed (FT/AET/PEN), AND
  //   2. Newer injury data exists for the team — if the player were still out
  //      they would appear in that newer data too.
  // This prevents false removal when no newer injury report has been ingested
  // yet (e.g. all records are FT because the upcoming fixture's report isn't
  // available yet — as is typical between match days).
  const latestTeamInjuryDate = injuries.length > 0 ? injuries[0].fixtureDate : new Date(0);
  {
    const completedFixtureIds = new Set<number>();
    const fixtureStatuses = await prisma.fixture.findMany({
      where: {
        id: { in: [...latestInjuryByPlayer.values()].map(i => i.fixtureId) },
        status: { in: ['FT', 'AET', 'PEN'] },
      },
      select: { id: true },
    });
    for (const f of fixtureStatuses) completedFixtureIds.add(f.id);
    for (const [playerId, injury] of latestInjuryByPlayer) {
      const r = injury.reason.toLowerCase();
      const isDisciplinary =
        r.includes('red card') ||
        r === 'suspended' ||
        r === 'suspension' ||
        r.includes('yellow card');
      if (
        isDisciplinary &&
        injury.fixtureDate < latestTeamInjuryDate &&
        completedFixtureIds.has(injury.fixtureId)
      ) {
        latestInjuryByPlayer.delete(playerId);
      }
    }
  }

  // ── Filter out recovered players ──────────────────────────
  // If a player appeared in a lineup AFTER their last injury date, they've recovered
  const candidatePlayerIds = [...latestInjuryByPlayer.keys()];
  if (candidatePlayerIds.length > 0) {
    const postInjuryAppearances = await prisma.fixtureLineupPlayer.findMany({
      where: {
        playerId: { in: candidatePlayerIds },
        lineup: {
          teamId,
          fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } },
        },
      },
      select: {
        playerId: true,
        lineup: { select: { fixture: { select: { date: true } } } },
      },
    });

    // Build player → latest appearance date
    const latestAppearance = new Map<number, Date>();
    for (const entry of postInjuryAppearances) {
      const date = entry.lineup.fixture.date;
      const prev = latestAppearance.get(entry.playerId);
      if (!prev || date > prev) {
        latestAppearance.set(entry.playerId, date);
      }
    }

    // Remove players who appeared after their last injury
    for (const [playerId, injury] of latestInjuryByPlayer) {
      const lastPlayed = latestAppearance.get(playerId);
      if (lastPlayed && lastPlayed > injury.fixtureDate) {
        latestInjuryByPlayer.delete(playerId);
      }
    }
  }

  const weightMap = new Map(weights.map((w) => [w.playerId, w]));
  const injuredPlayerIds = [...latestInjuryByPlayer.keys()].filter(id => weightMap.has(id));

  // ── Starter profiles (single query) ───────────────────────
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
      lineup: {
        teamId,
        fixture: { season },
      },
    },
    select: {
      playerId: true,
      isStarting: true,
      lineup: { select: { fixture: { select: { date: true } } } },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

  const starterProfiles = new Map<number, StarterProfile>();
  for (const pid of injuredPlayerIds) {
    const entries = lineupData.filter(e => e.playerId === pid);
    const starters = entries.filter(e => e.isStarting);
    const subs = entries.filter(e => !e.isStarting);
    const lastStartEntry = starters[0]; // already ordered desc

    const starterCount = starters.length;
    const substituteCount = subs.length;
    const freq = teamFixtures > 0 ? starterCount / teamFixtures : 0;

    starterProfiles.set(pid, {
      starterCount,
      substituteCount,
      totalTeamFixtures: teamFixtures,
      starterFrequency: round(freq),
      role: classifyStarterRole(freq),
      lastStartFixtureDate: lastStartEntry ? lastStartEntry.lineup.fixture.date : null,
    });
  }

  // Remove players who are no longer at this club.
  // Players with appearances are clearly still registered.
  // Players with 0 appearances but a recent injury record (≤90 days old) are
  // long-term injured but still registered (e.g. injured before season start).
  // Players with 0 appearances AND a stale injury record (>90 days old) have
  // likely transferred away — their early-season injury records are residual.
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 24 * 60 * 60 * 1000);
  const activeInjuredPlayerIds = injuredPlayerIds.filter(pid => {
    const sp = starterProfiles.get(pid);
    if (!sp) return false;
    if (sp.starterCount + sp.substituteCount > 0) return true;
    const injury = latestInjuryByPlayer.get(pid);
    return injury ? injury.fixtureDate >= ninetyDaysAgo : false;
  });

  // ── Performance deltas (batch) ────────────────────────────
  const perfDeltas = await computeTeamPerformanceDeltas(prisma, teamId, season, activeInjuredPlayerIds);

  // ── Build results ─────────────────────────────────────────
  let injuredWeight = 0;
  const injuredPlayers: InjuredPlayer[] = [];
  const enrichedInjuredPlayers: EnrichedInjuredPlayer[] = [];

  for (const pid of activeInjuredPlayerIds) {
    const pw = weightMap.get(pid)!;
    const injury = latestInjuryByPlayer.get(pid)!;
    const starter = starterProfiles.get(pid)!;
    const perf = perfDeltas.get(pid);

    // Current season lineups from PlayerWeight dataSource
    const currentSeasonLineups = pw.dataSource === 'current' || pw.dataSource === 'blended'
      ? starter.starterCount + starter.substituteCount
      : 0;

    const injCtx = classifyInjuryContext(starter, currentSeasonLineups, teamFixtures);

    // Composite impact score (weight × timing × role — no raw delta noise)
    const compositeImpactScore = clamp(
      pw.weight * injCtx.timingMultiplier * STARTER_ROLE_MULTIPLIER[starter.role],
      0, 1,
    );

    injuredWeight += pw.weight;
    const weightPct = totalWeight > 0 ? round((pw.weight / totalWeight) * 100) : 0;

    // Win rate boost: estimated win rate improvement if this player returns.
    // Based on player's weight share (quality) × starter frequency (tactical importance).
    // Only computed for players who have actually appeared this season.
    const hasAppearances = starter.starterCount + starter.substituteCount > 0;
    const winRateBoost = hasAppearances
      ? round(weightPct * starter.starterFrequency * 1.5, 2)
      : 0;

    const basePlayer: InjuredPlayer = {
      playerId: pid,
      playerName: pw.playerName,
      position: pw.position,
      weight: pw.weight,
      weightPct,
      injuryType: injury.type,
      injuryReason: injury.reason,
      injuryDate: injury.fixtureDate,
    };

    injuredPlayers.push(basePlayer);

    enrichedInjuredPlayers.push({
      ...basePlayer,
      positionGroup: pw.positionGroup,
      dataSource: pw.dataSource,
      starterProfile: starter,
      injuryContext: injCtx,
      performanceDelta: perf ? perf.delta : null,
      withPlayer: perf?.withPlayer ?? null,
      withoutPlayer: perf?.withoutPlayer ?? null,
      hasSignificantSample: perf?.hasSignificantSample ?? false,
      winRateBoost,
      compositeImpactScore: round(compositeImpactScore),
      severity: classifySeverity(compositeImpactScore),
    });
  }

  enrichedInjuredPlayers.sort((a, b) => b.compositeImpactScore - a.compositeImpactScore);
  injuredPlayers.sort((a, b) => b.weight - a.weight);

  const injuredIds = new Set(activeInjuredPlayerIds);
  const healthyTopPlayers = weights.filter((w) => !injuredIds.has(w.playerId)).slice(0, 5);

  const compositeImpactTotal = round(
    enrichedInjuredPlayers.reduce((sum, p) => sum + p.compositeImpactScore, 0),
  );

  return {
    teamId,
    teamName: team.name,
    season,
    totalWeight: round(totalWeight),
    injuredWeight: round(injuredWeight),
    powerLossPct: totalWeight > 0 ? round((injuredWeight / totalWeight) * 100) : 0,
    injuredPlayers,
    healthyTopPlayers,
    compositeImpactTotal,
    enrichedInjuredPlayers,
  };
}

// ── Utilities ───────────────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
