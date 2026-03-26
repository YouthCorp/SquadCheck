import type { PrismaClient } from '@prisma/client';
import type { LineupEntry, DeploymentEntry, RecentFormationEntry } from './ports';
import { fetchPredictedLineupData, fetchActiveInjuryData, fetchRecoverySignalData, fetchUpcomingFixtureId, fetchPlayerWeightData, fetchPlayerPhotos } from './data-access';
import { computePlayerWeights, computePlayerWeightsPure } from './player-weight';
import { resolveActiveInjuries, resolveActiveInjuriesPure, type ActiveInjury } from './utils/injury-resolver';
import type { PositionGroup } from './player-weight';
import {
  getFormationTemplate,
  resolveGridPosition,
  positionAffinityForSlot,
  type FormationSlot,
  type SpecificPosition,
} from './formation-templates';
import {
  applyRecoverySignals,
  applyRecoverySignalsPure,
  findUpcomingFixtureId,
  type SignalRecoveredInfo,
  type RecoverySignalResult,
} from './recovery-signal-integration';

// ── Types ────────────────────────────────────────────────────

export type StarterRole = 'regular_starter' | 'rotation' | 'bench';

export interface PositionSlots {
  GK: number;
  DEF: number;
  MID: number;
  FWD: number;
}

export interface PredictedPlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: PositionGroup;
  weight: number;
  starterFrequency: number;
  compositeScore: number;
  role: StarterRole;
  recentReturn: boolean;
  slotPosition: string;
  slotLabel: string;
  pitchX: number;
  pitchY: number;
  positionAffinity: number;
  recentStarterFrequency: number;
  signalRecovered?: {
    predictedAvailability: number;
    latestSignalStage: string | null;
    lastSignalAt: Date | null;
    confidenceLevel: number;
  };
}

export interface UnavailablePlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: PositionGroup;
  weight: number;
  injuryReason: string;
  wouldHaveStarted: boolean;
}

export interface PredictedLineup {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  season: number;
  formation: string;
  formationSource: 'historical' | 'default';
  positionSlots: PositionSlots;
  formationSlots: Array<{
    specificPosition: string;
    displayLabel: string;
    positionGroup: PositionGroup;
    pitchX: number;
    pitchY: number;
  }>;
  starters: PredictedPlayer[];
  unavailable: UnavailablePlayer[];
}

// ── Helpers ──────────────────────────────────────────────────

function classifyStarterRole(frequency: number): StarterRole {
  if (frequency >= 0.60) return 'regular_starter';
  if (frequency >= 0.30) return 'rotation';
  return 'bench';
}

function parseFormation(f: string): PositionSlots {
  const parts = f.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
  if (parts.length < 2) return { GK: 1, DEF: 4, MID: 4, FWD: 2 };

  let DEF: number, MID: number, FWD: number;
  if (parts.length === 2) {
    DEF = parts[0]; MID = 0; FWD = parts[1];
  } else if (parts.length === 3) {
    DEF = parts[0]; MID = parts[1]; FWD = parts[2];
  } else {
    DEF = parts[0];
    FWD = parts[parts.length - 1];
    MID = parts.slice(1, -1).reduce((a, b) => a + b, 0);
  }

  const total = DEF + MID + FWD;
  if (total !== 10) return { GK: 1, DEF: 4, MID: 4, FWD: 2 };
  return { GK: 1, DEF, MID, FWD };
}

