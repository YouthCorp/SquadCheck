import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiPlayerResponse {
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    nationality: string | null;
    age: number | null;
    birth: { date: string | null };
    height: string | null;
    weight: string | null;
    photo: string | null;
    injured: boolean;
  };
  statistics: Array<{
    team: { id: number; name: string };
    league: { id: number; season: number };
    games: {
      appearences: number | null;
      lineups: number | null;
      minutes: number | null;
      position: string | null;
      rating: string | null;
      captain: boolean;
    };
    goals: { total: number | null; assists: number | null };
    shots: { total: number | null; on: number | null };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    tackles: { total: number | null; blocks: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number | null; red: number | null };
    penalty: { scored: number | null; missed: number | null };
  }>;
}

function decodeHtml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export class PlayerCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(teamApiId: number, season: number, leagueApiId: number): Promise<number> {
    const allPlayers = await this.api.requestAllPages<ApiPlayerResponse>('/players', {
      team: teamApiId,
      season,
    });

    const team = await this.prisma.team.findUnique({ where: { apiFootballId: teamApiId } });
    if (!team) return 0;

    const seasonRecord = await this.prisma.season.findFirst({
      where: { league: { apiFootballId: leagueApiId }, year: season },
    });
    if (!seasonRecord) return 0;

    let count = 0;

    for (const item of allPlayers) {
      const player = await this.prisma.player.upsert({
        where: { apiFootballId: item.player.id },
        create: {
          apiFootballId: item.player.id,
          name: decodeHtml(item.player.name),
          firstName: item.player.firstname,
          lastName: item.player.lastname,
          nationality: item.player.nationality,
          birthDate: item.player.birth?.date ? new Date(item.player.birth.date) : null,
          height: item.player.height,
          weight: item.player.weight,
          photo: item.player.photo,
          position: item.statistics[0]?.games?.position || null,
        },
        update: {
          name: decodeHtml(item.player.name),
          firstName: item.player.firstname,
          lastName: item.player.lastname,
          photo: item.player.photo,
          position: item.statistics[0]?.games?.position || undefined,
        },
      });

      // Find the stat entry for the target league
      const stat = item.statistics.find((s) => s.league.id === leagueApiId);
      if (stat && stat.games.appearences !== null && stat.games.appearences > 0) {
        await this.prisma.playerSeasonStats.upsert({
          where: {
            playerId_seasonId_leagueApiId: {
              playerId: player.id,
              seasonId: seasonRecord.id,
              leagueApiId,
            },
          },
          create: {
            playerId: player.id,
            teamId: team.id,
            seasonId: seasonRecord.id,
            leagueApiId,
            appearances: stat.games.appearences,
            lineups: stat.games.lineups,
            minutes: stat.games.minutes,
            position: stat.games.position,
            rating: stat.games.rating ? parseFloat(stat.games.rating) : null,
            goalsTotal: stat.goals.total,
            assists: stat.goals.assists,
            shotsTotal: stat.shots.total,
            shotsOn: stat.shots.on,
            passesTotal: stat.passes.total,
            passesKey: stat.passes.key,
            passesAccuracy: stat.passes.accuracy,
            tacklesTotal: stat.tackles.total,
            tacklesBlocks: stat.tackles.blocks,
            interceptions: stat.tackles.interceptions,
            duelsTotal: stat.duels.total,
            duelsWon: stat.duels.won,
            dribblesAttempts: stat.dribbles.attempts,
            dribblesSuccess: stat.dribbles.success,
            foulsDrawn: stat.fouls.drawn,
            foulsCommitted: stat.fouls.committed,
            yellowCards: stat.cards.yellow,
            redCards: stat.cards.red,
            penaltyScored: stat.penalty.scored,
            penaltyMissed: stat.penalty.missed,
          },
          update: {
            appearances: stat.games.appearences,
            lineups: stat.games.lineups,
            minutes: stat.games.minutes,
            rating: stat.games.rating ? parseFloat(stat.games.rating) : null,
            goalsTotal: stat.goals.total,
            assists: stat.goals.assists,
          },
        });
      }

      count++;
    }

    return count;
  }
}
