import type { PrismaClient } from '@prisma/client';
import type { LineupEntry } from './ports';
import { fetchTeamPowerLossData, fetchPlayerWeightData, fetchActiveInjuryData, fetchTeamPerformanceDeltasData } from './data-access';
import { computePlayerWeights, computePlayerWeightsPure, PlayerWeight } from './player-weight';
import { computeTeamPerformanceDeltas, computeTeamPerformanceDeltasPure, PerformanceDeltaSummary, MatchAggregates } from './performance-delta';
import { resolveActiveInjuries, resolveActiveInjuriesPure, ActiveInjury } from './utils/injury-resolver';

// ── Starter Profile ─────────────────────────────────────────
export type StarterRole = 'regular_starter' | 'rotation' | 'bench';

export interface StarterProfile {
  starterCount: number;
  substituteCount: number;
  totalTeamFixtures: number;
  starterFrequency: number;
  role: StarterRole;
  lastStartFixtureDate: Date | null;
  lastAppearanceFixtureDate: Date | null;
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
  if (lineups === 0) {
    return {
      type: 'pre_season_absence',
      timingMultiplier: TIMING_MULTIPLIERS.pre_season_absence,
      description: 'No appearances this season — weight based on historical data',
    };
  }

  const fixtureRatio = lineups / Math.max(totalTeamFixtures, 1);
  if (fixtureRatio < 0.25 && lineups <= 5) {
    return {
      type: 'early_season_loss',
      timingMultiplier: TIMING_MULTIPLIERS.early_season_loss,
      description: 'Injured early in the season after few appearances',
    };
  }

  const fixturesSinceLastStart = totalTeamFixtures - starterProfile.starterCount - starterProfile.substituteCount;
  if (fixturesSinceLastStart <= 4) {
    return {
      type: 'recent_injury',
      timingMultiplier: TIMING_MULTIPLIERS.recent_injury,
      description: 'Recently injured — missed 4 or fewer matches',
    };
  }

  if (starterProfile.starterCount >= 3) {
    return {
      type: 'extended_absence',
      timingMultiplier: TIMING_MULTIPLIERS.extended_absence,
      description: 'Extended absence after period of regular activity',
    };
  }

  return {
    type: 'mid_season_loss',
    timingMultiplier: TIMING_MULTIPLIERS.mid_season_loss,
    description: 'Lost during mid-season while contributing significantly',
  };
}

// ── Severity ────────────────────────────────────────────────
export type Severity = 'critical' | 'high' | 'moderate' | 'low';

