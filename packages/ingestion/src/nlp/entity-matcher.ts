import { PrismaClient } from '@prisma/client';
import { TEAM_ALIASES, PLAYER_NICKNAMES } from './signal-config';

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
  const injuries = await prisma.injury.findMany({
    where: { season },
    select: {
      playerId: true,
      teamId: true,
      player: { select: { name: true } },
      team:   { select: { name: true } },
    },
    distinct: ['playerId'],
  });

  const index = new Map<string, PlayerRecord[]>();

  for (const inj of injuries) {
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
  // Skip exact match (already checked), filter short aliases to avoid false positives
  return aliases.some(alias => {
    const a = normalizeName(alias);
    return a !== normalizedTeam && a.length >= 4 && containsToken(text, a);
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
