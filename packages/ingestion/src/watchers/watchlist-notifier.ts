import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import webpush from 'web-push';

// Ordered from lowest to highest recovery confidence
const STAGE_ORDER = ['partial_training', 'full_training', 'available', 'expected_to_start'] as const;
type SignalStage = (typeof STAGE_ORDER)[number];

function stageIndex(stage: string | null | undefined): number {
  if (!stage) return -1;
  return STAGE_ORDER.indexOf(stage as SignalStage);
}

interface AlertData {
  alertType: string;
  previousStage: string | null;
  newStage: string | null;
  confidence: number | null;
  message: string;
}

function buildAlertMessage(
  playerName: string,
  alertType: string,
  opts: { stage?: string | null; confidence?: number | null; reason?: string | null },
): string {
  switch (alertType) {
    case 'new_injury':
      return opts.reason
        ? `${playerName} reported injured: ${opts.reason}`
        : `${playerName} has a new injury`;
    case 'signal_upgrade':
      return `${playerName}'s recovery upgraded to ${opts.stage ?? '?'} (${Math.round((opts.confidence ?? 0) * 100)}% confidence)`;
    case 'signal_downgrade':
      return `${playerName}'s recovery signal downgraded to ${opts.stage ?? '?'}`;
    case 'lineup_return':
      return `${playerName} has returned from injury`;
    default:
      return `Update for ${playerName}`;
  }
}

/**
 * Detects changes for a watched player and returns alert data if something meaningful changed.
 * Called once per unique watched playerId after each incrementalSync / collectSignals cycle.
 */
function detectChange(opts: {
  playerName: string;
  isInjured: boolean;
  injuryReason: string | null | undefined;
  currentStage: string | null | undefined;
  currentConfidence: number | null | undefined;
  lastAlert: { alertType: string; newStage: string | null } | null;
  justResolved: boolean;
}): AlertData | null {
  const { playerName, isInjured, injuryReason, currentStage, currentConfidence, lastAlert, justResolved } = opts;

  // Case: lineup return (injury resolved)
  if (justResolved && lastAlert?.alertType !== 'lineup_return') {
    return {
      alertType: 'lineup_return',
      previousStage: lastAlert?.newStage ?? null,
      newStage: null,
      confidence: null,
      message: buildAlertMessage(playerName, 'lineup_return', {}),
    };
  }

  // Case: new injury
  if (isInjured && lastAlert?.alertType !== 'new_injury' && lastAlert?.alertType !== 'signal_upgrade' && lastAlert?.alertType !== 'signal_downgrade') {
    return {
      alertType: 'new_injury',
      previousStage: null,
      newStage: null,
      confidence: null,
      message: buildAlertMessage(playerName, 'new_injury', { reason: injuryReason }),
    };
  }

  // Case: signal stage change
  if (isInjured && currentStage) {
    const prevIdx = stageIndex(lastAlert?.newStage);
    const currIdx = stageIndex(currentStage);

    if (currIdx > prevIdx && currIdx >= 0) {
      return {
        alertType: 'signal_upgrade',
        previousStage: lastAlert?.newStage ?? null,
        newStage: currentStage,
        confidence: currentConfidence ?? null,
        message: buildAlertMessage(playerName, 'signal_upgrade', { stage: currentStage, confidence: currentConfidence }),
      };
    }

    if (currIdx < prevIdx && currIdx >= 0) {
      return {
        alertType: 'signal_downgrade',
        previousStage: lastAlert?.newStage ?? null,
        newStage: currentStage,
        confidence: currentConfidence ?? null,
        message: buildAlertMessage(playerName, 'signal_downgrade', { stage: currentStage }),
      };
    }
  }

  return null;
}

/**
 * Main entry point — called at the end of incrementalSync() and collectSignals().
 * Checks each watched player for state changes and creates alerts + sends push notifications.
 */