function classifySeverity(score: number, role: StarterRole, starterCount: number): Severity {
  if (score >= 0.70) return 'critical';
  if (score >= 0.50) return 'high';
  if (score >= 0.30) return 'moderate';
  if (role === 'regular_starter') return 'moderate';
  if (role === 'rotation' && starterCount >= 10) return 'moderate';
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
  injuryLeagueId: number;
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

// ── Pure function ───────────────────────────────────────────

/**
 * Pure version: compute team power loss from pre-computed data.
 * No DB dependency — testable with mock data.
 */
export function computeTeamPowerLossPure(
  teamId: number,
  teamName: string,
  season: number,
  weights: PlayerWeight[],
  activeInjuries: Map<number, ActiveInjury>,
  teamFixtures: number,
  lineupData: LineupEntry[],
  perfDeltas: Map<number, PerformanceDeltaSummary>,
): EnrichedTeamPowerLoss | null {
  if (weights.length === 0) return null;

  const totalWeight = weights.reduce((sum, pw) => sum + pw.weight, 0);

  const latestTeamInjuryDate = activeInjuries.size > 0
    ? new Date(Math.max(...[...activeInjuries.values()].map(i => i.fixtureDate.getTime())))
    : new Date(0);

  const weightMap = new Map(weights.map(w => [w.playerId, w]));
  const injuredPlayerIds = [...activeInjuries.keys()].filter(id => weightMap.has(id));

  // ── Starter profiles ───────────────────────
  const starterProfiles = new Map<number, StarterProfile>();
  for (const pid of injuredPlayerIds) {
    const entries = lineupData.filter(e => e.playerId === pid);
    const starters = entries.filter(e => e.isStarting);
    const subs = entries.filter(e => !e.isStarting);
    const lastStartEntry = starters[0]; // already ordered desc

    const starterCount = starters.length;
    const substituteCount = subs.length;
    const freq = teamFixtures > 0 ? starterCount / teamFixtures : 0;

    const lastAppearanceEntry = entries[0];
    starterProfiles.set(pid, {
      starterCount,
      substituteCount,
      totalTeamFixtures: teamFixtures,
      starterFrequency: round(freq),
      role: classifyStarterRole(freq),
      lastStartFixtureDate: lastStartEntry ? lastStartEntry.fixtureDate : null,
      lastAppearanceFixtureDate: lastAppearanceEntry ? lastAppearanceEntry.fixtureDate : null,
    });
  }

  // Remove transferred/stale players
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 24 * 60 * 60 * 1000);
  const activeInjuredPlayerIds = injuredPlayerIds.filter(pid => {
    const sp = starterProfiles.get(pid);
    if (!sp) return false;
    if (sp.starterCount + sp.substituteCount > 0) return true;
    const injury = activeInjuries.get(pid);
    return injury ? injury.fixtureDate >= ninetyDaysAgo : false;
  });

  // ── Build results ─────────────────────────
  let injuredWeight = 0;
  const injuredPlayers: InjuredPlayer[] = [];
  const enrichedInjuredPlayers: EnrichedInjuredPlayer[] = [];

  for (const pid of activeInjuredPlayerIds) {
    const pw = weightMap.get(pid)!;
    const injury = activeInjuries.get(pid)!;
    const starter = starterProfiles.get(pid)!;
    const perf = perfDeltas.get(pid);

    const currentSeasonLineups = starter.starterCount + starter.substituteCount;
    const injCtx = classifyInjuryContext(starter, currentSeasonLineups, teamFixtures);

    const compositeImpactScore = clamp(
      pw.weight * injCtx.timingMultiplier * STARTER_ROLE_MULTIPLIER[starter.role],
      0, 1,
    );

    injuredWeight += pw.weight;
    const weightPct = totalWeight > 0 ? round((pw.weight / totalWeight) * 100) : 0;

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
      injuryLeagueId: injury.leagueId,
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
      severity: classifySeverity(compositeImpactScore, starter.role, starter.starterCount),
    });
  }

  enrichedInjuredPlayers.sort((a, b) => b.compositeImpactScore - a.compositeImpactScore);
  injuredPlayers.sort((a, b) => b.weight - a.weight);

  const injuredIds = new Set(activeInjuredPlayerIds);
  const healthyTopPlayers = weights.filter(w => !injuredIds.has(w.playerId)).slice(0, 5);

  const compositeImpactTotal = round(
    enrichedInjuredPlayers.reduce((sum, p) => sum + p.compositeImpactScore, 0),
  );

  return {
    teamId,
    teamName,
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

// ── Legacy wrapper (backward-compatible) ─────────────────

/**
 * @deprecated Use computeTeamPowerLossPure with pre-fetched data
 */
export async function computeTeamPowerLoss(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
  injuryLeagueId?: number | null,
): Promise<EnrichedTeamPowerLoss | null> {
  // Fetch weights
  const weights = await computePlayerWeights(prisma, teamId, seasonIds, seasonYears);
  if (weights.length === 0) return null;

  // Fetch active injuries
  const activeInjuries = await resolveActiveInjuries(prisma, teamId, season, injuryLeagueId);

  // Determine injured player IDs that exist in weights
  const weightMap = new Map(weights.map(w => [w.playerId, w]));
  const injuredPlayerIds = [...activeInjuries.keys()].filter(id => weightMap.has(id));

  // Fetch additional data
  const extraData = await fetchTeamPowerLossData(prisma, teamId, season, injuredPlayerIds);
  if (!extraData) return null;

  // Fetch performance deltas
  // Need to compute activeInjuredPlayerIds first (stale filter)
  // For legacy wrapper, let pure function handle the stale filter internally
  const perfDeltas = await computeTeamPerformanceDeltas(prisma, teamId, season, injuredPlayerIds);

  return computeTeamPowerLossPure(
    teamId,
    extraData.teamName,
    season,
    weights,
    activeInjuries,
    extraData.teamFixtures,
    extraData.lineupData,
    perfDeltas,
  );
}

// ── Utilities ───────────────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
