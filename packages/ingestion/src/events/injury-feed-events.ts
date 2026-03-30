import type { Prisma, PrismaClient } from '@prisma/client';

export type InjuryFeedEventType =
  | 'new_injury'
  | 'recovery_signal_started'
  | 'recovery_signal_upgraded'
  | 'recovery_signal_downgraded'
  | 'returned_to_squad';

type AvailabilityBucket = 'low' | 'medium' | 'high';

interface InjuryFeedEventBase {
  playerId: number;
  teamId: number;
  leagueApiId: number;
  season: number;
  eventType: InjuryFeedEventType;
  eventTime: Date;
  title: string;
  summary: string;
  metadata: Prisma.InputJsonValue;
  dedupeKey: string;
  injuryStatusId?: number | null;
  availabilityFixtureId?: number | null;
  recoverySignalId?: number | null;
}

export interface NewInjuryEventChange {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  leagueApiId: number;
  season: number;
  eventTime: Date;
  injuryStatusId?: number | null;
  injuryFixtureId?: number | null;
  injuryReason?: string | null;
  injuryType?: string | null;
  injuredSince?: Date | null;
}

export interface ReturnEventChange {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  leagueApiId: number;
  season: number;
  eventTime: Date;
  injuryStatusId?: number | null;
  previousInjuryReason?: string | null;
  previousInjuryType?: string | null;
}

export interface RecoverySignalEventChange {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  leagueApiId: number;
  season: number;
  fixtureId: number;
  eventTime: Date;
  eventType: Exclude<InjuryFeedEventType, 'new_injury' | 'returned_to_squad'>;
  predictedAvailability: number;
  confidenceLevel: number;
  latestSignalStage?: string | null;
  signalCount: number;
  officialStatus: string;
  recoverySignalId?: number | null;
  articleTitle?: string | null;
  articleUrl?: string | null;
  sourceName?: string | null;
}

export interface SignalStateSnapshot {
  predictedAvailability: number;
  latestSignalStage: string | null;
  signalCount: number;
}

export function createDedupKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined || part === '' ? 'none' : String(part)))
    .join(':');
}

export function classifyAvailabilityBucket(value: number): AvailabilityBucket {
  if (value >= 0.7) return 'high';
  if (value >= 0.4) return 'medium';
  return 'low';
}

function stageIndex(stage: string | null | undefined): number {
  const order = ['partial_training', 'full_training', 'available', 'expected_to_start'];
  if (!stage) return -1;
  return order.indexOf(stage);
}

export function compareSignalState(
  previous: SignalStateSnapshot | null,
  current: SignalStateSnapshot,
): Exclude<InjuryFeedEventType, 'new_injury' | 'returned_to_squad'> | null {
  if (current.signalCount <= 0) return null;
  if (!previous || previous.signalCount <= 0) return 'recovery_signal_started';

  const prevStageIndex = stageIndex(previous.latestSignalStage);
  const currStageIndex = stageIndex(current.latestSignalStage);

  if (currStageIndex > prevStageIndex) return 'recovery_signal_upgraded';
  if (currStageIndex < prevStageIndex) return 'recovery_signal_downgraded';

  const prevBucket = classifyAvailabilityBucket(previous.predictedAvailability);
  const currBucket = classifyAvailabilityBucket(current.predictedAvailability);
  if (prevBucket === currBucket) return null;

  const bucketOrder: Record<AvailabilityBucket, number> = { low: 0, medium: 1, high: 2 };
  return bucketOrder[currBucket] > bucketOrder[prevBucket]
    ? 'recovery_signal_upgraded'
    : 'recovery_signal_downgraded';
}

export function buildInjuryFeedEvent(
  input: InjuryFeedEventBase,
): Prisma.InjuryFeedEventCreateManyInput {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    leagueApiId: input.leagueApiId,
    season: input.season,
    eventType: input.eventType,
    eventTime: input.eventTime,
    injuryStatusId: input.injuryStatusId ?? null,
    availabilityFixtureId: input.availabilityFixtureId ?? null,
    recoverySignalId: input.recoverySignalId ?? null,
    title: input.title,
    summary: input.summary,
    metadata: input.metadata,
    dedupeKey: input.dedupeKey,
  };
}

