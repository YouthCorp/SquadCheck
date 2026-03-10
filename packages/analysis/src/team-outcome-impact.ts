import { EnrichedInjuredPlayer, Severity } from './team-power-loss';

// ── Types ────────────────────────────────────────────────────
export interface OutcomeBaseline {
  xgPerMatch: number;
  xgaPerMatch: number;
  goalsPerMatch: number;
  concededPerMatch: number;
  winRate: number;
  matches: number;
}

export interface PlayerOutcomeRecord {
  playerId: number;
  playerName: string;
  position: string | null;
  severity: Severity;
  withPlayer: { W: number; D: number; L: number; matches: number; xgAvg: number | null };
  withoutPlayer: { W: number; D: number; L: number; matches: number; xgAvg: number | null };
  xgDelta: number | null;
  winRateDelta: number;
  hasSignificantSample: boolean;
}

export interface TeamOutcomeImpact {
  baseline: OutcomeBaseline;
  depleted: {
    estimatedXg: number;
    estimatedXga: number;
    estimatedWinRate: number;
  };
  impact: {
    xgDelta: number | null;
    xgaDelta: number | null;
    winRateDelta: number;
  };
  playerRecords: PlayerOutcomeRecord[];
  confidence: 'high' | 'medium' | 'low';
  injuredStarterCount: number;
}

// ── Baseline Sources ─────────────────────────────────────────
export interface TeamSeasonStatsInput {
  avgXg: number | null;
  avgXgAgainst: number | null;
  totalGoals: number | null;
  totalConceded: number | null;
}

