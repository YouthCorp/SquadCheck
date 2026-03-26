import type { PrismaClient } from '@prisma/client';
import type { InjuryImpactInput } from './ports';
import { fetchInjuryImpactData } from './data-access';
import { computeTeamPowerLoss, EnrichedInjuredPlayer, EnrichedTeamPowerLoss } from './team-power-loss';

// ── Types ────────────────────────────────────────────────

export interface InjuryImpactSummary {
  teamId: number;
  teamName: string;
  season: number;
  totalInjuries: number;
  uniquePlayers: number;
  injuryTypes: { type: string; count: number }[];
  injuryReasons: { reason: string; count: number }[];
  monthlyDistribution: { month: string; count: number }[];
  mostInjuredPlayers: {
    playerId: number;
    playerName: string;
    count: number;
    types: string[];
  }[];
}

export interface RichInjuryImpact extends InjuryImpactSummary {
  powerLoss: {
    totalWeight: number;
    injuredWeight: number;
    powerLossPct: number;
    compositeImpactTotal: number;
  };
  enrichedInjuredPlayers: EnrichedInjuredPlayer[];
  severitySummary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
}

// ── Pure functions ───────────────────────────────────────

/**
 * Pure version: compute injury impact summary from pre-fetched data.
 */
export function computeInjuryImpactPure(data: InjuryImpactInput): InjuryImpactSummary {
  const { teamId, teamName, season, injuries } = data;

  if (injuries.length === 0) {
    return {
      teamId, teamName, season,
      totalInjuries: 0, uniquePlayers: 0,
      injuryTypes: [], injuryReasons: [], monthlyDistribution: [], mostInjuredPlayers: [],
    };
  }

  const typeCount = new Map<string, number>();
  for (const inj of injuries) {
    typeCount.set(inj.type, (typeCount.get(inj.type) || 0) + 1);
  }

  const reasonCount = new Map<string, number>();
  for (const inj of injuries) {
    reasonCount.set(inj.reason, (reasonCount.get(inj.reason) || 0) + 1);
  }

  const monthCount = new Map<string, number>();
  for (const inj of injuries) {
    const month = inj.fixtureDate.toISOString().slice(0, 7);
    monthCount.set(month, (monthCount.get(month) || 0) + 1);
  }

  const playerMap = new Map<number, { name: string; count: number; types: Set<string> }>();
  for (const inj of injuries) {
    const existing = playerMap.get(inj.playerId);
    if (existing) {
      existing.count++;
      existing.types.add(inj.type);
    } else {
      playerMap.set(inj.playerId, {
        name: inj.playerName,
        count: 1,
        types: new Set([inj.type]),
      });
    }
  }

  return {
    teamId,
    teamName,
    season,
    totalInjuries: injuries.length,
    uniquePlayers: playerMap.size,
    injuryTypes: Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    injuryReasons: Array.from(reasonCount.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    monthlyDistribution: Array.from(monthCount.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    mostInjuredPlayers: Array.from(playerMap.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: data.name,
        count: data.count,
        types: Array.from(data.types),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

/**
 * Pure version: compute rich injury impact from pre-computed sub-results.
 */
export function computeRichInjuryImpactPure(
  base: InjuryImpactSummary,
  powerLoss: EnrichedTeamPowerLoss | null,
): RichInjuryImpact {
  const enrichedPlayers = powerLoss?.enrichedInjuredPlayers ?? [];

  const severitySummary = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const p of enrichedPlayers) {
    severitySummary[p.severity]++;
  }

  return {
    ...base,
    powerLoss: {
      totalWeight: powerLoss?.totalWeight ?? 0,
      injuredWeight: powerLoss?.injuredWeight ?? 0,
      powerLossPct: powerLoss?.powerLossPct ?? 0,
      compositeImpactTotal: powerLoss?.compositeImpactTotal ?? 0,
    },
    enrichedInjuredPlayers: enrichedPlayers,
    severitySummary,
  };
}

// ── Legacy wrappers (backward-compatible) ────────────────

/**
 * @deprecated Use computeInjuryImpactPure with fetchInjuryImpactData
 */
export async function computeInjuryImpact(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  injuryLeagueId?: number | null,
): Promise<InjuryImpactSummary | null> {
  const data = await fetchInjuryImpactData(prisma, teamId, season, injuryLeagueId);
  if (!data) return null;
  return computeInjuryImpactPure(data);
}

/**
 * @deprecated Use computeRichInjuryImpactPure with pre-computed data
 */
export async function computeRichInjuryImpact(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
  injuryLeagueId?: number | null,
): Promise<RichInjuryImpact | null> {
  const base = await computeInjuryImpact(prisma, teamId, season, injuryLeagueId);
  if (!base) return null;

  const powerLoss = await computeTeamPowerLoss(prisma, teamId, seasonIds, seasonYears, season, injuryLeagueId);
  return computeRichInjuryImpactPure(base, powerLoss);
}
