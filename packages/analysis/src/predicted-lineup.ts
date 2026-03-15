import { PrismaClient } from '@prisma/client';
import { computePlayerWeights } from './player-weight';
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
  findUpcomingFixtureId,
  type SignalRecoveredInfo,
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
  // New: slot-level position info
  slotPosition: string;   // e.g. "ST", "LW", "RB"
  slotLabel: string;       // display label
  pitchX: number;          // 0-100, left→right
  pitchY: number;          // 0-100, GK(0)→attack(100)
  positionAffinity: number;
  recentStarterFrequency: number;
  // Signal-based recovery (optional — only set when player was moved from injured → available)
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
  positionCounts: Map<SpecificPosition, number>;  // recency-weighted counts
  primaryPosition: SpecificPosition | null;
  secondaryPositions: SpecificPosition[];
  recentStarterFrequency: number;  // recency-weighted starter frequency
  totalWeightedStarts: number;
}

// ── Recency weighting for deployment profiling ───────────────

const RECENCY_WEIGHTS = [
  1.0, 1.0, 1.0, 1.0, 1.0,     // matches 1-5 (most recent)
  0.7, 0.7, 0.7, 0.7, 0.7,     // matches 6-10
  0.4, 0.4, 0.4, 0.4, 0.4,     // matches 11-15
];

// ── Build deployment profiles from fixture data ──────────────

