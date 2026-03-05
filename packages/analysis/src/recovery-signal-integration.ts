import { PrismaClient } from '@prisma/client';

const AVAILABILITY_THRESHOLD = 0.7;
const CONFIDENCE_THRESHOLD = 0.5;

export interface SignalRecoveredInfo {
  predictedAvailability: number;
  latestSignalStage: string | null;
  lastSignalAt: Date | null;
  confidenceLevel: number;
  fixtureId: number;
}

export interface RecoverySignalResult {
  /** Injured IDs after removing high-signal recovery players */
  adjustedInjuredIds: Set<number>;
  /** Players moved from injured → available via signal */
  signalRecovered: Map<number, SignalRecoveredInfo>;
}

/**
 * Consults PlayerAvailability to find injured players with strong recovery signals
 * and removes them from the injured set so they can be considered for the lineup.
 *
 * Immutable: original injuredIds Set is never modified.
 *
 * @param prisma        DB client
 * @param injuredIds    Current injured player ID set (from standard injury detection logic)
 * @param upcomingFixtureId  The fixture this lineup prediction is for (null = no fixture context)
 */
export async function applyRecoverySignals(
  prisma: PrismaClient,
  injuredIds: Set<number>,
  upcomingFixtureId: number | null,
): Promise<RecoverySignalResult> {
  const adjustedInjuredIds = new Set(injuredIds);
  const signalRecovered = new Map<number, SignalRecoveredInfo>();

  if (!upcomingFixtureId || injuredIds.size === 0) {
    return { adjustedInjuredIds, signalRecovered };
  }

  const availabilities = await prisma.playerAvailability.findMany({
    where: {
      playerId: { in: [...injuredIds] },
      fixtureId: upcomingFixtureId,
      expired: false,
      predictedAvailability: { gte: AVAILABILITY_THRESHOLD },
      confidenceLevel: { gte: CONFIDENCE_THRESHOLD },
    },
  });

  for (const a of availabilities) {
    adjustedInjuredIds.delete(a.playerId);
    signalRecovered.set(a.playerId, {
      predictedAvailability: a.predictedAvailability,
      latestSignalStage: a.latestSignalStage,
      lastSignalAt: a.lastSignalAt,
      confidenceLevel: a.confidenceLevel,
      fixtureId: a.fixtureId,
    });
  }

  return { adjustedInjuredIds, signalRecovered };
}

/**
 * For a given team and season, finds the next upcoming fixture ID.
 * Returns null if no upcoming fixture exists.
 */
export async function findUpcomingFixtureId(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<number | null> {
  const fixture = await prisma.fixture.findFirst({
    where: {
      season,
      status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD'] },
      date: { gte: new Date() },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { date: 'asc' },
    select: { id: true },
  });

  return fixture?.id ?? null;
}
