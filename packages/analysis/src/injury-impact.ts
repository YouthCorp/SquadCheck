import { PrismaClient } from '@prisma/client';
import { computeTeamPowerLoss, EnrichedInjuredPlayer } from './team-power-loss';

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

export async function computeInjuryImpact(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<InjuryImpactSummary | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const injuries = await prisma.injury.findMany({
    where: { teamId, season },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { fixtureDate: 'asc' },
  });

  if (injuries.length === 0) {
    return {
      teamId, teamName: team.name, season,
      totalInjuries: 0, uniquePlayers: 0,
      injuryTypes: [], injuryReasons: [], monthlyDistribution: [], mostInjuredPlayers: [],
    };
  }

  // Count by type
  const typeCount = new Map<string, number>();
  for (const inj of injuries) {
    typeCount.set(inj.type, (typeCount.get(inj.type) || 0) + 1);
  }

  // Count by reason
  const reasonCount = new Map<string, number>();
  for (const inj of injuries) {
    reasonCount.set(inj.reason, (reasonCount.get(inj.reason) || 0) + 1);
  }

  // Monthly distribution
  const monthCount = new Map<string, number>();
  for (const inj of injuries) {
    const month = inj.fixtureDate.toISOString().slice(0, 7); // YYYY-MM
    monthCount.set(month, (monthCount.get(month) || 0) + 1);
  }

  // Most injured players
  const playerMap = new Map<number, { name: string; count: number; types: Set<string> }>();
  for (const inj of injuries) {
    const existing = playerMap.get(inj.playerId);
    if (existing) {
      existing.count++;
      existing.types.add(inj.type);
    } else {
      playerMap.set(inj.playerId, {
        name: inj.player.name,
        count: 1,
        types: new Set([inj.type]),
      });
    }
  }

  return {
    teamId,
    teamName: team.name,
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

// ── Rich Injury Impact (integrates composite scores) ────────
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

export async function computeRichInjuryImpact(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
): Promise<RichInjuryImpact | null> {
  // Get base injury summary (backward-compatible)
  const base = await computeInjuryImpact(prisma, teamId, season);
  if (!base) return null;

  // Get enriched power loss data
  const powerLoss = await computeTeamPowerLoss(prisma, teamId, seasonIds, seasonYears, season);

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
