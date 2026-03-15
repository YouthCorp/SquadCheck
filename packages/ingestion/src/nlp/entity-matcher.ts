import { PrismaClient } from '@prisma/client';
import { TEAM_ALIASES, PLAYER_NICKNAMES, DISCIPLINARY_REASONS } from './signal-config';

export interface PlayerRecord {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
}

export interface EntityMatchResult {
  matched: boolean;
  playerId?: number;
  teamId?: number;
  playerName?: string;
  teamName?: string;
  entityConfidence?: number;  // 1.0 (exact) | 0.85 (alias) | 0.65 (fuzzy)
  matchTier?: 'exact' | 'alias' | 'fuzzy';
}

/**
 * Loads currently-injured players for all active teams into memory.
 * Returned map: normalizedPlayerName → PlayerRecord[]
 * (Multiple players may share the same normalised name across different teams)
 */
export async function buildInjuredPlayerIndex(
  prisma: PrismaClient,
  season: number,
): Promise<Map<string, PlayerRecord[]>> {
  // Exclude disciplinary absences (red card, suspension, yellow card bans).
  // These are fixed-match bans, not injuries — they don't need recovery signals.
  // A player with both a real injury AND a suspension in the same season is still
  // included because the NOT filter removes only disciplinary rows; the injury row remains.
  const injuries = await prisma.injury.findMany({
    where: {
      season,
      NOT: {
        OR: DISCIPLINARY_REASONS.map((r) => ({
          reason: { contains: r, mode: 'insensitive' as const },
        })),
      },
    },
    select: {
      playerId: true,
      teamId: true,
      fixtureDate: true,
      player: { select: { name: true } },
      team:   { select: { name: true } },
    },
    distinct: ['playerId'],
    orderBy: { fixtureDate: 'desc' },
  });

  // Filter out players who have since returned to play.
  // A player is considered "recovered" if they appeared in any fixture lineup
  // after the date of their most recent injury.
  const playerIds = injuries.map((i) => i.playerId);
  const injuryStartByPlayer = new Map(injuries.map((i) => [i.playerId, i.fixtureDate]));

  const lineupAppearances = playerIds.length > 0
    ? await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: playerIds },
          lineup: {
            fixture: {
              season,
              date: { gte: new Date(Date.now() - 90 * 86_400_000) },
            },
          },
        },
        select: {
          playerId: true,
          lineup: { select: { fixture: { select: { date: true } } } },
        },
      })
    : [];

  const returnedIds = new Set<number>();
  for (const app of lineupAppearances) {
    const injuryStart = injuryStartByPlayer.get(app.playerId);
    if (injuryStart && app.lineup.fixture.date > injuryStart) {
      returnedIds.add(app.playerId);
    }
  }

  const activeInjuries = injuries.filter((i) => !returnedIds.has(i.playerId));

  const index = new Map<string, PlayerRecord[]>();

  for (const inj of activeInjuries) {
    const key = normalizeName(inj.player.name);
    const entry: PlayerRecord = {
      id:       inj.playerId,
      name:     inj.player.name,
      teamId:   inj.teamId,
      teamName: inj.team.name,
    };
    const existing = index.get(key) ?? [];
    existing.push(entry);
    index.set(key, existing);

    // Also index by last name if it is ≥4 chars and differs from full name key
    const lastName = lastNameKey(inj.player.name);
    if (lastName && lastName !== key) {
      const byLast = index.get(lastName) ?? [];
      byLast.push(entry);
      index.set(lastName, byLast);
    }

    // Index by nicknames from dictionary (min length 3 — explicit dictionary entries are safe)
    const nicknames = PLAYER_NICKNAMES[key];
    if (nicknames) {
      for (const nick of nicknames) {
        const nickKey = normalizeName(nick);
        if (nickKey.length < 3) continue;
        const byNick = index.get(nickKey) ?? [];
        byNick.push(entry);
        index.set(nickKey, byNick);
      }
    }
  }

  return index;
}

/**
 * Attempts to match a news article to a specific injured player + team.
 *
 * 3-Tier matching:
 * - Tier 1: Exact normalized match (entityConfidence = 1.0)
 * - Tier 2: Team alias match (entityConfidence = 0.85)
 * - Tier 3: Fuzzy token match — all name tokens present (entityConfidence = 0.65)
 *
 * Rules:
 * 1. Both player name AND team name must appear in the article text.
 * 2. Player name must be ≥4 chars after normalisation (3 for nickname entries).
 * 3. If multiple players from different teams match, skip (ambiguous).
 * 4. If multiple players from the SAME team match, skip (ambiguous).
 */