export interface StandingEntryInput {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

// ── Constants ────────────────────────────────────────────────
const OVERLAP_DISCOUNT = 0.7;
const MIN_SIGNIFICANT_MATCHES = 5;

// ── Main Function ────────────────────────────────────────────
export function computeTeamOutcomeImpact(
  enrichedPlayers: EnrichedInjuredPlayer[],
  seasonStats: TeamSeasonStatsInput | null,
  standing: StandingEntryInput | null,
): TeamOutcomeImpact | null {
  const players = enrichedPlayers;
  if (players.length === 0) return null;

  // ── 1. Build baseline ──────────────────────────────────────
  const baseline = buildBaseline(seasonStats, standing);
  if (!baseline) return null;

  // ── 2. Build per-player outcome records ────────────────────
  const playerRecords = buildPlayerRecords(players);

  // ── 3. Compute team-level aggregate impact ─────────────────
  const { xgDelta, xgaDelta, winRateDelta, injuredStarterCount } =
    computeAggregateImpact(players);

  // ── 4. Compute depleted estimates ──────────────────────────
  const depleted = {
    estimatedXg: xgDelta !== null
      ? clamp(baseline.xgPerMatch + xgDelta, 0, baseline.xgPerMatch * 2)
      : baseline.xgPerMatch,
    estimatedXga: xgaDelta !== null
      ? clamp(baseline.xgaPerMatch + xgaDelta, 0, baseline.xgaPerMatch * 3)
      : baseline.xgaPerMatch,
    estimatedWinRate: clamp(baseline.winRate + winRateDelta, 0, 100),
  };

  // ── 5. Confidence ──────────────────────────────────────────
  const significantCount = playerRecords.filter(r => r.hasSignificantSample).length;
  const startersWithSample = players.filter(
    p => p.starterProfile.role === 'regular_starter' && p.hasSignificantSample,
  ).length;

  let confidence: 'high' | 'medium' | 'low';
  if (startersWithSample >= 3) confidence = 'high';
  else if (significantCount >= 1) confidence = 'medium';
  else confidence = 'low';

  return {
    baseline,
    depleted,
    impact: { xgDelta, xgaDelta, winRateDelta },
    playerRecords,
    confidence,
    injuredStarterCount,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function buildBaseline(
  stats: TeamSeasonStatsInput | null,
  standing: StandingEntryInput | null,
): OutcomeBaseline | null {
  if (!stats && !standing) return null;

  const matches = standing?.played ?? 0;
  if (matches === 0 && !stats) return null;

  const xgPerMatch = stats?.avgXg ?? 0;
  const xgaPerMatch = stats?.avgXgAgainst ?? 0;

  let goalsPerMatch: number;
  let concededPerMatch: number;
  let winRate: number;

  if (standing && standing.played > 0) {
    goalsPerMatch = round(standing.goalsFor / standing.played);
    concededPerMatch = round(standing.goalsAgainst / standing.played);
    winRate = round((standing.wins / standing.played) * 100);
  } else if (stats) {
    goalsPerMatch = stats.totalGoals != null && matches > 0
      ? round(stats.totalGoals / matches) : 0;
    concededPerMatch = stats.totalConceded != null && matches > 0
      ? round(stats.totalConceded / matches) : 0;
    winRate = 0;
  } else {
    return null;
  }

  return {
    xgPerMatch: round(xgPerMatch),
    xgaPerMatch: round(xgaPerMatch),
    goalsPerMatch,
    concededPerMatch,
    winRate,
    matches: standing?.played ?? matches,
  };
}

function buildPlayerRecords(players: EnrichedInjuredPlayer[]): PlayerOutcomeRecord[] {
  return players.map(p => {
    const wp = p.withPlayer;
    const wop = p.withoutPlayer;

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      position: p.position,
      severity: p.severity,
      withPlayer: wp
        ? { W: wp.wins, D: wp.draws, L: wp.losses, matches: wp.matches, xgAvg: wp.avgXg }
        : { W: 0, D: 0, L: 0, matches: 0, xgAvg: null },
      withoutPlayer: wop
        ? { W: wop.wins, D: wop.draws, L: wop.losses, matches: wop.matches, xgAvg: wop.avgXg }
        : { W: 0, D: 0, L: 0, matches: 0, xgAvg: null },
      xgDelta: p.performanceDelta?.avgXgDelta ?? null,
      winRateDelta: p.performanceDelta?.winRateDelta ?? 0,
      hasSignificantSample: p.hasSignificantSample,
    };
  });
}

function computeAggregateImpact(players: EnrichedInjuredPlayer[]): {
  xgDelta: number | null;
  xgaDelta: number | null;
  winRateDelta: number;
  injuredStarterCount: number;
} {
  // Only aggregate players with performance delta data and moderate+ impact (score >= 0.30)
  const eligible = players.filter(
    p => p.performanceDelta && p.withPlayer && p.withoutPlayer && p.compositeImpactScore >= 0.30,
  );

  if (eligible.length === 0) {
    return { xgDelta: null, xgaDelta: null, winRateDelta: 0, injuredStarterCount: 0 };
  }

  const injuredStarterCount = eligible.filter(
    p => p.starterProfile.role === 'regular_starter',
  ).length;

  // Weighted sum of deltas by compositeImpactScore
  let xgWeightedSum = 0;
  let xgaWeightedSum = 0;
  let winRateWeightedSum = 0;
  let totalWeight = 0;
  let hasXgData = false;

  for (const p of eligible) {
    const delta = p.performanceDelta!;
    const weight = p.compositeImpactScore;

    if (delta.avgXgDelta !== null) {
      xgWeightedSum += delta.avgXgDelta * weight;
      hasXgData = true;
    }
    if (delta.avgConcededDelta !== null) {
      // avgConcededDelta: positive = more conceded without player (worse defense)
      // We want xgaDelta to represent change in goals conceded
      xgaWeightedSum += delta.avgConcededDelta * weight;
    }
    winRateWeightedSum += delta.winRateDelta * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { xgDelta: null, xgaDelta: null, winRateDelta: 0, injuredStarterCount };
  }

  // Sign convention: negate so that all deltas represent "impact of absence":
  //   xgDelta:      negative = less xG (attack weakened)
  //   xgaDelta:     positive = more conceded (defense weakened)
  //   winRateDelta: negative = lower win rate
  // performance-delta computes (with - without), i.e. positive = player helps.
  // Negating gives us "impact of player being absent".
  const xgDelta = hasXgData ? round(-xgWeightedSum * OVERLAP_DISCOUNT) : null;
  const xgaDelta = totalWeight > 0 ? round(-xgaWeightedSum * OVERLAP_DISCOUNT) : null;
  const winRateDelta = round(-winRateWeightedSum * OVERLAP_DISCOUNT);

  return { xgDelta, xgaDelta, winRateDelta, injuredStarterCount };
}

// ── Utilities ────────────────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
