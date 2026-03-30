import type { PrismaClient } from '@prisma/client';
import {
  emitNewInjuryEvents,
  emitRecoverySignalEvents,
  type NewInjuryEventChange,
  type RecoverySignalEventChange,
} from '../events/injury-feed-events';

const TOP5_LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
const RECENT_INJURY_WINDOW_DAYS = 45;
const SQUAD_STATUS_REASONS = ['inactive', 'loan agreement'];

async function resolveSeason(prisma: PrismaClient, seasonArg?: string): Promise<number> {
  if (seasonArg) {
    const parsed = parseInt(seasonArg, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const current = await prisma.season.findFirst({
    where: { current: true },
    select: { year: true },
    orderBy: { year: 'desc' },
  });

  return current?.year ?? new Date().getFullYear();
}

export async function backfillInjuryFeedFromCurrentState(
  prisma: PrismaClient,
  seasonArg?: string,
): Promise<void> {
  const season = await resolveSeason(prisma, seasonArg);
  const now = new Date();
  const cutoff = new Date(Date.now() - RECENT_INJURY_WINDOW_DAYS * 86_400_000);

  const activeInjuries = await prisma.playerInjuryStatus.findMany({
    where: {
      leagueApiId: { in: [...TOP5_LEAGUE_IDS] },
      season,
      isActive: true,
      injuredSince: { gte: cutoff, lte: now },
      NOT: {
        reason: {
          in: SQUAD_STATUS_REASONS,
          mode: 'insensitive',
        },
      },
    },
    include: {
      player: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { injuredSince: 'desc' },
  });

  const newInjuryChanges: NewInjuryEventChange[] = activeInjuries.map((row) => ({
    playerId: row.playerId,
    playerName: row.player.name,
    teamId: row.teamId,
    teamName: row.team.name,
    leagueApiId: row.leagueApiId,
    season: row.season,
    eventTime: row.injuredSince ?? now,
    injuryStatusId: row.id,
    injuryFixtureId: row.fixtureId ?? null,
    injuryReason: row.reason ?? null,
    injuryType: row.type ?? null,
    injuredSince: row.injuredSince ?? null,
  }));

  await emitNewInjuryEvents(prisma, season, newInjuryChanges);

  const signalRows = await prisma.playerAvailability.findMany({
    where: {
      expired: false,
      signalCount: { gt: 0 },
    },
    include: {
      player: { select: { id: true, name: true } },
      fixture: { select: { id: true } },
    },
    orderBy: { lastSignalAt: 'desc' },
  });

  if (signalRows.length === 0) {
    console.log(`[injury-feed-backfill] season=${season} injuries=${newInjuryChanges.length} signals=0`);
    return;
  }

  const activeInjuryMap = new Map(activeInjuries.map((row) => [row.playerId, row]));
  const relevantSignals = signalRows.filter((row) => activeInjuryMap.has(row.playerId));
  const teamIds = [...new Set(relevantSignals.map((row) => row.teamId))];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  });
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const latestSignals = await Promise.all(
    relevantSignals.map(async (row) => {
      const latestSignal = await prisma.recoverySignal.findFirst({
        where: {
          playerId: row.playerId,
          publishedAt: row.lastSignalAt ? { lte: row.lastSignalAt } : undefined,
        },
        include: {
          source: { select: { name: true } },
        },
        orderBy: { publishedAt: 'desc' },
      });

      return { row, latestSignal };
    }),
  );

  const recoveryChanges: RecoverySignalEventChange[] = latestSignals.map(({ row, latestSignal }) => {
    const injury = activeInjuryMap.get(row.playerId)!;
    return {
      playerId: row.playerId,
      playerName: row.player.name,
      teamId: row.teamId,
      teamName: teamMap.get(row.teamId)?.name ?? `Team ${row.teamId}`,
      leagueApiId: injury.leagueApiId,
      season,
      fixtureId: row.fixture.id,
      eventTime: row.lastSignalAt ?? row.updatedAt,
      eventType: 'recovery_signal_started',
      predictedAvailability: row.predictedAvailability,
      confidenceLevel: row.confidenceLevel,
      latestSignalStage: row.latestSignalStage,
      signalCount: row.signalCount,
      officialStatus: row.officialStatus,
      recoverySignalId: latestSignal?.id ?? null,
      articleTitle: latestSignal?.articleTitle ?? null,
      articleUrl: latestSignal?.articleUrl ?? null,
      sourceName: latestSignal?.source.name ?? null,
    };
  });

  await emitRecoverySignalEvents(prisma, season, recoveryChanges);

  console.log(
    `[injury-feed-backfill] season=${season} injuries=${newInjuryChanges.length} signals=${recoveryChanges.length}`,
  );
}
