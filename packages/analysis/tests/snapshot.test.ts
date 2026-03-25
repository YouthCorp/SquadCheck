/**
 * Phase 1a: Analysis function snapshot tests.
 *
 * Locks in the CURRENT output shape of core analysis functions so regressions
 * are caught during refactoring. Uses real Prisma → real DB (Docker: squadcheck-db-1).
 *
 * Canonical fixture: Tottenham (teamId=11), EPL season=2025.
 * These tests verify shape/existence, NOT specific values (values change as season progresses).
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  resolveActiveInjuries,
  computePlayerWeights,
  computePredictedLineup,
  computeRichInjuryImpact,
} from '../src/index';

const prisma = new PrismaClient();

const TEAM_ID = 11;   // Tottenham
const SEASON = 2025;

/** Resolve season IDs for EPL 2025 (with 2024 lookback) */
async function resolveSeasonChain(leagueId: number, currentYear: number) {
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const seasons = await prisma.season.findMany({
    where: { leagueId, year: { in: years } },
    orderBy: { year: 'desc' },
  });
  const ids: number[] = [];
  const foundYears: number[] = [];
  for (const y of years) {
    const s = seasons.find(s => s.year === y);
    if (s) { ids.push(s.id); foundYears.push(s.year); }
  }
  return { ids, years: foundYears };
}

async function resolveTeamLeague(teamId: number): Promise<number | null> {
  const entry = await prisma.playerSeasonStats.findFirst({
    where: { teamId },
    select: { season: { select: { leagueId: true } } },
    orderBy: { seasonId: 'desc' },
  });
  return entry?.season.leagueId ?? null;
}

let chain: { ids: number[]; years: number[] };
let leagueId: number | null;

beforeAll(async () => {
  leagueId = await resolveTeamLeague(TEAM_ID);
  if (!leagueId) throw new Error('Could not resolve league for Tottenham — is the DB seeded?');
  chain = await resolveSeasonChain(leagueId, SEASON);
  if (chain.ids.length === 0) throw new Error('Could not resolve season chain — is season 2025 seeded?');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── resolveActiveInjuries ─────────────────────────────────────────────────────

describe('resolveActiveInjuries(prisma, teamId=11, season=2025)', () => {
  it('returns a Map (playerId → ActiveInjury)', async () => {
    const result = await resolveActiveInjuries(prisma, TEAM_ID, SEASON);
    expect(result).toBeInstanceOf(Map);
  });

  it('each entry has required ActiveInjury fields', async () => {
    const result = await resolveActiveInjuries(prisma, TEAM_ID, SEASON);
    for (const [playerId, injury] of result) {
      expect(typeof playerId).toBe('number');
      expect(injury).toHaveProperty('playerId');
      expect(injury).toHaveProperty('teamId');
      expect(injury).toHaveProperty('leagueId');
      expect(injury).toHaveProperty('fixtureId');
      expect(injury).toHaveProperty('fixtureDate');
      expect(injury).toHaveProperty('type');
      expect(injury).toHaveProperty('reason');
    }
  });
});

// ── computePlayerWeights ──────────────────────────────────────────────────────

describe('computePlayerWeights(prisma, teamId=11, ...)', () => {
  it('returns a non-empty array of PlayerWeight', async () => {
    const result = await computePlayerWeights(prisma, TEAM_ID, chain.ids, chain.years);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each entry has required fields with correct types', async () => {
    const result = await computePlayerWeights(prisma, TEAM_ID, chain.ids, chain.years);
    const w = result[0];
    expect(typeof w.playerId).toBe('number');
    expect(typeof w.playerName).toBe('string');
    expect(typeof w.weight).toBe('number');
    expect(typeof w.rawWeight).toBe('number');
    expect(typeof w.positionGroup).toBe('string');
    expect(typeof w.dataSource).toBe('string');
    expect(w).toHaveProperty('components');
    expect(w).toHaveProperty('stats');
  });

  it('all weights are non-negative numbers', async () => {
    const result = await computePlayerWeights(prisma, TEAM_ID, chain.ids, chain.years);
    for (const w of result) {
      expect(w.weight).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── computePredictedLineup ────────────────────────────────────────────────────

describe('computePredictedLineup(prisma, teamId=11, ...)', () => {
  it('returns a non-null result with formation and starters', async () => {
    const result = await computePredictedLineup(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('formation');
    expect(typeof result!.formation).toBe('string');
    expect(result).toHaveProperty('starters');
    expect(Array.isArray(result!.starters)).toBe(true);
  });

  it('starters have pitchX, pitchY, slotPosition', async () => {
    const result = await computePredictedLineup(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    if (result && result.starters.length > 0) {
      const s = result.starters[0];
      expect(typeof s.pitchX).toBe('number');
      expect(typeof s.pitchY).toBe('number');
      expect(typeof s.slotPosition).toBe('string');
    }
  });

  it('formation string matches known pattern (e.g. "4-3-3")', async () => {
    const result = await computePredictedLineup(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    if (result) {
      expect(result.formation).toMatch(/^\d[-\d]+$/);
    }
  });
});

// ── computeRichInjuryImpact ───────────────────────────────────────────────────

describe('computeRichInjuryImpact(prisma, teamId=11, ...)', () => {
  it('returns a non-null result with enrichedInjuredPlayers', async () => {
    const result = await computeRichInjuryImpact(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('enrichedInjuredPlayers');
    expect(Array.isArray(result!.enrichedInjuredPlayers)).toBe(true);
  });

  it('powerLoss has required numeric fields', async () => {
    const result = await computeRichInjuryImpact(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    if (result) {
      expect(result).toHaveProperty('powerLoss');
      expect(typeof result.powerLoss.totalWeight).toBe('number');
      expect(typeof result.powerLoss.powerLossPct).toBe('number');
      expect(result.powerLoss.powerLossPct).toBeGreaterThanOrEqual(0);
    }
  });

  it('each enrichedInjuredPlayer has required fields', async () => {
    const result = await computeRichInjuryImpact(prisma, TEAM_ID, chain.ids, chain.years, SEASON, null);
    if (result && result.enrichedInjuredPlayers.length > 0) {
      const p = result.enrichedInjuredPlayers[0];
      expect(typeof p.playerId).toBe('number');
      expect(typeof p.weight).toBe('number');
      expect(typeof p.weightPct).toBe('number');
      expect(p).toHaveProperty('injuryType');
      expect(p).toHaveProperty('severity');
      expect(p).toHaveProperty('positionGroup');
    }
  });
});
