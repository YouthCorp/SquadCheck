/**
 * Phase 2 gate: Facade function tests.
 *
 * Verifies that each facade produces the same domain results as the underlying
 * compute* calls it wraps. Real Prisma → real DB (Docker: squadcheck-db-1).
 *
 * Canonical fixture: Tottenham (teamId=11), EPL season=2025.
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  analyzeTeamPower,
  analyzeInjuryImpact,
  analyzePredictedLineup,
  analyzePlayerImpact,
  analyzeTeamImpactReport,
  computePlayerWeights,
  computeRichInjuryImpact,
  computePredictedLineup,
  computeTeamPowerLoss,
  resolveSeasonChain,
  resolveTeamLeague,
} from '../src/index';

const prisma = new PrismaClient();

const TEAM_ID = 11;   // Tottenham
const SEASON = 2025;

let leagueId: number;
let chain: { ids: number[]; years: number[] };

beforeAll(async () => {
  const resolved = await resolveTeamLeague(prisma, TEAM_ID);
  if (!resolved) throw new Error('Could not resolve league for Tottenham — is the DB seeded?');
  leagueId = resolved;
  chain = await resolveSeasonChain(prisma, leagueId, SEASON);
  if (chain.ids.length === 0) throw new Error('Could not resolve season chain — is season 2025 seeded?');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── resolveTeamLeague / resolveSeasonChain ────────────────────────────────────

describe('season-resolver helpers', () => {
  it('resolveTeamLeague returns a positive integer leagueId', () => {
    expect(typeof leagueId).toBe('number');
    expect(leagueId).toBeGreaterThan(0);
  });

  it('resolveSeasonChain returns matching ids and years arrays', () => {
    expect(chain.ids.length).toBeGreaterThan(0);
    expect(chain.ids.length).toBe(chain.years.length);
    expect(chain.years[0]).toBe(SEASON);
  });
});

// ── analyzeTeamPower ──────────────────────────────────────────────────────────

describe('analyzeTeamPower(prisma, teamId=11, season=2025)', () => {
  it('returns non-null result with leagueId, chain, weights', async () => {
    const result = await analyzeTeamPower(prisma, TEAM_ID, SEASON);
    expect(result).not.toBeNull();
    expect(result!.leagueId).toBe(leagueId);
    expect(result!.chain.ids).toEqual(chain.ids);
    expect(Array.isArray(result!.weights)).toBe(true);
    expect(result!.weights.length).toBeGreaterThan(0);
  });

  it('weights match direct computePlayerWeights call', async () => {
    const [facade, direct] = await Promise.all([
      analyzeTeamPower(prisma, TEAM_ID, SEASON),
      computePlayerWeights(prisma, TEAM_ID, chain.ids, chain.years),
    ]);
    expect(facade!.weights.length).toBe(direct.length);
    // Top player by weight should be the same
    const facadeTop = facade!.weights.reduce((a, b) => a.weight > b.weight ? a : b);
    const directTop = direct.reduce((a, b) => a.weight > b.weight ? a : b);
    expect(facadeTop.playerId).toBe(directTop.playerId);
  });
});

// ── analyzeInjuryImpact ───────────────────────────────────────────────────────

describe('analyzeInjuryImpact(prisma, teamId=11, season=2025)', () => {
  it('returns non-null result with leagueId, chain, rich, outcomeImpact', async () => {
    const result = await analyzeInjuryImpact(prisma, TEAM_ID, SEASON);
    expect(result).not.toBeNull();
    expect(result!.leagueId).toBe(leagueId);
    expect(result!.chain.ids).toEqual(chain.ids);
    expect(result!.rich).toHaveProperty('enrichedInjuredPlayers');
    expect(result!.rich).toHaveProperty('powerLoss');
    // outcomeImpact may be null if no injured players or missing stats, just check it's the right type
    if (result!.outcomeImpact !== null) {
      expect(result!.outcomeImpact).toHaveProperty('baseline');
      expect(result!.outcomeImpact).toHaveProperty('depleted');
    }
  });

  it('rich results match direct computeRichInjuryImpact call', async () => {
    const [facade, direct] = await Promise.all([
      analyzeInjuryImpact(prisma, TEAM_ID, SEASON),
      computeRichInjuryImpact(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null),
    ]);
    expect(direct).not.toBeNull();
    expect(facade!.rich.powerLoss.totalWeight).toBe(direct!.powerLoss.totalWeight);
    expect(facade!.rich.powerLoss.powerLossPct).toBe(direct!.powerLoss.powerLossPct);
    expect(facade!.rich.enrichedInjuredPlayers.length).toBe(direct!.enrichedInjuredPlayers.length);
  });
});

// ── analyzePredictedLineup ────────────────────────────────────────────────────

describe('analyzePredictedLineup(prisma, teamId=11, season=2025)', () => {
  it('returns non-null result with lineup', async () => {
    const result = await analyzePredictedLineup(prisma, TEAM_ID, SEASON);
    expect(result).not.toBeNull();
    expect(result!.leagueId).toBe(leagueId);
    expect(result!.lineup).toHaveProperty('formation');
    expect(result!.lineup).toHaveProperty('starters');
    expect(Array.isArray(result!.lineup.starters)).toBe(true);
  });

  it('lineup matches direct computePredictedLineup call', async () => {
    const [facade, direct] = await Promise.all([
      analyzePredictedLineup(prisma, TEAM_ID, SEASON),
      computePredictedLineup(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null),
    ]);
    expect(direct).not.toBeNull();
    expect(facade!.lineup.formation).toBe(direct!.formation);
    expect(facade!.lineup.starters.length).toBe(direct!.starters.length);
  });
});

// ── analyzeTeamImpactReport ───────────────────────────────────────────────────

describe('analyzeTeamImpactReport(prisma, teamId=11, season=2025)', () => {
  it('returns non-null result with powerLoss', async () => {
    const result = await analyzeTeamImpactReport(prisma, TEAM_ID, SEASON);
    expect(result).not.toBeNull();
    expect(result!.leagueId).toBe(leagueId);
    expect(result!.powerLoss).toHaveProperty('enrichedInjuredPlayers');
    expect(result!.powerLoss).toHaveProperty('healthyTopPlayers');
    expect(result!.powerLoss).toHaveProperty('totalWeight');
    expect(result!.powerLoss).toHaveProperty('powerLossPct');
  });

  it('powerLoss matches direct computeTeamPowerLoss call', async () => {
    const [facade, direct] = await Promise.all([
      analyzeTeamImpactReport(prisma, TEAM_ID, SEASON),
      computeTeamPowerLoss(prisma, TEAM_ID, chain.ids, chain.years, SEASON),
    ]);
    expect(direct).not.toBeNull();
    expect(facade!.powerLoss.totalWeight).toBe(direct!.totalWeight);
    expect(facade!.powerLoss.powerLossPct).toBe(direct!.powerLossPct);
    expect(facade!.powerLoss.enrichedInjuredPlayers.length).toBe(direct!.enrichedInjuredPlayers.length);
  });
});

// ── analyzePlayerImpact ───────────────────────────────────────────────────────

describe('analyzePlayerImpact(prisma, teamId=11, playerId=?, season=2025)', () => {
  it('returns non-null result for a player on the team', async () => {
    // Pick the top-weight player from analyzeTeamPower
    const tp = await analyzeTeamPower(prisma, TEAM_ID, SEASON);
    if (!tp || tp.weights.length === 0) return; // skip if no data
    const topPlayer = tp.weights.reduce((a, b) => a.weight > b.weight ? a : b);

    const result = await analyzePlayerImpact(prisma, TEAM_ID, topPlayer.playerId, SEASON);
    expect(result).not.toBeNull();
    expect(result!.leagueId).toBe(leagueId);
    expect(result!.chain.ids).toEqual(chain.ids);
    expect(Array.isArray(result!.weights)).toBe(true);
    // perfDelta may be null for some players
  });
});
