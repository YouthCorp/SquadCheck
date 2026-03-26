import type { PrismaClient } from '@prisma/client';
import {
  fetchTeamLeagueId,
  fetchSeasonChainData,
  fetchPlayerWeightData,
  fetchPerformanceDeltaData,
  fetchInjuryImpactData,
  fetchActiveInjuryData,
  fetchTeamPowerLossData,
  fetchTeamPerformanceDeltasData,
  fetchRecoverySignalData,
  fetchUpcomingFixtureId,
  fetchPredictedLineupData,
  fetchPlayerPhotos,
  fetchOutcomeImpactData,
} from './data-access';
import { computePlayerWeightsPure, PlayerWeight } from './player-weight';
import { computeRichInjuryImpactPure, computeInjuryImpactPure, RichInjuryImpact } from './injury-impact';
import { computeTeamPowerLossPure, EnrichedTeamPowerLoss } from './team-power-loss';
import { computePredictedLineupPure, PredictedLineup } from './predicted-lineup';
import { computePerformanceDeltaPure, PerformanceDelta, computeTeamPerformanceDeltasPure } from './performance-delta';
import { resolveActiveInjuriesPure } from './utils/injury-resolver';
import { applyRecoverySignalsPure } from './recovery-signal-integration';
import {
  computeTeamOutcomeImpact,
  TeamOutcomeImpact,
  type TeamSeasonStatsInput,
  type StandingEntryInput,
} from './team-outcome-impact';

// ── Shared return type for season context ─────────────────────
export interface SeasonChain {
  ids: number[];
  years: number[];
}

// ── analyzeTeamPower ─────────────────────────────────────────
export interface TeamPowerResult {
  leagueId: number;
  chain: SeasonChain;
  weights: PlayerWeight[];
}

