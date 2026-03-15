#!/usr/bin/env node
/**
 * SquadCheck API Sanity Check
 *
 * Validates that key endpoints return correct, logically-sound data.
 * Catches data quality bugs (wrong ordering, disciplinary players in signals,
 * league ID conversion failures, etc.) that compilers and type checkers miss.
 *
 * Usage:
 *   node scripts/check-deploy.js                          # local (localhost:4000)
 *   node scripts/check-deploy.js https://your-api.railway.app  # production
 *
 * Exit code: 0 = all checks passed, 1 = at least one FAIL
 */

const BASE = process.argv[2] || 'http://localhost:4000';

const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

let passed = 0, failed = 0, warnings = 0;

function ok(msg)   { console.log(`  ${GREEN}✓${R} ${msg}`); passed++; }
function fail(msg) { console.log(`  ${RED}✗ FAIL${R} ${msg}`); failed++; }
function warn(msg) { console.log(`  ${YELLOW}⚠ WARN${R} ${msg}`); warnings++; }
function section(title) { console.log(`\n${BOLD}${title}${R}`); }

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DISCIPLINARY_KEYWORDS = ['red card', 'suspended', 'suspension', 'yellow card', 'yellow cards'];
function isDisciplinary(reason) {
  const r = (reason || '').toLowerCase();
  return DISCIPLINARY_KEYWORDS.some((d) => r.includes(d));
}

// ── Check 1: /api/injuries/live-updates ──────────────────────────────────

async function checkLiveUpdates() {
  section('1. /api/injuries/live-updates');
  try {
    const data = await get('/api/injuries/live-updates');

    // Shape
    if (!Array.isArray(data.recentInjuries)) { fail('recentInjuries is not an array'); return; }
    if (!Array.isArray(data.recentSignals))  { fail('recentSignals is not an array');  return; }
    ok(`Shape valid — ${data.recentInjuries.length} injuries, ${data.recentSignals.length} signals`);

    // Disciplinary reasons must not appear
    const disciplinary = data.recentInjuries.filter((e) => isDisciplinary(e.reason));
    if (disciplinary.length > 0) {
      fail(
        `${disciplinary.length} disciplinary entry(ies) in recentInjuries:\n` +
        disciplinary.map((e) => `      ${e.player?.name} (${e.reason})`).join('\n'),
      );
    } else {
      ok('No disciplinary reasons in recentInjuries');
    }

    // No future fixtureDates
    const now = Date.now();
    const future = data.recentInjuries.filter(
      (e) => e.fixtureDate && new Date(e.fixtureDate).getTime() > now,
    );
    if (future.length > 0) {
      fail(
        `${future.length} future fixtureDate(s):\n` +
        future.map((e) => `      ${e.player?.name} → ${e.fixtureDate}`).join('\n'),
      );
    } else {
      ok('No future fixtureDates');
    }

    // Ordering: most recent first (DESC)
    const dates = data.recentInjuries
      .map((e) => new Date(e.fixtureDate).getTime())
      .filter(Boolean);
    const sorted = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    if (!sorted) {
      fail('recentInjuries not sorted DESC by fixtureDate');
    } else {
      ok('recentInjuries ordered correctly (most recent first)');
    }

    // League filter: only top-5 leagues
    const EXPECTED_LEAGUE_IDS = [39, 140, 135, 78, 61];
    const foreignLeague = data.recentInjuries.filter(
      (e) => e.league && !EXPECTED_LEAGUE_IDS.includes(e.league.apiFootballId),
    );
    if (foreignLeague.length > 0) {
      fail(
        `${foreignLeague.length} entry(ies) from non-top-5 leagues:\n` +
        foreignLeague.map((e) => `      ${e.player?.name} — ${e.league?.name} (id ${e.league?.apiFootballId})`).join('\n'),
      );
    } else {
      ok('All injuries are from top-5 leagues only');
    }

    // Recovery signal sanity: suspiciously high probabilities
    const suspicious = data.recentSignals.filter((s) => s.predictedAvailability > 0.97);
    if (suspicious.length > 2) {
      warn(
        `${suspicious.length} signal(s) with predictedAvailability > 97% — possible stale/incorrect signals:\n` +
        suspicious.map((s) => `      ${s.player?.name} ${Math.round(s.predictedAvailability * 100)}%`).join('\n'),
      );
    } else {
      ok('Recovery signal probabilities look reasonable');
    }
  } catch (e) {
    fail(`Request failed: ${e.message}`);
  }
}

// ── Check 2: /api/analysis/injury-impact (league ID conversion) ──────────

