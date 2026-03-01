import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

// ── Statistics ───────────────────────────────
interface ApiStatItem {
  type: string;
  value: number | string | null;
}

interface ApiFixtureStats {
  team: { id: number };
  statistics: ApiStatItem[];
}

// ── Lineups ─────────────────────────────────
interface ApiLineupPlayer {
  player: { id: number; name: string; number: number | null; pos: string | null; grid: string | null };
}

interface ApiLineup {
  team: { id: number };
  coach: { id: number; name: string } | null;
  formation: string | null;
  startXI: ApiLineupPlayer[];
  substitutes: ApiLineupPlayer[];
}

// ── Events ──────────────────────────────────
interface ApiEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string | null;
  comments: string | null;
}

// ── Player Stats ────────────────────────────
interface ApiFixturePlayer {
  player: { id: number; name: string; photo: string };
  statistics: Array<{
    games: { minutes: number | null; position: string | null; rating: string | null; captain: boolean; substitute: boolean };
    shots: { total: number | null; on: number | null };
    goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
    passes: { total: number | null; key: number | null; accuracy: string | null };
    tackles: { total: number | null; blocks: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null; past: number | null };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number; red: number };
  }>;
}

interface ApiFixturePlayersResponse {
  team: { id: number };
  players: ApiFixturePlayer[];
}

export class FixtureDetailCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collectStatistics(fixtureApiId: number, fixtureDbId: number): Promise<void> {
    const res = await this.api.request<ApiFixtureStats>('/fixtures/statistics', { fixture: fixtureApiId });