function round(val: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

// ── Deployment profile types ─────────────────────────────────

interface DeploymentProfile {
  playerId: number;
  positionCounts: Map<SpecificPosition, number>;
  primaryPosition: SpecificPosition | null;
  secondaryPositions: SpecificPosition[];
  recentStarterFrequency: number;
  totalWeightedStarts: number;
}

const RECENCY_WEIGHTS = [
  1.0, 1.0, 1.0, 1.0, 1.0,
  0.7, 0.7, 0.7, 0.7, 0.7,
  0.4, 0.4, 0.4, 0.4, 0.4,
];

// ── Build deployment profiles (pure — from pre-fetched data) ──

function buildDeploymentProfilesPure(
  deploymentEntries: DeploymentEntry[],
  playerIds: number[],
): Map<number, DeploymentProfile> {
  // Get unique fixture dates for recency ordering
  const fixtureDatesDesc: Date[] = [];
  const seenDates = new Set<number>();
  for (const entry of deploymentEntries) {
    const ts = entry.fixtureDate.getTime();
    if (!seenDates.has(ts)) {
      seenDates.add(ts);
      fixtureDatesDesc.push(entry.fixtureDate);
    }
  }
  // Sort desc (entries should already be ordered, but ensure)
  fixtureDatesDesc.sort((a, b) => b.getTime() - a.getTime());

  const dateToIndex = new Map<number, number>();
  fixtureDatesDesc.forEach((d, i) => dateToIndex.set(d.getTime(), i));

  const profileMap = new Map<number, DeploymentProfile>();
  for (const pid of playerIds) {
    profileMap.set(pid, {
      playerId: pid,
      positionCounts: new Map(),
      primaryPosition: null,
      secondaryPositions: [],
      recentStarterFrequency: 0,
      totalWeightedStarts: 0,
    });
  }

  // Group entries by player
  const entriesByPlayer = new Map<number, DeploymentEntry[]>();
  for (const entry of deploymentEntries) {
    const arr = entriesByPlayer.get(entry.playerId) ?? [];
    arr.push(entry);
    entriesByPlayer.set(entry.playerId, arr);
  }

  const maxRecentMatches = Math.min(fixtureDatesDesc.length, RECENCY_WEIGHTS.length);

  for (const [pid, entries] of entriesByPlayer) {
    const profile = profileMap.get(pid)!;
    let weightedStarts = 0;

    for (const entry of entries) {
      const matchIdx = dateToIndex.get(entry.fixtureDate.getTime()) ?? 999;
      if (matchIdx >= RECENCY_WEIGHTS.length) continue;

      const recencyWeight = RECENCY_WEIGHTS[matchIdx] ?? 0.4;
      weightedStarts += recencyWeight;

      const formation = entry.formation;
      const grid = entry.grid;
      if (formation && grid) {
        const specificPos = resolveGridPosition(formation, grid);
        if (specificPos) {
          const current = profile.positionCounts.get(specificPos) ?? 0;
          profile.positionCounts.set(specificPos, current + recencyWeight);
        }
      }
    }

    profile.totalWeightedStarts = weightedStarts;
    const maxWeightSum = RECENCY_WEIGHTS.slice(0, maxRecentMatches).reduce((a, b) => a + b, 0);
    profile.recentStarterFrequency = maxWeightSum > 0
      ? round(weightedStarts / maxWeightSum)
      : 0;

    if (profile.positionCounts.size > 0) {
      const sorted = [...profile.positionCounts.entries()].sort((a, b) => b[1] - a[1]);
      profile.primaryPosition = sorted[0][0];
      const primaryCount = sorted[0][1];
      profile.secondaryPositions = sorted.slice(1)
        .filter(([, count]) => count >= primaryCount * 0.2)
        .map(([pos]) => pos);
    }
  }

  return profileMap;
}

// ── Greedy slot assignment algorithm ─────────────────────────

interface ScoredPlayer {
  playerId: number;
  playerName: string;
  position: string | null;
  positionGroup: PositionGroup;
  weight: number;
  starterFrequency: number;
  recentStarterFrequency: number;
  compositeScore: number;
  role: StarterRole;
  recentReturn: boolean;
  deploymentProfile: DeploymentProfile;
}

interface SlotAssignment {
  slot: FormationSlot;
  player: ScoredPlayer;
  fitScore: number;
  affinity: number;
}

function computePositionAffinity(
  player: ScoredPlayer,
  slotPos: SpecificPosition,
): number {
  const profile = player.deploymentProfile;

  if (profile.primaryPosition) {
    if (profile.primaryPosition === slotPos) return 1.0;
    const affinityFromTemplate = positionAffinityForSlot(profile.primaryPosition, slotPos);
    if (affinityFromTemplate >= 0.85) return 0.85;
  }

  for (const secPos of profile.secondaryPositions) {
    if (secPos === slotPos) return 0.70;
    const affinityFromTemplate = positionAffinityForSlot(secPos, slotPos);
    if (affinityFromTemplate >= 0.85) return 0.65;
  }

  if (profile.primaryPosition === null) {
    const slotGroup = getFormationTemplate('4-4-2')
      .find(s => s.specificPosition === slotPos)?.positionGroup;
    if (slotGroup && slotGroup === player.positionGroup) return 0.40;
  }

  const template = getFormationTemplate('4-4-2');
  const slotDef = template.find(s => s.specificPosition === slotPos);
  if (slotDef && slotDef.positionGroup === player.positionGroup) return 0.35;

  return 0.0;
}

function assignPlayersToSlots(
  formationSlots: FormationSlot[],
  availablePlayers: ScoredPlayer[],
): SlotAssignment[] {
  const slotCandidates = formationSlots.map(slot => {
    const candidates = availablePlayers.map(player => {
      const affinity = computePositionAffinity(player, slot.specificPosition);
      const fitScore = affinity * 0.50 + player.compositeScore * 0.35 + player.recentStarterFrequency * 0.15;
      return { player, affinity, fitScore };
    });
    const viableCandidates = candidates.filter(c => c.affinity > 0);
    return { slot, candidates, viableCandidateCount: viableCandidates.length };
  });

  slotCandidates.sort((a, b) => a.viableCandidateCount - b.viableCandidateCount);

  const assignments: SlotAssignment[] = [];
  const assignedPlayerIds = new Set<number>();

  for (const { slot, candidates } of slotCandidates) {
    const available = candidates.filter(c => !assignedPlayerIds.has(c.player.playerId));
    available.sort((a, b) => b.fitScore - a.fitScore);

    const best = available[0];
    if (best) {
      assignments.push({
        slot,
        player: best.player,
        fitScore: best.fitScore,
        affinity: best.affinity,
      });
      assignedPlayerIds.add(best.player.playerId);
    }
  }

  return assignments;
}

// ── Pure function ─────────────────────────────────────────────

/**
 * Pure version: compute predicted lineup from pre-fetched/pre-computed data.
 * No DB dependency — testable with mock data.
 */
export function computePredictedLineupPure(
  teamId: number,
  teamName: string,
  teamLogo: string | null,
  season: number,
  weights: import('./player-weight').PlayerWeight[],
  teamFixtures: number,
  lineupData: LineupEntry[],
  deploymentEntries: DeploymentEntry[],
  recentFormations: RecentFormationEntry[],
  activeInjuries: Map<number, ActiveInjury>,
  recoverySignalResult: RecoverySignalResult,
  upcomingFixtureId: number | null,
  playerPhotos: Map<number, string | null>,
): PredictedLineup | null {
  if (weights.length === 0) return null;

  const allPlayerIds = weights.map(w => w.playerId);

  // Build starter profiles for each player
  interface StarterProfile {
    starterCount: number;
    substituteCount: number;
    starterFrequency: number;
    role: StarterRole;
  }

  const starterProfiles = new Map<number, StarterProfile>();
  for (const pid of allPlayerIds) {
    const entries = lineupData.filter(e => e.playerId === pid);
    const starters = entries.filter(e => e.isStarting);
    const subs = entries.filter(e => !e.isStarting);
    const starterCount = starters.length;
    const substituteCount = subs.length;
    const freq = teamFixtures > 0 ? starterCount / teamFixtures : 0;
    starterProfiles.set(pid, {
      starterCount,
      substituteCount,
      starterFrequency: round(freq),
      role: classifyStarterRole(freq),
    });
  }

  // Build deployment profiles (pure)
  const deploymentProfiles = buildDeploymentProfilesPure(deploymentEntries, allPlayerIds);

  // Detect formation
  let formation = '4-4-2';
  let formationSource: 'historical' | 'default' = 'default';
  let formationCandidates: string[] = ['4-4-2'];

  if (recentFormations.length > 0) {
    const formationCount = new Map<string, { count: number; latestDate: Date }>();
    for (const lu of recentFormations) {
      if (!lu.formation) continue;
      const existing = formationCount.get(lu.formation);
      if (!existing) {
        formationCount.set(lu.formation, { count: 1, latestDate: lu.fixtureDate });
      } else {
        existing.count += 1;
        if (lu.fixtureDate > existing.latestDate) {
          existing.latestDate = lu.fixtureDate;
        }
      }
    }

    if (formationCount.size > 0) {
      const sorted = Array.from(formationCount.entries()).sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].latestDate.getTime() - a[1].latestDate.getTime();
      });
      formationCandidates = sorted.map(([f]) => f);
      formation = formationCandidates[0];
      formationSource = 'historical';
    }
  }

  let positionSlots = parseFormation(formation);

  // Injury handling
  const latestTeamInjuryDate = activeInjuries.size > 0
    ? new Date(Math.max(...[...activeInjuries.values()].map(i => i.fixtureDate.getTime())))
    : new Date(0);

  const injuredIds = new Set(activeInjuries.keys());

  // Apply recovery signals (already computed)
  const { adjustedInjuredIds, signalRecovered } = recoverySignalResult;
  const effectiveInjuredIds = adjustedInjuredIds;

  // Detect recently-returned players
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentReturnIds = new Set<number>();
  for (const [pid, inj] of activeInjuries) {
    if (!effectiveInjuredIds.has(pid) && inj.fixtureDate >= thirtyDaysAgo) {
      recentReturnIds.add(pid);
    }
  }

  // Compute composite scores
  const maxWeight = Math.max(...weights.map(w => w.weight), 0.001);
  const availablePlayers: ScoredPlayer[] = [];
  const injuredWithScores: Array<ScoredPlayer & { injuryReason: string }> = [];
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const pw of weights) {
    const sp = starterProfiles.get(pw.playerId) ?? {
      starterCount: 0,
      substituteCount: 0,
      starterFrequency: 0,
      role: 'bench' as StarterRole,
    };

    const isInjured = effectiveInjuredIds.has(pw.playerId);

    if (!isInjured) {
      if (sp.starterCount === 0) continue;
    } else if (sp.starterCount + sp.substituteCount === 0) {
      const injury = activeInjuries.get(pw.playerId);
      if (!injury || injury.fixtureDate < ninetyDaysAgo) continue;
    }

    const normWeight = pw.weight / maxWeight;
    const dp = deploymentProfiles.get(pw.playerId);
    const recentStarterFreq = dp?.recentStarterFrequency ?? 0;

    const compositeScore = round(
      0.35 * recentStarterFreq + 0.20 * sp.starterFrequency + 0.45 * normWeight,
    );

    const scored: ScoredPlayer = {
      playerId: pw.playerId,
      playerName: pw.playerName,
      position: pw.position,
      positionGroup: pw.positionGroup,
      weight: pw.weight,
      starterFrequency: sp.starterFrequency,
      recentStarterFrequency: recentStarterFreq,
      compositeScore,
      role: sp.role,
      recentReturn: recentReturnIds.has(pw.playerId),
      deploymentProfile: dp ?? {
        playerId: pw.playerId,
        positionCounts: new Map(),
        primaryPosition: null,
        secondaryPositions: [],
        recentStarterFrequency: 0,
        totalWeightedStarts: 0,
      },
    };

    if (isInjured) {
      const injury = activeInjuries.get(pw.playerId);
      injuredWithScores.push({
        ...scored,
        injuryReason: injury?.reason ?? 'Unknown',
      });
    } else {
      const sigInfo = signalRecovered.get(pw.playerId);
      if (sigInfo) {
        (scored as ScoredPlayer & { signalRecoveredInfo?: SignalRecoveredInfo }).signalRecoveredInfo = sigInfo;
      }
      availablePlayers.push(scored);
    }
  }

  // Slot-based lineup assignment
  let formationTemplate = getFormationTemplate(formation);

  for (const candidate of formationCandidates) {
    const template = getFormationTemplate(candidate);
    const assignments = assignPlayersToSlots(template, availablePlayers);
    if (assignments.length >= 11) {
      formation = candidate;
      positionSlots = parseFormation(candidate);
      formationTemplate = template;
      break;
    }
  }

  const finalAssignments = assignPlayersToSlots(formationTemplate, availablePlayers);

  // Build final starters list
  const sortedAssignments = [...finalAssignments].sort((a, b) => {
    if (a.slot.pitchY !== b.slot.pitchY) return a.slot.pitchY - b.slot.pitchY;
    return a.slot.pitchX - b.slot.pitchX;
  });

  const finalStarters: PredictedPlayer[] = sortedAssignments.map(a => {
    const sigInfo = (a.player as ScoredPlayer & { signalRecoveredInfo?: SignalRecoveredInfo }).signalRecoveredInfo;
    return {
      playerId: a.player.playerId,
      playerName: a.player.playerName,
      photo: playerPhotos.get(a.player.playerId) ?? null,
      position: a.player.position,
      positionGroup: a.slot.positionGroup,
      weight: a.player.weight,
      starterFrequency: a.player.starterFrequency,
      compositeScore: a.player.compositeScore,
      role: a.player.role,
      recentReturn: a.player.recentReturn,
      slotPosition: a.slot.specificPosition,
      slotLabel: a.slot.displayLabel,
      pitchX: a.slot.pitchX,
      pitchY: a.slot.pitchY,
      positionAffinity: round(a.affinity),
      recentStarterFrequency: a.player.recentStarterFrequency,
      ...(sigInfo && {
        signalRecovered: {
          predictedAvailability: sigInfo.predictedAvailability,
          latestSignalStage: sigInfo.latestSignalStage,
          lastSignalAt: sigInfo.lastSignalAt,
          confidenceLevel: sigInfo.confidenceLevel,
        },
      }),
    };
  });

  // Build unavailable list
  const finalUnavailable: UnavailablePlayer[] = injuredWithScores.map(p => {
    let wouldHaveStarted = false;
    for (const assignment of finalAssignments) {
      const injuredAffinity = computePositionAffinity(p, assignment.slot.specificPosition);
      const injuredFitScore = injuredAffinity * 0.50 + p.compositeScore * 0.35 + p.recentStarterFrequency * 0.15;
      if (injuredFitScore > assignment.fitScore) {
        wouldHaveStarted = true;
        break;
      }
    }
    return {
      playerId: p.playerId,
      playerName: p.playerName,
      photo: playerPhotos.get(p.playerId) ?? null,
      position: p.position,
      positionGroup: p.positionGroup,
      weight: p.weight,
      injuryReason: p.injuryReason,
      wouldHaveStarted,
    };
  }).sort((a, b) => b.weight - a.weight);

  return {
    teamId,
    teamName,
    teamLogo,
    season,
    formation,
    formationSource,
    positionSlots,
    formationSlots: formationTemplate.map(s => ({
      specificPosition: s.specificPosition,
      displayLabel: s.displayLabel,
      positionGroup: s.positionGroup,
      pitchX: s.pitchX,
      pitchY: s.pitchY,
    })),
    starters: finalStarters,
    unavailable: finalUnavailable,
  };
}