export function matchEntities(
  articleText: string,
  injuredIndex: Map<string, PlayerRecord[]>,
): EntityMatchResult {
  const text = normalizeName(articleText);
  const candidates: Array<PlayerRecord & { tier: 'exact' | 'alias' | 'fuzzy' }> = [];

  // ── Tier 1 & 2: index-based lookup (exact name / last name / nickname) ──
  for (const [nameKey, players] of injuredIndex) {
    if (nameKey.length < 4) continue;

    if (!containsToken(text, nameKey)) continue;

    for (const player of players) {
      // Tier 1: exact team name in article
      if (matchTeamInText(text, player.teamName, false)) {
        candidates.push({ ...player, tier: 'exact' });
        continue;
      }
      // Tier 2: team alias match
      if (matchTeamInText(text, player.teamName, true)) {
        candidates.push({ ...player, tier: 'alias' });
      }
    }
  }

  // ── Tier 3: Fuzzy (token reorder) — only if no candidates yet ──
  if (candidates.length === 0) {
    for (const [, players] of injuredIndex) {
      for (const player of players) {
        const fullKey = normalizeName(player.name);
        if (!fuzzyNameMatch(text, fullKey)) continue;

        // Team must appear (exact or alias)
        const teamMatch =
          matchTeamInText(text, player.teamName, false) ||
          matchTeamInText(text, player.teamName, true);
        if (!teamMatch) continue;

        candidates.push({ ...player, tier: 'fuzzy' });
      }
    }
  }

  if (candidates.length === 0) return { matched: false };

  // Deduplicate by playerId — keep highest tier (exact > alias > fuzzy)
  const tierRank = { exact: 0, alias: 1, fuzzy: 2 };
  const uniqueByPlayerId = new Map<number, typeof candidates[0]>();
  for (const c of candidates) {
    const existing = uniqueByPlayerId.get(c.id);
    if (!existing || tierRank[c.tier] < tierRank[existing.tier]) {
      uniqueByPlayerId.set(c.id, c);
    }
  }
  const unique = [...uniqueByPlayerId.values()];

  // Ambiguous: multiple distinct players matched
  if (unique.length > 1) return { matched: false };

  const player = unique[0];
  const entityConfidence = player.tier === 'exact' ? 1.0
    : player.tier === 'alias' ? 0.85
    : 0.65;

  return {
    matched:          true,
    playerId:         player.id,
    teamId:           player.teamId,
    playerName:       player.name,
    teamName:         player.teamName,
    entityConfidence,
    matchTier:        player.tier,
  };
}

// ── Helpers ──

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastNameKey(fullName: string): string | null {
  const parts = normalizeName(fullName).split(' ');
  const last = parts[parts.length - 1];
  return last && last.length >= 4 ? last : null;
}

/**
 * Checks that `token` appears as a whole word (or phrase) in `text`.
 */
function containsToken(text: string, token: string): boolean {
  // Escape regex metacharacters in the token
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
  return re.test(text);
}

/**
 * Checks whether the team name or its aliases appear in the article text.
 * aliasesOnly=false → only exact normalized team name
 * aliasesOnly=true  → only aliases (skips exact — use after exact check)
 */
function matchTeamInText(text: string, teamName: string, aliasesOnly: boolean): boolean {
  const normalizedTeam = normalizeName(teamName);

  if (!aliasesOnly) {
    return containsToken(text, normalizedTeam);
  }

  const aliases = TEAM_ALIASES[normalizedTeam];
  if (!aliases) return false;
  // Skip exact match (already checked).
  // Allow >=3 chars: acronyms like 'psg', 'bvb', 'hsv' are team-specific — team+player
  // co-occurrence requirement prevents false positives from 3-letter strings.
  return aliases.some(alias => {
    const a = normalizeName(alias);
    return a !== normalizedTeam && a.length >= 3 && containsToken(text, a);
  });
}

/**
 * Tier 3: all name tokens (≥3 chars) must appear in the article text.
 * Only used when Tier 1 and Tier 2 both fail.
 */
function fuzzyNameMatch(text: string, fullNameKey: string): boolean {
  const tokens = fullNameKey.split(' ').filter(t => t.length >= 3);
  if (tokens.length < 2) return false; // single-token names excluded
  return tokens.every(token => containsToken(text, token));
}
