/**
 * Phase 1a: Analysis endpoint contract tests.
 *
 * These tests lock in the CURRENT response shape so regressions are caught
 * immediately during refactoring. They do NOT test business logic correctness —
 * only that required fields exist and HTTP status codes are correct.
 *
 * Uses Tottenham (teamId=11, season=2025) as the canonical test fixture.
 * Requires a running local DB (Docker: squadcheck-db-1).
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app';

const { app, prisma } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

// ── team-power ────────────────────────────────────────────────────────────────

describe('GET /api/analysis/team-power/:teamId', () => {
  it('returns 200 with required fields for valid team', async () => {
    const res = await request(app)
      .get('/api/analysis/team-power/11')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('team');
    expect(res.body).toHaveProperty('season');
    expect(res.body).toHaveProperty('players');
    expect(res.body).toHaveProperty('totalWeight');
    expect(Array.isArray(res.body.players)).toBe(true);
  });

  it('returns 404 for non-existent team', async () => {
    const res = await request(app)
      .get('/api/analysis/team-power/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });

  it('uses season param correctly (2024 vs 2025)', async () => {
    const [r2024, r2025] = await Promise.all([
      request(app).get('/api/analysis/team-power/11').query({ season: '2024' }),
      request(app).get('/api/analysis/team-power/11').query({ season: '2025' }),
    ]);
    expect(r2024.status).toBe(200);
    expect(r2025.status).toBe(200);
    expect(r2024.body.season).toBe(2024);
    expect(r2025.body.season).toBe(2025);
  });

  it('player entries have required shape fields', async () => {
    const res = await request(app)
      .get('/api/analysis/team-power/11')
      .query({ season: '2025' });

    if (res.body.players.length > 0) {
      const p = res.body.players[0];
      expect(p).toHaveProperty('player');
      expect(p).toHaveProperty('position');
      expect(p).toHaveProperty('positionGroup');
      expect(p).toHaveProperty('weight');
      expect(p).toHaveProperty('dataSource');
      expect(p).toHaveProperty('components');
    }
  });
});

// ── injury-impact ─────────────────────────────────────────────────────────────

describe('GET /api/analysis/injury-impact/:teamId', () => {
  it('returns 200 with required fields', async () => {
    const res = await request(app)
      .get('/api/analysis/injury-impact/11')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('team');
    expect(res.body).toHaveProperty('season');
    expect(res.body).toHaveProperty('powerLossPct');
    expect(res.body).toHaveProperty('injuredPlayers');
    expect(Array.isArray(res.body.injuredPlayers)).toBe(true);
  });

  it('injuredPlayers entries have required shape fields', async () => {
    const res = await request(app)
      .get('/api/analysis/injury-impact/11')
      .query({ season: '2025' });

    if (res.body.injuredPlayers.length > 0) {
      const p = res.body.injuredPlayers[0];
      expect(p).toHaveProperty('player');
      expect(p).toHaveProperty('weight');
      expect(p).toHaveProperty('weightPct');
      expect(p).toHaveProperty('positionGroup');
      expect(p).toHaveProperty('injury');
      expect(p.injury).toHaveProperty('type');
      expect(p.injury).toHaveProperty('reason');
      expect(p.injury).toHaveProperty('date');
      expect(p).toHaveProperty('severity');
      expect(p).toHaveProperty('stats');
      expect(p.stats).toHaveProperty('goals');
      expect(p.stats).toHaveProperty('assists');
      expect(p.stats).toHaveProperty('minutes');
      expect(p.stats).toHaveProperty('appearances');
    }
  });

  it('returns 404 for non-existent team', async () => {
    const res = await request(app)
      .get('/api/analysis/injury-impact/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });

  it('league filter param is accepted without error', async () => {
    const res = await request(app)
      .get('/api/analysis/injury-impact/11')
      .query({ season: '2025', league: '39' });

    expect(res.status).toBe(200);
  });
});

// ── predicted-lineup ──────────────────────────────────────────────────────────

describe('GET /api/analysis/predicted-lineup/:teamId', () => {
  it('returns 200 with required fields', async () => {
    const res = await request(app)
      .get('/api/analysis/predicted-lineup/11')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('formation');
    expect(res.body).toHaveProperty('starters');
    expect(Array.isArray(res.body.starters)).toBe(true);
  });

  it('starters have pitchX and pitchY coordinates', async () => {
    const res = await request(app)
      .get('/api/analysis/predicted-lineup/11')
      .query({ season: '2025' });

    if (res.body.starters && res.body.starters.length > 0) {
      const s = res.body.starters[0];
      expect(s).toHaveProperty('pitchX');
      expect(s).toHaveProperty('pitchY');
      expect(s).toHaveProperty('slotPosition');
      expect(typeof s.pitchX).toBe('number');
      expect(typeof s.pitchY).toBe('number');
    }
  });

  it('returns 404 for non-existent team', async () => {
    const res = await request(app)
      .get('/api/analysis/predicted-lineup/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });
});

// ── player-impact ─────────────────────────────────────────────────────────────

describe('GET /api/analysis/player-impact/:playerId', () => {
  it('returns 404 for non-existent player', async () => {
    const res = await request(app)
      .get('/api/analysis/player-impact/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });

  it('returns 200 with delta fields for valid player+team', async () => {
    // Find a real playerId for Tottenham from team-power first
    const powerRes = await request(app)
      .get('/api/analysis/team-power/11')
      .query({ season: '2025' });

    if (powerRes.body.players?.length > 0) {
      const playerId = powerRes.body.players[0].player.id;
      const res = await request(app)
        .get(`/api/analysis/player-impact/${playerId}`)
        .query({ season: '2025', teamId: '11' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('player');
      expect(res.body).toHaveProperty('season');
    }
  });
});

// ── team-impact-report ────────────────────────────────────────────────────────

describe('GET /api/analysis/team-impact-report/:teamId', () => {
  it('returns 200 with required composite fields', async () => {
    const res = await request(app)
      .get('/api/analysis/team-impact-report/11')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('team');
    expect(res.body).toHaveProperty('season');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('injuredPlayers');
    expect(res.body).toHaveProperty('healthyTopPlayers');
    expect(res.body.summary).toHaveProperty('totalWeight');
    expect(res.body.summary).toHaveProperty('powerLossPct');
    expect(Array.isArray(res.body.injuredPlayers)).toBe(true);
    expect(Array.isArray(res.body.healthyTopPlayers)).toBe(true);
  });

  it('returns 404 for non-existent team', async () => {
    const res = await request(app)
      .get('/api/analysis/team-impact-report/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });
});

// ── recovery-signals ──────────────────────────────────────────────────────────

describe('GET /api/analysis/recovery-signals/:teamId', () => {
  it('returns 200 with required fields', async () => {
    const res = await request(app)
      .get('/api/analysis/recovery-signals/11')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('team');
    expect(res.body).toHaveProperty('season');
    expect(res.body).toHaveProperty('playerAvailabilities');
    expect(res.body).toHaveProperty('recentSignals');
    expect(Array.isArray(res.body.playerAvailabilities)).toBe(true);
    expect(Array.isArray(res.body.recentSignals)).toBe(true);
  });

  it('returns 404 for non-existent team', async () => {
    const res = await request(app)
      .get('/api/analysis/recovery-signals/99999')
      .query({ season: '2025' });

    expect(res.status).toBe(404);
  });
});