async function buildDeploymentProfiles(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  playerIds: number[],
): Promise<Map<number, DeploymentProfile>> {
  // Fetch recent fixture lineups with grid data, sorted by date desc
  const recentStarterData = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: playerIds },
      isStarting: true,
      lineup: {
        teamId,
        fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } },
      },
    },
    select: {
      playerId: true,
      grid: true,
      lineup: {
        select: {
          formation: true,
          fixture: { select: { date: true } },
        },
      },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

  // Get unique fixture dates for this team (for recency ordering)
  const fixtureDatesDesc: Date[] = [];
  const seenDates = new Set<number>();
  for (const entry of recentStarterData) {
    const ts = entry.lineup.fixture.date.getTime();
    if (!seenDates.has(ts)) {
      seenDates.add(ts);
      fixtureDatesDesc.push(entry.lineup.fixture.date);
    }
  }
  // fixtureDatesDesc is already desc-sorted from the query

  // Build date→matchIndex mapping (0 = most recent)
  const dateToIndex = new Map<number, number>();
  fixtureDatesDesc.forEach((d, i) => dateToIndex.set(d.getTime(), i));

  // Group entries by player and build profiles
  const profileMap = new Map<number, DeploymentProfile>();

  // Initialize profiles for all players
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
  const entriesByPlayer = new Map<number, typeof recentStarterData>();
  for (const entry of recentStarterData) {
    const arr = entriesByPlayer.get(entry.playerId) ?? [];
    arr.push(entry);
    entriesByPlayer.set(entry.playerId, arr);
  }

  const maxRecentMatches = Math.min(fixtureDatesDesc.length, RECENCY_WEIGHTS.length);

  for (const [pid, entries] of entriesByPlayer) {
    const profile = profileMap.get(pid)!;
    let weightedStarts = 0;

    // Only consider first 15 matches worth of data per player
    const playerMatchDates = new Set<number>();
    for (const entry of entries) {
      const matchIdx = dateToIndex.get(entry.lineup.fixture.date.getTime()) ?? 999;
      if (matchIdx >= RECENCY_WEIGHTS.length) continue; // older than 15 matches
      playerMatchDates.add(entry.lineup.fixture.date.getTime());

      const recencyWeight = RECENCY_WEIGHTS[matchIdx] ?? 0.4;
      weightedStarts += recencyWeight;

      // Resolve grid position using formation template
      const formation = entry.lineup.formation;
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

    // Calculate recency-weighted starter frequency
    // Denominator = sum of weights for recent team matches the player could have played
    const maxWeightSum = RECENCY_WEIGHTS.slice(0, maxRecentMatches).reduce((a, b) => a + b, 0);
    profile.recentStarterFrequency = maxWeightSum > 0
      ? round(weightedStarts / maxWeightSum)
      : 0;

    // Determine primary and secondary positions
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

  // Check primary position
  if (profile.primaryPosition) {
    if (profile.primaryPosition === slotPos) return 1.0;
    // Check compatible positions
    const affinityFromTemplate = positionAffinityForSlot(profile.primaryPosition, slotPos);
    if (affinityFromTemplate >= 0.85) return 0.85;
  }

  // Check secondary positions
  for (const secPos of profile.secondaryPositions) {
    if (secPos === slotPos) return 0.70;
    const affinityFromTemplate = positionAffinityForSlot(secPos, slotPos);
    if (affinityFromTemplate >= 0.85) return 0.65;
  }

  // No deployment data — fall back to position group match
  if (profile.primaryPosition === null) {
    // Use registered position group as fallback
    const slotGroup = getFormationTemplate('4-4-2')
      .find(s => s.specificPosition === slotPos)?.positionGroup;
    if (slotGroup && slotGroup === player.positionGroup) return 0.40;
  }

  // Check if at least position group matches
  const template = getFormationTemplate('4-4-2');
  const slotDef = template.find(s => s.specificPosition === slotPos);
  if (slotDef && slotDef.positionGroup === player.positionGroup) return 0.35;

  return 0.0;
}

function assignPlayersToSlots(
  formationSlots: FormationSlot[],
  availablePlayers: ScoredPlayer[],
): SlotAssignment[] {
  // For each slot, compute fit scores for all available players
  const slotCandidates = formationSlots.map(slot => {
    const candidates = availablePlayers.map(player => {
      const affinity = computePositionAffinity(player, slot.specificPosition);
      const fitScore = affinity * 0.50 + player.compositeScore * 0.35 + player.recentStarterFrequency * 0.15;
      return { player, affinity, fitScore };
    });
    const viableCandidates = candidates.filter(c => c.affinity > 0);
    return { slot, candidates, viableCandidateCount: viableCandidates.length };
  });

  // Sort slots by constraint level (hardest to fill first)
  slotCandidates.sort((a, b) => a.viableCandidateCount - b.viableCandidateCount);

  const assignments: SlotAssignment[] = [];
  const assignedPlayerIds = new Set<number>();

  for (const { slot, candidates } of slotCandidates) {
    // Filter out already-assigned players
    const available = candidates.filter(c => !assignedPlayerIds.has(c.player.playerId));

    // Sort by fitScore descending
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

// ── Main function ─────────────────────────────────────────────

export async function computePredictedLineup(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
  season: number,
  injuryLeagueId?: number | null,
): Promise<PredictedLineup | null> {
  // 1. Validate team exists
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  // 2. Compute player weights for the full squad
  const weights = await computePlayerWeights(prisma, teamId, seasonIds, seasonYears);
  if (weights.length === 0) return null;

  const allPlayerIds = weights.map(w => w.playerId);

  // 3. Count team's completed fixtures this season (for starterFrequency denominator)
  const teamFixtures = await prisma.fixture.count({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season,
      status: { in: ['FT', 'AET', 'PEN'] },
    },
  });

  // 4. Fetch lineup data for ALL squad players
  const lineupData = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: allPlayerIds },
      lineup: {
        teamId,
        fixture: { season },
      },
    },
    select: {
      playerId: true,
      isStarting: true,
      lineup: { select: { fixture: { select: { date: true } } } },
    },
    orderBy: { lineup: { fixture: { date: 'desc' } } },
  });

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

  // 5. Build deployment profiles (grid-based position analysis)
  const deploymentProfiles = await buildDeploymentProfiles(prisma, teamId, season, allPlayerIds);

  // 6. Detect formation from last 10 completed fixtures
  const recentLineups = await prisma.fixtureLineup.findMany({
    where: {
      teamId,
      fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } },
    },
    select: {
      formation: true,
      fixture: { select: { date: true } },
    },
    orderBy: { fixture: { date: 'desc' } },
    take: 10,
  });

  let formation = '4-4-2';
  let formationSource: 'historical' | 'default' = 'default';
  let formationCandidates: string[] = ['4-4-2'];

  if (recentLineups.length > 0) {
    const formationCount = new Map<string, { count: number; latestDate: Date }>();
    for (const lu of recentLineups) {
      if (!lu.formation) continue;
      const existing = formationCount.get(lu.formation);
      if (!existing) {
        formationCount.set(lu.formation, { count: 1, latestDate: lu.fixture.date });
      } else {
        existing.count += 1;
        if (lu.fixture.date > existing.latestDate) {
          existing.latestDate = lu.fixture.date;
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

  // 7. Build injured player ID set
  const injuries = await prisma.injury.findMany({
    where: { teamId, season, ...(injuryLeagueId ? { leagueId: injuryLeagueId } : {}) },
    orderBy: { fixtureDate: 'desc' },
  });

  const latestInjuryByPlayer = new Map<number, typeof injuries[0]>();
  for (const inj of injuries) {
    if (!latestInjuryByPlayer.has(inj.playerId)) {
      latestInjuryByPlayer.set(inj.playerId, inj);
    }
  }

  // Remove already-served absences
  const latestTeamInjuryDate = injuries.length > 0 ? injuries[0].fixtureDate : new Date(0);
  {
    const completedFixtureIds = new Set<number>();
    const fixtureStatuses = await prisma.fixture.findMany({
      where: {
        id: { in: [...latestInjuryByPlayer.values()].map(i => i.fixtureId) },
        status: { in: ['FT', 'AET', 'PEN'] },
      },
      select: { id: true },
    });
    for (const f of fixtureStatuses) completedFixtureIds.add(f.id);
    for (const [pid, injury] of latestInjuryByPlayer) {
      const r = injury.reason.toLowerCase();
      const isDisciplinary =
        r.includes('red card') ||
        r === 'suspended' ||
        r === 'suspension' ||
        r.includes('yellow card');
      if (
        isDisciplinary &&
        injury.fixtureDate < latestTeamInjuryDate &&
        completedFixtureIds.has(injury.fixtureId)
      ) {
        latestInjuryByPlayer.delete(pid);
      }
    }
  }

  // Filter out recovered players (appeared in lineup AFTER their last injury)
  const candidateIds = [...latestInjuryByPlayer.keys()];
  if (candidateIds.length > 0) {
    const postInjuryAppearances = await prisma.fixtureLineupPlayer.findMany({
      where: {
        playerId: { in: candidateIds },
        lineup: {
          teamId,
          fixture: {
            season,
            status: { in: ['FT', 'AET', 'PEN'] },
            ...(injuryLeagueId ? { leagueId: injuryLeagueId } : {}),
          },
        },
      },
      select: {
        playerId: true,
        lineup: { select: { fixture: { select: { date: true } } } },
      },
    });

    const latestAppearance = new Map<number, Date>();
    for (const entry of postInjuryAppearances) {
      const date = entry.lineup.fixture.date;
      const prev = latestAppearance.get(entry.playerId);
      if (!prev || date > prev) {
        latestAppearance.set(entry.playerId, date);
      }
    }

    for (const [pid, injury] of latestInjuryByPlayer) {
      const lastPlayed = latestAppearance.get(pid);
      if (lastPlayed && lastPlayed > injury.fixtureDate) {
        latestInjuryByPlayer.delete(pid);
      }
    }
  }

  const injuredIds = new Set(latestInjuryByPlayer.keys());

  // 7b. Apply recovery signals: move high-confidence recovery players to available pool
  const upcomingFixtureId = await findUpcomingFixtureId(prisma, teamId, season);
  const { adjustedInjuredIds, signalRecovered } = await applyRecoverySignals(
    prisma,
    injuredIds,
    upcomingFixtureId,
  );
  // Use adjusted set from here on (immutable — original injuredIds preserved above)
  const effectiveInjuredIds = adjustedInjuredIds;

  // 8. Detect recently-returned players
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentReturnIds = new Set<number>();
  for (const inj of injuries) {
    if (!effectiveInjuredIds.has(inj.playerId) && inj.fixtureDate >= thirtyDaysAgo) {
      recentReturnIds.add(inj.playerId);
    }
  }

  // 9. Compute composite scores for all available (non-injured) players
  const weightMap = new Map(weights.map(w => [w.playerId, w]));
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
      const injury = latestInjuryByPlayer.get(pw.playerId);
      if (!injury || injury.fixtureDate < ninetyDaysAgo) continue;
    }

    const normWeight = pw.weight / maxWeight;
    const dp = deploymentProfiles.get(pw.playerId);
    const recentStarterFreq = dp?.recentStarterFrequency ?? 0;

    // Updated composite score: recent form + season consistency + quality
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
      const injury = latestInjuryByPlayer.get(pw.playerId);
      injuredWithScores.push({
        ...scored,
        injuryReason: injury?.reason ?? 'Unknown',
      });
    } else {
      // If signal-recovered, attach signal info to scored player
      const sigInfo = signalRecovered.get(pw.playerId);
      if (sigInfo) {
        (scored as ScoredPlayer & { signalRecoveredInfo?: SignalRecoveredInfo }).signalRecoveredInfo = sigInfo;
      }
      availablePlayers.push(scored);
    }
  }

  // 10. Slot-based lineup assignment using formation template
  let formationTemplate = getFormationTemplate(formation);

  // Try each formation candidate until one can be filled
  // (at least 11 available players can be assigned)
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

  // 11. Determine wouldHaveStarted for injured players
  const lowestFitScore = finalAssignments.length > 0
    ? Math.min(...finalAssignments.map(a => a.fitScore))
    : 0;

  // For each injured player, check if they would have displaced any starter
  const starterIds = new Set(finalAssignments.map(a => a.player.playerId));

  // 12. Fetch photos for all players
  const allRelevantIds = [
    ...finalAssignments.map(a => a.player.playerId),
    ...injuredWithScores.map(p => p.playerId),
  ];
  const playerRecords = await prisma.player.findMany({
    where: { id: { in: allRelevantIds } },
    select: { id: true, photo: true },
  });
  const photoMap = new Map(playerRecords.map(p => [p.id, p.photo]));

  // 13. Build final starters list (sorted by pitchY asc = GK first, then defense, mid, fwd)
  const sortedAssignments = [...finalAssignments].sort((a, b) => {
    if (a.slot.pitchY !== b.slot.pitchY) return a.slot.pitchY - b.slot.pitchY;
    return a.slot.pitchX - b.slot.pitchX;
  });

  const finalStarters: PredictedPlayer[] = sortedAssignments.map(a => {
    const sigInfo = (a.player as ScoredPlayer & { signalRecoveredInfo?: SignalRecoveredInfo }).signalRecoveredInfo;
    return {
      playerId: a.player.playerId,
      playerName: a.player.playerName,
      photo: photoMap.get(a.player.playerId) ?? null,
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

  // 14. Build unavailable list with wouldHaveStarted
  const finalUnavailable: UnavailablePlayer[] = injuredWithScores.map(p => {
    // Simulate: would this injured player have displaced someone in any slot?
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
      photo: photoMap.get(p.playerId) ?? null,
      position: p.position,
      positionGroup: p.positionGroup,
      weight: p.weight,
      injuryReason: p.injuryReason,
      wouldHaveStarted,
    };
  }).sort((a, b) => b.weight - a.weight);

  return {
    teamId,
    teamName: team.name,
    teamLogo: team.logo,
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