    for (const item of res.response) {
      const team = await this.prisma.team.findUnique({ where: { apiFootballId: item.team.id } });
      if (!team) continue;

      const stats = this.parseStats(item.statistics);

      await this.prisma.fixtureStatistics.upsert({
        where: { fixtureId_teamId: { fixtureId: fixtureDbId, teamId: team.id } },
        create: { fixtureId: fixtureDbId, teamId: team.id, ...stats },
        update: stats,
      });
    }
  }

  async collectLineups(fixtureApiId: number, fixtureDbId: number): Promise<void> {
    const res = await this.api.request<ApiLineup>('/fixtures/lineups', { fixture: fixtureApiId });

    for (const item of res.response) {
      const team = await this.prisma.team.findUnique({ where: { apiFootballId: item.team.id } });
      if (!team) continue;

      const lineup = await this.prisma.fixtureLineup.upsert({
        where: { fixtureId_teamId: { fixtureId: fixtureDbId, teamId: team.id } },
        create: {
          fixtureId: fixtureDbId,
          teamId: team.id,
          formation: item.formation,
          coachId: item.coach?.id,
          coachName: item.coach?.name,
        },
        update: {
          formation: item.formation,
          coachName: item.coach?.name,
        },
      });

      // Delete existing lineup players and re-insert
      await this.prisma.fixtureLineupPlayer.deleteMany({ where: { lineupId: lineup.id } });

      const allPlayers = [
        ...item.startXI.map((p) => ({ ...p, isStarting: true })),
        ...item.substitutes.map((p) => ({ ...p, isStarting: false })),
      ];

      for (const p of allPlayers) {
        const player = await this.ensurePlayer(p.player.id, p.player.name);
        await this.prisma.fixtureLineupPlayer.create({
          data: {
            lineupId: lineup.id,
            playerId: player.id,
            playerName: p.player.name,
            number: p.player.number,
            position: p.player.pos,
            grid: p.player.grid,
            isStarting: p.isStarting,
          },
        });
      }
    }
  }

  async collectEvents(fixtureApiId: number, fixtureDbId: number): Promise<void> {
    const res = await this.api.request<ApiEvent>('/fixtures/events', { fixture: fixtureApiId });

    // Delete existing and re-insert
    await this.prisma.fixtureEvent.deleteMany({ where: { fixtureId: fixtureDbId } });

    for (const item of res.response) {
      const playerId = item.player.id ? (await this.ensurePlayer(item.player.id, item.player.name || '')).id : null;
      const assistId = item.assist.id ? (await this.ensurePlayer(item.assist.id, item.assist.name || '')).id : null;

      await this.prisma.fixtureEvent.create({
        data: {
          fixtureId: fixtureDbId,
          teamId: (await this.prisma.team.findUnique({ where: { apiFootballId: item.team.id } }))?.id,
          playerId,
          assistId,
          type: item.type,
          detail: item.detail,
          comments: item.comments,
          timeElapsed: item.time.elapsed,
          timeExtra: item.time.extra,
        },
      });
    }
  }

  async collectPlayerStats(fixtureApiId: number, fixtureDbId: number): Promise<void> {
    const res = await this.api.request<ApiFixturePlayersResponse>('/fixtures/players', { fixture: fixtureApiId });

    for (const teamData of res.response) {
      const team = await this.prisma.team.findUnique({ where: { apiFootballId: teamData.team.id } });

      for (const p of teamData.players) {
        const player = await this.ensurePlayer(p.player.id, p.player.name);
        const s = p.statistics[0];
        if (!s) continue;

        await this.prisma.fixturePlayerStats.upsert({
          where: { fixtureId_playerId: { fixtureId: fixtureDbId, playerId: player.id } },
          create: {
            fixtureId: fixtureDbId,
            playerId: player.id,
            teamId: team?.id,
            minutes: s.games.minutes,
            position: s.games.position,
            rating: s.games.rating ? parseFloat(s.games.rating) : null,
            captain: s.games.captain,
            substitute: s.games.substitute,
            shotsTotal: s.shots.total,
            shotsOn: s.shots.on,
            goalsTotal: s.goals.total,
            goalsConceded: s.goals.conceded,
            assists: s.goals.assists,
            saves: s.goals.saves,
            passesTotal: s.passes.total,
            passesKey: s.passes.key,
            passesAccuracy: s.passes.accuracy ? parseInt(s.passes.accuracy) : null,
            tacklesTotal: s.tackles.total,
            tacklesBlocks: s.tackles.blocks,
            interceptions: s.tackles.interceptions,
            duelsTotal: s.duels.total,
            duelsWon: s.duels.won,
            dribblesAttempts: s.dribbles.attempts,
            dribblesSuccess: s.dribbles.success,
            dribblesPast: s.dribbles.past,
            foulsDrawn: s.fouls.drawn,
            foulsCommitted: s.fouls.committed,
            yellowCards: s.cards.yellow,
            redCards: s.cards.red,
          },
          update: {
            rating: s.games.rating ? parseFloat(s.games.rating) : null,
            minutes: s.games.minutes,
          },
        });
      }
    }
  }

  // ── Helpers ──────────────────────────────────

  private async ensurePlayer(apiId: number, name: string) {
    return this.prisma.player.upsert({
      where: { apiFootballId: apiId },
      create: { apiFootballId: apiId, name },
      update: {},
    });
  }

  private parseStats(stats: ApiStatItem[]): Record<string, number | null> {
    const map: Record<string, string> = {
      'Shots on Goal': 'shotsOnGoal',
      'Shots off Goal': 'shotsOffGoal',
      'Total Shots': 'totalShots',
      'Blocked Shots': 'blockedShots',
      'Shots insidebox': 'shotsInsideBox',
      'Shots outsidebox': 'shotsOutsideBox',
      Fouls: 'fouls',
      'Corner Kicks': 'cornerKicks',
      Offsides: 'offsides',
      'Ball Possession': 'possession',
      'Yellow Cards': 'yellowCards',
      'Red Cards': 'redCards',
      'Goalkeeper Saves': 'goalkeeperSaves',
      'Total passes': 'totalPasses',
      'Passes accurate': 'passesAccurate',
      'Passes %': 'passPercent',
      expected_goals: 'expectedGoals',
      goals_prevented: 'goalsPrevented',
    };

    const result: Record<string, number | null> = {};
    for (const item of stats) {
      const key = map[item.type];
      if (!key) continue;

      if (item.value === null) {
        result[key] = null;
      } else if (typeof item.value === 'string') {
        result[key] = parseFloat(item.value.replace('%', ''));
      } else {
        result[key] = item.value;
      }
    }

    return result;
  }
}