// ── Legacy wrapper (backward-compatible) ─────────────────────

/**
 * @deprecated Use computePredictedLineupPure with pre-fetched data
 */
export async function computePredictedLineup(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
  injuryLeagueId?: number | null,
): Promise<PredictedLineup | null> {
  // 1. Compute player weights
  const weights = await computePlayerWeights(prisma, teamId, seasonIds, seasonYears);
  if (weights.length === 0) return null;

  const allPlayerIds = weights.map(w => w.playerId);

  // 2. Fetch lineup/deployment/formation data
  const layoutData = await fetchPredictedLineupData(prisma, teamId, season, allPlayerIds);
  if (!layoutData) return null;

  // 3. Resolve injuries
  const activeInjuries = await resolveActiveInjuries(prisma, teamId, season, injuryLeagueId);
  const injuredIds = new Set(activeInjuries.keys());

  // 4. Recovery signals
  const upcomingFixtureId = await findUpcomingFixtureId(prisma, teamId, season);
  const availabilities = await fetchRecoverySignalData(prisma, injuredIds, upcomingFixtureId);
  const recoverySignalResult = applyRecoverySignalsPure(injuredIds, availabilities);

  // 5. Fetch photos
  const allRelevantIds = [...allPlayerIds, ...activeInjuries.keys()];
  const playerPhotos = await fetchPlayerPhotos(prisma, [...new Set(allRelevantIds)]);

  // 6. Pure computation
  return computePredictedLineupPure(
    teamId,
    layoutData.teamName,
    layoutData.teamLogo,
    season,
    weights,
    layoutData.teamFixtures,
    layoutData.lineupData,
    layoutData.deploymentEntries,
    layoutData.recentFormations,
    activeInjuries,
    recoverySignalResult,
    upcomingFixtureId,
    playerPhotos,
  );
}
