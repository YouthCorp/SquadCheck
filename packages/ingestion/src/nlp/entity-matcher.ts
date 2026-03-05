import { PrismaClient } from '@prisma/client';

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
  }

  return index;
}

/**
 * Attempts to match a news article to a specific injured player + team.
 *
 * Rules:
 * 1. Both player name AND team name must appear in the article text.
 * 2. Player name must be ≥4 chars after normalisation.
 * 3. If multiple players from different teams match, skip (ambiguous).
 * 4. If multiple players from the SAME team match, skip (ambiguous).
 */
export function matchEntities(
  articleText: string,
  injuredIndex: Map<string, PlayerRecord[]>,
): EntityMatchResult {
  const text = normalizeName(articleText);
  const candidates: PlayerRecord[] = [];

  for (const [nameKey, players] of injuredIndex) {
    // Minimum name length guard
    if (nameKey.length < 4) continue;

    // Check that the player name token appears in the article
    if (!containsToken(text, nameKey)) continue;

    for (const player of players) {
      // Team name must also appear in the article
      const teamKey = normalizeName(player.teamName);
      if (!containsToken(text, teamKey)) continue;

      candidates.push(player);
    }
  }

  if (candidates.length === 0) return { matched: false };

  // Deduplicate by playerId
  const uniqueByPlayerId = new Map<number, PlayerRecord>();
  for (const c of candidates) {
    uniqueByPlayerId.set(c.id, c);
  }
  const unique = [...uniqueByPlayerId.values()];

  // Ambiguous: multiple distinct players matched
  if (unique.length > 1) return { matched: false };

  const player = unique[0];
  return {
    matched:    true,
    playerId:   player.id,
    teamId:     player.teamId,
    playerName: player.name,
    teamName:   player.teamName,
  };
}

// ── Helpers ──

function normalizeName(s: string): string {
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
