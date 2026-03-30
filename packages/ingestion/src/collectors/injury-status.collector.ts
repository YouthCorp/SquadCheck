import { PrismaClient } from '@prisma/client';
import { resolveActiveInjuries } from '@squadcheck/analysis';
import { emitNewInjuryEvents, emitReturnEvents } from '../events/injury-feed-events';

// Top 5 domestic leagues tracked for injury status
const TRACKED_LEAGUE_API_IDS = [39, 140, 135, 78, 61];

/**
 * Computes and caches the current injury status for all players in tracked leagues.
 *
 * For each team in each tracked league:
 *   1. Runs resolveActiveInjuries() as the authoritative injury resolution algorithm
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
    const leagueFixtures = await prisma.fixture.findMany({
      where: { leagueId: league.id, season },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(
      leagueFixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]),
    )];
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });

    for (const team of teams) {
      try {
        const previousStatuses = await prisma.playerInjuryStatus.findMany({
          where: { teamId: team.id, season, isActive: true },
          select: {
            id: true,
            playerId: true,
            reason: true,
            type: true,
            fixtureId: true,
            player: { select: { name: true } },
          },
        });
        const previousStatusMap = new Map(previousStatuses.map((status) => [status.playerId, status]));

        const activeInjuries = await resolveActiveInjuries(prisma, team.id, season);
        const activePlayerIds = [...activeInjuries.keys()];

        if (activePlayerIds.length === 0) {
          const allResolvedIds = previousStatuses.map((status) => status.playerId);
          const resolvedAtNow = new Date();

          const { count } = await prisma.playerInjuryStatus.updateMany({
            where: { teamId: team.id, season, isActive: true },
            data: { isActive: false, resolvedAt: resolvedAtNow },
          });
          totalResolved += count;

          if (previousStatuses.length > 0) {
            await emitReturnEvents(
              prisma,
              season,
              previousStatuses.map((status) => ({
                playerId: status.playerId,
                playerName: status.player.name,
                teamId: team.id,
                teamName: team.name,
                leagueApiId: league.apiFootballId,
                season,
                eventTime: resolvedAtNow,
                injuryStatusId: status.id,
                previousInjuryReason: status.reason,
                previousInjuryType: status.type,
              })),
            );
          }

          if (allResolvedIds.length > 0) {
            await prisma.playerAvailability.updateMany({
              where: { playerId: { in: allResolvedIds }, expired: false },
              data: { expired: true },
            });
          }
          continue;
        }

        const allInjuryRecords = await prisma.injury.findMany({
          where: { teamId: team.id, season, playerId: { in: activePlayerIds } },
          orderBy: { fixtureDate: 'asc' },
          select: { playerId: true, fixtureId: true, fixtureDate: true },
        });

        const allInjuryFixtureIds = [...new Set(allInjuryRecords.map((record) => record.fixtureId))];
        const fixtureDateMap = new Map<number, Date>();
        if (allInjuryFixtureIds.length > 0) {
          const fixtures = await prisma.fixture.findMany({
            where: { id: { in: allInjuryFixtureIds } },
            select: { id: true, date: true },
          });
          for (const fixture of fixtures) fixtureDateMap.set(fixture.id, fixture.date);
        }

        const earliestByPlayer = new Map<number, { fixtureId: number; injuredSince: Date }>();
        for (const injury of allInjuryRecords) {
          if (!earliestByPlayer.has(injury.playerId)) {
            earliestByPlayer.set(injury.playerId, {
              fixtureId: injury.fixtureId,
              injuredSince: fixtureDateMap.get(injury.fixtureId) ?? injury.fixtureDate,
            });
          }
        }

        const playerRows = await prisma.player.findMany({
          where: { id: { in: activePlayerIds } },
          select: { id: true, name: true },
        });
        const playerNameMap = new Map(playerRows.map((player) => [player.id, player.name]));
        const newInjuryEvents: Parameters<typeof emitNewInjuryEvents>[2] = [];

        for (const [playerId, injury] of activeInjuries) {
          const earliest = earliestByPlayer.get(playerId);
          const injuredSince = earliest?.injuredSince
            ?? fixtureDateMap.get(injury.fixtureId)
            ?? injury.fixtureDate;
          const injuryFixtureId = earliest?.fixtureId ?? injury.fixtureId;

          const upserted = await prisma.playerInjuryStatus.upsert({
            where: { playerId_teamId_season: { playerId, teamId: team.id, season } },
            create: {
              playerId,
              teamId: team.id,
              leagueApiId: league.apiFootballId,
              season,
              reason: injury.reason,
              type: injury.type,
              fixtureId: injuryFixtureId,
              injuredSince,
              isActive: true,
            },
            update: {
              reason: injury.reason,
              type: injury.type,
              fixtureId: injuryFixtureId,
              injuredSince,
              isActive: true,
              resolvedAt: null,
            },
            select: { id: true },
          });

          if (!previousStatusMap.has(playerId)) {
            newInjuryEvents.push({
              playerId,
              playerName: playerNameMap.get(playerId) ?? `Player ${playerId}`,
              teamId: team.id,
              teamName: team.name,
              leagueApiId: league.apiFootballId,
              season,
              eventTime: injuredSince ?? new Date(),
              injuryStatusId: upserted.id,
              injuryFixtureId,
              injuryReason: injury.reason,
              injuryType: injury.type,
              injuredSince,
            });
          }
          totalActive++;
        }

        if (newInjuryEvents.length > 0) {
          await emitNewInjuryEvents(prisma, season, newInjuryEvents);
        }

        const resolvedStatuses = previousStatuses.filter((status) => !activePlayerIds.includes(status.playerId));
        const resolvedPlayerIds = resolvedStatuses.map((status) => status.playerId);
        const resolvedAtNow = new Date();

        const { count } = await prisma.playerInjuryStatus.updateMany({
          where: {
            teamId: team.id,
            season,
            isActive: true,
            playerId: { notIn: activePlayerIds },
          },
          data: { isActive: false, resolvedAt: resolvedAtNow },
        });
        totalResolved += count;

        if (resolvedStatuses.length > 0) {
          await emitReturnEvents(
            prisma,
            season,
            resolvedStatuses.map((status) => ({
              playerId: status.playerId,
              playerName: status.player.name,
              teamId: team.id,
              teamName: team.name,
              leagueApiId: league.apiFootballId,
              season,
              eventTime: resolvedAtNow,
              injuryStatusId: status.id,
              previousInjuryReason: status.reason,
              previousInjuryType: status.type,
            })),
          );
        }

        if (resolvedPlayerIds.length > 0) {
          await prisma.playerAvailability.updateMany({
            where: { playerId: { in: resolvedPlayerIds }, expired: false },
            data: { expired: true },
          });
        }
      } catch (err) {
        console.warn(`[InjuryStatus] Error for team ${team.id} (league ${league.apiFootballId}):`, err);
      }
    }
  }

  console.log(`[InjuryStatus] Done - ${totalActive} active, ${totalResolved} newly resolved`);
}
