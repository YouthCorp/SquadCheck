import { PrismaClient } from '@prisma/client';
import { resolveSeasonChain, resolveTeamLeague } from './utils/season-resolver';
import { computePlayerWeights, PlayerWeight } from './player-weight';
import { computeRichInjuryImpact, RichInjuryImpact } from './injury-impact';
import { computeTeamPowerLoss, EnrichedTeamPowerLoss } from './team-power-loss';
import { computePredictedLineup, PredictedLineup } from './predicted-lineup';
import { computePerformanceDelta, PerformanceDelta } from './performance-delta';
import {
  computeTeamOutcomeImpact,
  TeamOutcomeImpact,
  TeamSeasonStatsInput,
  StandingEntryInput,
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
  const leagueId = await resolveTeamLeague(prisma, teamId);
  if (!leagueId) return null;

  const chain = await resolveSeasonChain(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const weights = await computePlayerWeights(prisma, teamId, chain.ids, chain.years);
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
  const leagueId = await resolveTeamLeague(prisma, teamId);
  if (!leagueId) return null;

  const chain = await resolveSeasonChain(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const rich = await computeRichInjuryImpact(
    prisma, teamId, chain.ids, chain.years, season, leagueApiId ?? null,
  );
  if (!rich) return null;

  // Fetch team stats needed to compute outcome impact (avoids duplicate query in API)
  const [teamSeasonStats, standingEntry] = await Promise.all([
    prisma.teamSeasonStats.findUnique({
      where: { teamId_seasonId: { teamId, seasonId: chain.ids[0] } },
      select: { avgXg: true, avgXgAgainst: true, totalGoals: true, totalConceded: true },
    }) as Promise<TeamSeasonStatsInput | null>,
    prisma.standingEntry.findFirst({
      where: { teamId, seasonId: chain.ids[0] },
      select: { played: true, wins: true, draws: true, losses: true, goalsFor: true, goalsAgainst: true },
      orderBy: { rank: 'asc' },
    }) as Promise<StandingEntryInput | null>,
  ]);

  const outcomeImpact = computeTeamOutcomeImpact(
    rich.enrichedInjuredPlayers,
    teamSeasonStats,
    standingEntry,
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
  const leagueId = await resolveTeamLeague(prisma, teamId);
  if (!leagueId) return null;

  const chain = await resolveSeasonChain(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const lineup = await computePredictedLineup(
    prisma, teamId, chain.ids, chain.years, season, leagueApiId ?? null,
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
  const leagueId = await resolveTeamLeague(prisma, teamId);
  if (!leagueId) return null;

  const chain = await resolveSeasonChain(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const [weights, perfDelta] = await Promise.all([
    computePlayerWeights(prisma, teamId, chain.ids, chain.years),
    computePerformanceDelta(prisma, teamId, playerId, season),
  ]);

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
  const leagueId = await resolveTeamLeague(prisma, teamId);
  if (!leagueId) return null;

  const chain = await resolveSeasonChain(prisma, leagueId, season);
  if (chain.ids.length === 0) return null;

  const powerLoss = await computeTeamPowerLoss(
    prisma, teamId, chain.ids, chain.years, season,
  );
  if (!powerLoss) return null;

  return { leagueId, chain, powerLoss };
}
