import type { PrismaClient } from '@prisma/client';
import type { AvailabilityRecord } from './ports';
import { fetchRecoverySignalData, fetchUpcomingFixtureId } from './data-access';

// ── Types ────────────────────────────────────────────────

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

// ── Pure function ────────────────────────────────────────

/**
 * Pure version: applies recovery signals from pre-fetched availability data.
 * No DB dependency — testable with mock data.
 */
export function applyRecoverySignalsPure(
  injuredIds: Set<number>,
  availabilities: AvailabilityRecord[],
): RecoverySignalResult {
  const adjustedInjuredIds = new Set(injuredIds);
  const signalRecovered = new Map<number, SignalRecoveredInfo>();

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

// ── Legacy wrapper (backward-compatible) ─────────────────

/**
 * @deprecated Use applyRecoverySignalsPure with fetchRecoverySignalData
 */
export async function applyRecoverySignals(
  prisma: PrismaClient,
  injuredIds: Set<number>,
  upcomingFixtureId: number | null,
): Promise<RecoverySignalResult> {
  if (!upcomingFixtureId || injuredIds.size === 0) {
    return { adjustedInjuredIds: new Set(injuredIds), signalRecovered: new Map() };
  }

  const availabilities = await fetchRecoverySignalData(prisma, injuredIds, upcomingFixtureId);
  return applyRecoverySignalsPure(injuredIds, availabilities);
}

/**
 * @deprecated Use fetchUpcomingFixtureId from data-access
 */
export async function findUpcomingFixtureId(
  prisma: PrismaClient,
  teamId: number,
  season: number,
): Promise<number | null> {
  return fetchUpcomingFixtureId(prisma, teamId, season);
}
