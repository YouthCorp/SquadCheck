import { PrismaClient } from '@prisma/client';
import { SIGNAL_CONFIG } from '../nlp/signal-config';
import {
  compareSignalState,
  emitRecoverySignalEvents,
  type RecoverySignalEventChange,
} from '../events/injury-feed-events';

/**
 * Recomputes PlayerAvailability for a single player for their next upcoming fixture.
 *
 * Steps:
 * 1. Find the next non-expired fixture for this team
 * 2. Aggregate RecoverySignals from the last SIGNAL_WINDOW_DAYS days
 * 3. Compute weighted recoverySignalScore
 * 4. Combine with officialStatus to produce predictedAvailability
 * 5. Upsert PlayerAvailability and emit history events when the signal state changed
 */
export async function computePlayerAvailability(
  prisma: PrismaClient,
  playerId: number,
  teamId: number,
  season: number,
): Promise<void> {
  const now = new Date();
  const upcomingFixture = await prisma.fixture.findFirst({
    where: {
      season,
      status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD'] },
      date: { gte: now },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { date: 'asc' },
    select: { id: true, date: true },
  });

  if (!upcomingFixture) return;

  const fixtureId = upcomingFixture.id;
  const previousAvailability = await prisma.playerAvailability.findUnique({
    where: { playerId_fixtureId: { playerId, fixtureId } },
    select: {
      predictedAvailability: true,
      latestSignalStage: true,
      signalCount: true,
    },
  });

  const { SIGNAL_WINDOW_DAYS, RECENCY_HALF_LIFE_DAYS } = SIGNAL_CONFIG.aggregation;
  const windowStart = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const signals = await prisma.recoverySignal.findMany({
    where: {
      playerId,
      publishedAt: { gte: windowStart, lte: upcomingFixture.date },
    },
    include: {
      source: { select: { id: true, name: true, reliability: true } },
    },
    orderBy: { publishedAt: 'desc' },
  });

  let weightedSum = 0;
  let weightTotal = 0;
  let latestStage: string | null = null;
  let latestSignalAt: Date | null = null;

  for (const signal of signals) {
    const ageInDays =
      (Date.now() - signal.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.exp(-ageInDays / RECENCY_HALF_LIFE_DAYS);
    const weight = recencyWeight * signal.source.reliability * signal.confidence;

    weightedSum += signal.recoveryScore * weight;
    weightTotal += weight;

    if (!latestSignalAt || signal.publishedAt > latestSignalAt) {
      latestSignalAt = signal.publishedAt;
      latestStage = signal.signalStage;
    }
  }

  const recoverySignalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const currentStatus = await prisma.playerInjuryStatus.findFirst({
    where: {
      playerId,
      teamId,
      season,
    },
    select: { isActive: true, leagueApiId: true },
  });

  const officialStatus = currentStatus?.isActive ? 'injured' : 'available';
  const cfg = SIGNAL_CONFIG.availability[officialStatus] ?? SIGNAL_CONFIG.availability.injured;
  const predictedAvailability = Math.min(1, cfg.BASE + recoverySignalScore * cfg.SIGNAL_WEIGHT);

  const uniqueSources = new Set(signals.map((signal) => signal.sourceId)).size;
  const confidenceLevel =
    signals.length === 0
      ? 0
      : Math.min(1, (0.5 + 0.1 * signals.length + 0.1 * uniqueSources) * recoverySignalScore);

  const playerRow = await prisma.player.findUnique({
    where: { id: playerId },
    select: { name: true },
  });
  const teamRow = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });

  await prisma.playerAvailability.upsert({
    where: { playerId_fixtureId: { playerId, fixtureId } },
    create: {
      playerId,
      teamId,
      fixtureId,
      officialStatus,
      recoverySignalScore,
      predictedAvailability,
      confidenceLevel,
      latestSignalStage: latestStage,
      lastSignalAt: latestSignalAt,
      signalCount: signals.length,
      expired: false,
    },
    update: {
      officialStatus,
      recoverySignalScore,
      predictedAvailability,
      confidenceLevel,
      latestSignalStage: latestStage,
      lastSignalAt: latestSignalAt,
      signalCount: signals.length,
    },
  });

  const eventType = compareSignalState(previousAvailability, {
    predictedAvailability,
    latestSignalStage: latestStage,
    signalCount: signals.length,
  });

  if (!eventType || signals.length <= 0) return;

  const latestSignal = signals[0] ?? null;
  const changes: RecoverySignalEventChange[] = [{
    playerId,
    playerName: playerRow?.name ?? `Player ${playerId}`,
    teamId,
    teamName: teamRow?.name ?? `Team ${teamId}`,
    leagueApiId: currentStatus?.leagueApiId ?? 0,
    season,
    fixtureId,
    eventTime: latestSignalAt ?? now,
    eventType,
    predictedAvailability,
    confidenceLevel,
    latestSignalStage: latestStage,
    signalCount: signals.length,
    officialStatus,
    recoverySignalId: latestSignal?.id ?? null,
    articleTitle: latestSignal?.articleTitle ?? null,
    articleUrl: latestSignal?.articleUrl ?? null,
    sourceName: latestSignal?.source.name ?? null,
  }];

  await emitRecoverySignalEvents(prisma, season, changes);
}