export async function notifyWatchlistChanges(
  prisma: PrismaClient,
  season: number,
): Promise<void> {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  // Get all distinct watched playerIds
  const watchedRows = await prisma.watchlistPlayer.findMany({
    select: { playerId: true },
    distinct: ['playerId'],
  });

  if (watchedRows.length === 0) return;

  const playerIds = watchedRows.map((r) => r.playerId);

  // Batch-load current state for all watched players in 2 queries
  const [injuryStatuses, availabilities, players] = await Promise.all([
    prisma.playerInjuryStatus.findMany({
      where: { playerId: { in: playerIds }, season },
      select: { playerId: true, isActive: true, reason: true, resolvedAt: true },
    }),
    prisma.playerAvailability.findMany({
      where: { playerId: { in: playerIds }, expired: false },
      orderBy: { updatedAt: 'desc' },
      select: { playerId: true, latestSignalStage: true, confidenceLevel: true },
    }),
    prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true },
    }),
  ]);

  const injuryMap = new Map(injuryStatuses.map((s) => [s.playerId, s]));
  const availMap = new Map(availabilities.map((a) => [a.playerId, a]));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Batch-load the most recent alert per player (one query instead of N)
  const recentAlerts = await prisma.$queryRaw<
    { player_id: number; alert_type: string; new_stage: string | null; created_at: Date }[]
  >`
    SELECT DISTINCT ON (player_id) player_id, alert_type, new_stage, created_at
    FROM watchlist_alerts
    WHERE player_id = ANY(${playerIds}::int[])
    ORDER BY player_id, created_at DESC
  `;
  const lastAlertMap = new Map(
    recentAlerts.map((a) => [
      a.player_id,
      { alertType: a.alert_type, newStage: a.new_stage, createdAt: a.created_at },
    ]),
  );

  const watcherRows = await prisma.watchlistPlayer.findMany({
    where: { playerId: { in: playerIds } },
    select: { playerId: true, userId: true },
  });
  const watchersByPlayerId = new Map<number, string[]>();
  for (const row of watcherRows) {
    const existing = watchersByPlayerId.get(row.playerId) ?? [];
    existing.push(row.userId);
    watchersByPlayerId.set(row.playerId, existing);
  }

  const watcherUserIds = [...new Set(watcherRows.map((row) => row.userId))];
  const usersWithPushRows = watcherUserIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: watcherUserIds },
          pushSubscription: { not: Prisma.DbNull },
        },
        select: { id: true, pushSubscription: true },
      })
    : [];
  const pushUserById = new Map(usersWithPushRows.map((user) => [user.id, user]));

  for (const playerId of playerIds) {
    const injury = injuryMap.get(playerId);
    const avail = availMap.get(playerId);
    const player = playerMap.get(playerId);

    if (!player) continue;

    const lastAlert = lastAlertMap.get(playerId) ?? null;

    // 6-hour cooldown
    if (lastAlert && Date.now() - lastAlert.createdAt.getTime() < SIX_HOURS_MS) {
      continue;
    }

    const alertData = detectChange({
      playerName: player.name,
      isInjured: injury?.isActive ?? false,
      injuryReason: injury?.reason,
      currentStage: avail?.latestSignalStage,
      currentConfidence: avail?.confidenceLevel,
      lastAlert: lastAlert ? { alertType: lastAlert.alertType, newStage: lastAlert.newStage } : null,
      justResolved: !!injury && !injury.isActive && !!injury.resolvedAt,
    });

    if (!alertData) continue;

    const watcherIds = watchersByPlayerId.get(playerId) ?? [];
    if (watcherIds.length === 0) continue;

    // Batch insert alerts for all watchers
    await prisma.watchlistAlert.createMany({
      data: watcherIds.map((userId) => ({
        userId,
        playerId,
        ...alertData,
      })),
    });

    console.log(`[Notifier] ${alertData.alertType} for ${player.name} → ${watcherIds.length} watcher(s)`);

    // Send web push to users who have a push subscription
    const usersWithPush = watcherIds
      .map((userId) => pushUserById.get(userId))
      .filter((user): user is NonNullable<typeof user> => !!user);

    if (usersWithPush.length === 0) continue;

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@squadcheck.xyz';

    if (!vapidPublic || !vapidPrivate) continue;

    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    for (const user of usersWithPush) {
      const subscription = user.pushSubscription as any;
      if (!subscription?.endpoint) continue;

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: 'SquadCheck', body: alertData.message }),
        );
      } catch (err: any) {
        // Subscription expired/invalid — clear it
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.user.update({
            where: { id: user.id },
            data: { pushSubscription: Prisma.DbNull },
          });
        }
        // Other errors: log and continue
        console.warn(`[Notifier] Push failed for user ${user.id}:`, err?.message);
      }
    }
  }
}
