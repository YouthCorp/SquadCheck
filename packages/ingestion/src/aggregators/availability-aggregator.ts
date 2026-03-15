import { PrismaClient } from '@prisma/client';
import { SIGNAL_CONFIG } from '../nlp/signal-config';

/**
 * Recomputes PlayerAvailability for a single player for their next upcoming fixture.
 *
 * Steps:
 * 1. Find the next non-expired fixture for this team
 * 2. Aggregate RecoverySignals from the last SIGNAL_WINDOW_DAYS days
 * 3. Compute weighted recoverySignalScore
 * 4. Combine with officialStatus to produce predictedAvailability
 * 5. Upsert PlayerAvailability (playerId + fixtureId)
 */
export async function computePlayerAvailability(
  prisma: PrismaClient,
  playerId: number,
  teamId: number,
  season: number,
): Promise<void> {
  // Step 1: Find next upcoming fixture for this team
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

  if (!upcomingFixture) return; // No upcoming fixture — nothing to compute

  const fixtureId = upcomingFixture.id;

  // Step 2: Get recent signals within the aggregation window.
  // Upper bound = fixture date: only signals published BEFORE the match count.
  // Post-match articles (e.g. "Player returned in 2-1 win") must not inflate availability.
  const { SIGNAL_WINDOW_DAYS, RECENCY_HALF_LIFE_DAYS } = SIGNAL_CONFIG.aggregation;
  const windowStart = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const signals = await prisma.recoverySignal.findMany({
    where: {
      playerId,
      publishedAt: { gte: windowStart, lte: upcomingFixture.date },
    },
    include: { source: { select: { reliability: true } } },
    orderBy: { publishedAt: 'desc' },
  });

  // Step 3: Weighted average of recovery scores
  let weightedSum = 0;
  let weightTotal = 0;
  let latestStage: string | null = null;
  let latestSignalAt: Date | null = null;

  for (const signal of signals) {
    const ageInDays =
      (Date.now() - signal.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.exp(-ageInDays / RECENCY_HALF_LIFE_DAYS);
    const w = recencyWeight * signal.source.reliability * signal.confidence;

    weightedSum += signal.recoveryScore * w;
    weightTotal += w;

    if (!latestSignalAt || signal.publishedAt > latestSignalAt) {
      latestSignalAt = signal.publishedAt;
      latestStage = signal.signalStage;
    }
  }

  const recoverySignalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Step 4: Determine official_status from Injury table
  // If player has no active injury record → they are "available" (API-confirmed)
  const latestInjury = await prisma.injury.findFirst({
    where: { playerId, season },
    orderBy: { fixtureDate: 'desc' },
  });

  const officialStatus = latestInjury ? 'injured' : 'available';

  // Combine: predictedAvailability = BASE + recoverySignalScore × SIGNAL_WEIGHT
  const cfg = SIGNAL_CONFIG.availability[officialStatus] ?? SIGNAL_CONFIG.availability.injured;
  const predictedAvailability = Math.min(1, cfg.BASE + recoverySignalScore * cfg.SIGNAL_WEIGHT);

  // Confidence increases with more signals from diverse sources
  const uniqueSources = new Set(signals.map(s => s.sourceId)).size;
  const confidenceLevel =
    signals.length === 0
      ? 0
      : Math.min(1, (0.5 + 0.1 * signals.length + 0.1 * uniqueSources) * recoverySignalScore);

  // Step 5: Upsert PlayerAvailability
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
}