async function createEvents(
  prisma: PrismaClient,
  events: Prisma.InjuryFeedEventCreateManyInput[],
): Promise<void> {
  if (events.length === 0) return;
  await prisma.injuryFeedEvent.createMany({
    data: events,
    skipDuplicates: true,
  });
}

export async function emitNewInjuryEvents(
  prisma: PrismaClient,
  _season: number,
  changes: NewInjuryEventChange[],
): Promise<void> {
  const events = changes.map((change) =>
    buildInjuryFeedEvent({
      playerId: change.playerId,
      teamId: change.teamId,
      leagueApiId: change.leagueApiId,
      season: change.season,
      eventType: 'new_injury',
      eventTime: change.eventTime,
      injuryStatusId: change.injuryStatusId ?? null,
      title: `${change.playerName} new injury`,
      summary: `${change.playerName} reported injured for ${change.teamName}`,
      metadata: {
        injuryReason: change.injuryReason ?? null,
        injuryType: change.injuryType ?? null,
        injuredSince: change.injuredSince?.toISOString() ?? null,
        fixtureId: change.injuryFixtureId ?? null,
      },
      dedupeKey: createDedupKey(
        'new_injury',
        change.season,
        change.teamId,
        change.playerId,
        change.injuryFixtureId ?? 'none',
      ),
    }),
  );

  await createEvents(prisma, events);
}

export async function emitReturnEvents(
  prisma: PrismaClient,
  _season: number,
  changes: ReturnEventChange[],
): Promise<void> {
  const events = changes.map((change) =>
    buildInjuryFeedEvent({
      playerId: change.playerId,
      teamId: change.teamId,
      leagueApiId: change.leagueApiId,
      season: change.season,
      eventType: 'returned_to_squad',
      eventTime: change.eventTime,
      injuryStatusId: change.injuryStatusId ?? null,
      title: `${change.playerName} returned`,
      summary: `${change.playerName} returned to the squad for ${change.teamName}`,
      metadata: {
        resolvedAt: change.eventTime.toISOString(),
        previousInjuryReason: change.previousInjuryReason ?? null,
        previousInjuryType: change.previousInjuryType ?? null,
      },
      dedupeKey: createDedupKey(
        'returned_to_squad',
        change.season,
        change.teamId,
        change.playerId,
        change.eventTime.toISOString().slice(0, 13),
      ),
    }),
  );

  await createEvents(prisma, events);
}

export async function emitRecoverySignalEvents(
  prisma: PrismaClient,
  _season: number,
  changes: RecoverySignalEventChange[],
): Promise<void> {
  const events = changes.map((change) => {
    const bucket = classifyAvailabilityBucket(change.predictedAvailability);
    return buildInjuryFeedEvent({
      playerId: change.playerId,
      teamId: change.teamId,
      leagueApiId: change.leagueApiId,
      season: change.season,
      eventType: change.eventType,
      eventTime: change.eventTime,
      availabilityFixtureId: change.fixtureId,
      recoverySignalId: change.recoverySignalId ?? null,
      title:
        change.eventType === 'recovery_signal_started'
          ? `${change.playerName} recovery signal started`
          : change.eventType === 'recovery_signal_upgraded'
            ? `${change.playerName} recovery signal upgraded`
            : `${change.playerName} recovery signal downgraded`,
      summary: `${change.playerName} recovery status updated for ${change.teamName}`,
      metadata: {
        predictedAvailability: change.predictedAvailability,
        confidenceLevel: change.confidenceLevel,
        latestSignalStage: change.latestSignalStage ?? null,
        signalCount: change.signalCount,
        officialStatus: change.officialStatus,
        fixtureId: change.fixtureId,
        articleTitle: change.articleTitle ?? null,
        articleUrl: change.articleUrl ?? null,
        sourceName: change.sourceName ?? null,
      },
      dedupeKey:
        change.eventType === 'recovery_signal_started'
          ? createDedupKey(
              'recovery_signal_started',
              change.season,
              change.teamId,
              change.playerId,
              change.fixtureId,
            )
          : createDedupKey(
              change.eventType,
              change.season,
              change.teamId,
              change.playerId,
              change.fixtureId,
              change.latestSignalStage ?? 'none',
              bucket,
            ),
    });
  });

  await createEvents(prisma, events);
}