export async function analyzeTeamPower(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<TeamPowerResult | null> {
  const leagueId = await fetchTeamLeagueId(prisma, teamId);
  if (!leagueId) return null;

  const chain = await fetchSeasonChainData(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const data = await fetchPlayerWeightData(prisma, teamId, chain.ids);
  const weights = computePlayerWeightsPure(data);
  return { leagueId, chain, weights };
}

// ── analyzeInjuryImpact ──────────────────────────────────────
export interface InjuryImpactResult {
  leagueId: number;
  chain: SeasonChain;
  rich: RichInjuryImpact;
  outcomeImpact: TeamOutcomeImpact | null;
}

export async function analyzeInjuryImpact(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  leagueApiId?: number | null,
): Promise<InjuryImpactResult | null> {
  const leagueId = await fetchTeamLeagueId(prisma, teamId);
  if (!leagueId) return null;

  const chain = await fetchSeasonChainData(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  // Injury impact summary (pure)
  const impactData = await fetchInjuryImpactData(prisma, teamId, season, leagueApiId ?? null);
  if (!impactData) return null;
  const base = computeInjuryImpactPure(impactData);

  // Player weights (pure)
  const weightData = await fetchPlayerWeightData(prisma, teamId, chain.ids);
  const weights = computePlayerWeightsPure(weightData);
  if (weights.length === 0) return null;

  // Active injuries (pure)
  const injuryData = await fetchActiveInjuryData(prisma, teamId, season);
  const activeInjuries = resolveActiveInjuriesPure(injuryData, leagueApiId ?? null);

  // Starter profiles + performance deltas for power loss
  const weightMap = new Map(weights.map(w => [w.playerId, w]));
  const injuredPlayerIds = [...activeInjuries.keys()].filter(id => weightMap.has(id));

  const extraData = await fetchTeamPowerLossData(prisma, teamId, season, injuredPlayerIds);
  const perfDeltasData = await fetchTeamPerformanceDeltasData(prisma, teamId, season, injuredPlayerIds);
  const perfDeltas = computeTeamPerformanceDeltasPure(perfDeltasData);

  const powerLoss = extraData
    ? computeTeamPowerLossPure(teamId, extraData.teamName, season, weights, activeInjuries, extraData.teamFixtures, extraData.lineupData, perfDeltas)
    : null;

  const rich = computeRichInjuryImpactPure(base, powerLoss);

  // Outcome impact
  const { teamSeasonStats, standingEntry } = await fetchOutcomeImpactData(prisma, teamId, chain.ids[0]);
  const outcomeImpact = computeTeamOutcomeImpact(
    rich.enrichedInjuredPlayers,
    teamSeasonStats as TeamSeasonStatsInput | null,
    standingEntry as StandingEntryInput | null,
  );

  return { leagueId, chain, rich, outcomeImpact };
}

// ── analyzePredictedLineup ───────────────────────────────────
export interface PredictedLineupResult {
  leagueId: number;
  chain: SeasonChain;
  lineup: PredictedLineup;
}

export async function analyzePredictedLineup(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  leagueApiId?: number | null,
): Promise<PredictedLineupResult | null> {
  const leagueId = await fetchTeamLeagueId(prisma, teamId);
  if (!leagueId) return null;

  const chain = await fetchSeasonChainData(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  // Player weights (pure)
  const weightData = await fetchPlayerWeightData(prisma, teamId, chain.ids);
  const weights = computePlayerWeightsPure(weightData);
  if (weights.length === 0) return null;

  const allPlayerIds = weights.map(w => w.playerId);

  // Layout data
  const layoutData = await fetchPredictedLineupData(prisma, teamId, season, allPlayerIds);
  if (!layoutData) return null;

  // Active injuries (pure)
  const injuryData = await fetchActiveInjuryData(prisma, teamId, season);
  const activeInjuries = resolveActiveInjuriesPure(injuryData, leagueApiId ?? null);
  const injuredIds = new Set(activeInjuries.keys());

  // Recovery signals (pure)
  const upcomingFixtureId = await fetchUpcomingFixtureId(prisma, teamId, season);
  const availabilities = await fetchRecoverySignalData(prisma, injuredIds, upcomingFixtureId);
  const recoverySignalResult = applyRecoverySignalsPure(injuredIds, availabilities);

  // Photos
  const allRelevantIds = [...new Set([...allPlayerIds, ...activeInjuries.keys()])];
  const playerPhotos = await fetchPlayerPhotos(prisma, allRelevantIds);

  const lineup = computePredictedLineupPure(
    teamId,
    layoutData.teamName,
    layoutData.teamLogo,
    season,
    weights,
    layoutData.teamFixtures,
    layoutData.lineupData,
    layoutData.deploymentEntries,
    layoutData.recentFormations,
    activeInjuries,
    recoverySignalResult,
    upcomingFixtureId,
    playerPhotos,
  );
  if (!lineup) return null;

  return { leagueId, chain, lineup };
}

// ── analyzePlayerImpact ──────────────────────────────────────
export interface PlayerImpactResult {
  leagueId: number;
  chain: SeasonChain;
  weights: PlayerWeight[];
  perfDelta: PerformanceDelta | null;
}

export async function analyzePlayerImpact(
  prisma: PrismaClient,
  teamId: number,
  playerId: number,
  season: number,
): Promise<PlayerImpactResult | null> {
  const leagueId = await fetchTeamLeagueId(prisma, teamId);
  if (!leagueId) return null;

  const chain = await fetchSeasonChainData(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const [weightData, perfData] = await Promise.all([
    fetchPlayerWeightData(prisma, teamId, chain.ids),
    fetchPerformanceDeltaData(prisma, teamId, playerId, season),
  ]);

  const weights = computePlayerWeightsPure(weightData);
  const perfDelta = perfData ? computePerformanceDeltaPure(perfData) : null;

  return { leagueId, chain, weights, perfDelta };
}

// ── analyzeTeamImpactReport ──────────────────────────────────
export interface TeamImpactReportResult {
  leagueId: number;
  chain: SeasonChain;
  powerLoss: EnrichedTeamPowerLoss;
}

export async function analyzeTeamImpactReport(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<TeamImpactReportResult | null> {
  const leagueId = await fetchTeamLeagueId(prisma, teamId);
  if (!leagueId) return null;

  const chain = await fetchSeasonChainData(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  // Player weights (pure)
  const weightData = await fetchPlayerWeightData(prisma, teamId, chain.ids);
  const weights = computePlayerWeightsPure(weightData);
  if (weights.length === 0) return null;

  // Active injuries (pure)
  const injuryData = await fetchActiveInjuryData(prisma, teamId, season);
  const activeInjuries = resolveActiveInjuriesPure(injuryData);

  const weightMap = new Map(weights.map(w => [w.playerId, w]));
  const injuredPlayerIds = [...activeInjuries.keys()].filter(id => weightMap.has(id));

  const [extraData, perfDeltasData] = await Promise.all([
    fetchTeamPowerLossData(prisma, teamId, season, injuredPlayerIds),
    fetchTeamPerformanceDeltasData(prisma, teamId, season, injuredPlayerIds),
  ]);
  if (!extraData) return null;

  const perfDeltas = computeTeamPerformanceDeltasPure(perfDeltasData);
  const powerLoss = computeTeamPowerLossPure(
    teamId, extraData.teamName, season, weights, activeInjuries,
    extraData.teamFixtures, extraData.lineupData, perfDeltas,
  );
  if (!powerLoss) return null;

  return { leagueId, chain, powerLoss };
}
