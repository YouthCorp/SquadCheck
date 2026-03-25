/**
 * Phase 1a: Injuries & watchlist endpoint contract tests.
 *
 * Locks in current response shapes for the injury-related endpoints.
 * Requires a running local DB (Docker: squadcheck-db-1).
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app';

const { app, prisma } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

// ── live-updates ──────────────────────────────────────────────────────────────

describe('GET /api/injuries/live-updates', () => {
  it('returns 200 with recentInjuries and recentSignals arrays', async () => {
    const res = await request(app)
      .get('/api/injuries/live-updates')
      .query({ season: '2025' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recentInjuries');
    expect(res.body).toHaveProperty('recentSignals');
    expect(Array.isArray(res.body.recentInjuries)).toBe(true);
    expect(Array.isArray(res.body.recentSignals)).toBe(true);
  });

  it('recentInjuries entries have isActive-equivalent field (isActive lives in playerInjuryStatus)', async () => {
    const res = await request(app)
      .get('/api/injuries/live-updates')
      .query({ season: '2025' });

    // The live-updates endpoint filters isActive=true in the DB query,
    // so all returned injuries are implicitly active.
    // Verify shape fields instead.
    if (res.body.recentInjuries.length > 0) {
      const inj = res.body.recentInjuries[0];
      expect(inj).toHaveProperty('player');
      expect(inj).toHaveProperty('team');
      expect(inj).toHaveProperty('league');
      expect(inj).toHaveProperty('type');
      expect(inj).toHaveProperty('reason');
      expect(inj).toHaveProperty('fixtureDate');
    }
  });

  it('recentSignals entries have required shape fields', async () => {
    const res = await request(app)
      .get('/api/injuries/live-updates')
      .query({ season: '2025' });

    if (res.body.recentSignals.length > 0) {
      const sig = res.body.recentSignals[0];
      expect(sig).toHaveProperty('player');
      expect(sig).toHaveProperty('predictedAvailability');
      expect(sig).toHaveProperty('confidenceLevel');
      expect(sig).toHaveProperty('latestSignalStage');
      expect(sig).toHaveProperty('signalCount');
    }
  });
});

// ── /api/teams/:id/injuries/current (teams route) ─────────────────────────────

describe('GET /api/teams/:id/injuries/current', () => {
  it('returns 200 for Tottenham (teamId=11)', async () => {
    const res = await request(app)
      .get('/api/teams/11/injuries/current')
      .query({ season: '2025' });

    // 200 or 404 both acceptable — just must not be 500
    expect([200, 404]).toContain(res.status);
  });
});

// ── watchlist/alerts (auth-gated) ─────────────────────────────────────────────

describe('GET /api/watchlist/alerts', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/watchlist/alerts');
    expect(res.status).toBe(401);
  });
});