async function checkInjuryImpact() {
  section('2. /api/analysis/injury-impact/11?league=39  (EPL apiFootballId=39, Tottenham internal id=11)');
  try {
    const data = await get('/api/analysis/injury-impact/11?league=39');

    if (!data.team) { fail('Missing team field — possible league ID conversion bug'); return; }
    ok(`Team resolved: ${data.team.name}`);

    if (!Array.isArray(data.injuredPlayers)) { fail('injuredPlayers is not an array'); return; }

    // Tottenham reliably has injuries mid-season; empty = probable league-ID bug
    if (data.injuredPlayers.length === 0) {
      warn('injuredPlayers is empty — verify team has no injuries, or check league ID conversion');
    } else {
      ok(`${data.injuredPlayers.length} injured players returned`);
    }

    if (typeof data.powerLossPct !== 'number') {
      fail('powerLossPct is missing or not a number');
    } else {
      ok(`powerLossPct: ${(data.powerLossPct * 100).toFixed(1)}%`);
    }

    // Disciplinary players should not appear in injuredPlayers
    const discInjured = (data.injuredPlayers || []).filter((p) =>
      isDisciplinary(p.injury?.reason),
    );
    if (discInjured.length > 0) {
      warn(
        `${discInjured.length} disciplinary player(s) in injury-impact injuredPlayers:\n` +
        discInjured.map((p) => `      ${p.player?.name} (${p.injury?.reason})`).join('\n'),
      );
    } else {
      ok('No disciplinary players in injuredPlayers list');
    }
  } catch (e) {
    fail(`Request failed: ${e.message}`);
  }
}

// ── Check 3: /api/analysis/predicted-lineup ──────────────────────────────

async function checkPredictedLineup() {
  section('3. /api/analysis/predicted-lineup/11?league=39  (Tottenham)');
  try {
    const data = await get('/api/analysis/predicted-lineup/11?league=39');

    if (!data.formation) { fail('Missing formation field'); return; }
    ok(`Formation: ${data.formation}  (source: ${data.formationSource})`);

    if (!Array.isArray(data.starters)) { fail('starters is not an array'); return; }

    if (data.starters.length !== 11) {
      fail(`Expected 11 starters, got ${data.starters.length}`);
    } else {
      ok('11 starters returned');
    }

    // All starters need pitch coordinates for the visualization
    const missingCoords = data.starters.filter((s) => s.pitchX == null || s.pitchY == null);
    if (missingCoords.length > 0) {
      fail(`${missingCoords.length} starter(s) missing pitchX/Y: ${missingCoords.map((s) => s.playerName).join(', ')}`);
    } else {
      ok('All starters have pitch coordinates');
    }

    // No duplicate players
    const playerIds = data.starters.map((s) => s.playerId);
    const unique = new Set(playerIds);
    if (unique.size !== playerIds.length) {
      fail(`Duplicate player(s) in starters (${playerIds.length} total, ${unique.size} unique)`);
    } else {
      ok('No duplicate players in starters');
    }
  } catch (e) {
    fail(`Request failed: ${e.message}`);
  }
}

// ── Check 4: /api/fixtures/upcoming ─────────────────────────────────────

async function checkFixtures() {
  section('4. /api/fixtures/upcoming');
  try {
    const data = await get('/api/fixtures/upcoming?all=true');

    if (!Array.isArray(data)) { fail('Response is not an array'); return; }

    if (data.length === 0) {
      warn('No upcoming fixtures — may be off-season or data gap');
      return;
    }
    ok(`${data.length} upcoming fixtures`);

    const first = data[0];
    if (!first.homeTeam || !first.awayTeam) {
      fail('Fixture missing homeTeam / awayTeam fields');
    } else {
      ok(`Sample: ${first.homeTeam.name} vs ${first.awayTeam.name} (${(first.date || '').slice(0, 10)})`);
    }

    // All fixtures should have future dates (upcoming)
    const past = data.filter((f) => f.date && new Date(f.date).getTime() < Date.now() - 3_600_000);
    if (past.length > 0) {
      warn(`${past.length} fixture(s) appear to be in the past (check upcoming filter)`);
    }
  } catch (e) {
    fail(`Request failed: ${e.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}SquadCheck API Sanity Check${R}`);
  console.log(`${DIM}Target: ${BASE}${R}`);

  await checkLiveUpdates();
  await checkInjuryImpact();
  await checkPredictedLineup();
  await checkFixtures();

  const bar = '─'.repeat(52);
  console.log(`\n${bar}`);
  const summary = [
    `${GREEN}${passed} passed${R}`,
    failed > 0 ? `${RED}${failed} failed${R}` : `${DIM}${failed} failed${R}`,
    warnings > 0 ? `${YELLOW}${warnings} warnings${R}` : `${DIM}${warnings} warnings${R}`,
  ].join('  ');
  console.log(summary);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}✗  DEPLOY CHECK FAILED${R}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}✓  All checks passed${R}${warnings > 0 ? ` ${YELLOW}(${warnings} warning${warnings > 1 ? 's' : ''})${R}` : ''}\n`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(`\n${RED}Fatal error: ${e.message}${R}`);
  process.exit(1);
});
