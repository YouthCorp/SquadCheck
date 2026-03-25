import { PrismaClient } from '@prisma/client';

/**
 * Builds a season chain (ids + years) for a given league starting from currentYear,
 * looking back `lookback` seasons. Moved from api/routes/analysis.ts.
 */
export async function resolveSeasonChain(
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

/**
 * Resolves the primary leagueId for a team. Tries player season stats first,
 * falls back to standing entries. Moved from api/routes/analysis.ts.
 */
export async function resolveTeamLeague(
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
