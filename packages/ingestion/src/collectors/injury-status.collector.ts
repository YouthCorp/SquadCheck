import { PrismaClient } from '@prisma/client';
import { resolveActiveInjuries } from '@squadcheck/analysis';

// Top 5 domestic leagues tracked for injury status
const TRACKED_LEAGUE_API_IDS = [39, 140, 135, 78, 61];

/**
 * Computes and caches the current injury status for all players in tracked leagues.
 *
 * For each team in each tracked league:
 *   1. Runs resolveActiveInjuries() — the single authoritative injury resolution algorithm
 *   2. Upserts active injuries into player_injury_status
 *   3. Marks previously active records as resolved if the player is no longer injured
 *
 * Called at the end of each incrementalSync() so all display endpoints
 * (home panel, team page, fixtures page) read from a single consistent source.
 */
export async function collectInjuryStatuses(
  prisma: PrismaClient,
  season: number,
): Promise<void> {
  console.log('[InjuryStatus] Collecting injury statuses...');

  const leagues = await prisma.league.findMany({
    where: { apiFootballId: { in: TRACKED_LEAGUE_API_IDS } },
    select: { id: true, apiFootballId: true, name: true },
  });

  let totalActive = 0;
  let totalResolved = 0;

  for (const league of leagues) {
    // All teams that played in this league+season
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { homeFixtures: { some: { leagueId: league.id, season } } },
          { awayFixtures: { some: { leagueId: league.id, season } } },
        ],
      },
      select: { id: true },
    });

    for (const team of teams) {
      try {
        // resolveActiveInjuries: no leagueId filter — cup injuries count too
        const activeInjuries = await resolveActiveInjuries(prisma, team.id, season);

        // Batch-fetch fixture.date for all injury fixtureIds (authoritative, no API Football drift)
        const fixtureIds = [...activeInjuries.values()]
          .map(i => i.fixtureId)
          .filter((id): id is number => id != null);

        const fixtureMap = new Map<number, Date>();
        if (fixtureIds.length > 0) {
          const fixtures = await prisma.fixture.findMany({
            where: { id: { in: fixtureIds } },
            select: { id: true, date: true },
          });
          for (const f of fixtures) fixtureMap.set(f.id, f.date);
        }

        // Upsert each active injury
        for (const [playerId, injury] of activeInjuries) {
          const injuredSince = fixtureMap.get(injury.fixtureId) ?? injury.fixtureDate;

          await prisma.playerInjuryStatus.upsert({
            where: { playerId_teamId_season: { playerId, teamId: team.id, season } },
            create: {
              playerId,
              teamId: team.id,
              leagueApiId: league.apiFootballId,
              season,
              reason: injury.reason,
              type: injury.type,
              fixtureId: injury.fixtureId,
              injuredSince,
              isActive: true,
            },
            update: {
              reason: injury.reason,
              type: injury.type,
              fixtureId: injury.fixtureId,
              injuredSince,
              isActive: true,
              resolvedAt: null,
            },
          });
          totalActive++;
        }

        // Mark as resolved: players previously active but no longer injured
        const { count } = await prisma.playerInjuryStatus.updateMany({
          where: {
            teamId: team.id,
            season,
            isActive: true,
            playerId: { notIn: [...activeInjuries.keys()] },
          },
          data: { isActive: false, resolvedAt: new Date() },
        });
        totalResolved += count;
      } catch (err) {
        console.warn(`[InjuryStatus] Error for team ${team.id} (league ${league.apiFootballId}):`, err);
      }
    }
  }

  console.log(`[InjuryStatus] Done — ${totalActive} active, ${totalResolved} newly resolved`);
}
