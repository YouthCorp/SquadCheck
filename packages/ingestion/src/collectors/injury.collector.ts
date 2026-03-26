import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
  fixture: { id: number; timezone: string; date: string; timestamp: number };
  league: { id: number; season: number; name: string };
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

export class InjuryCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(leagueApiId: number, season: number): Promise<number> {
    console.log(`[InjuryCollector] Collecting injuries for league=${leagueApiId} season=${season}`);

    const res = await this.api.request<ApiInjury>('/injuries', { league: leagueApiId, season });
    const playerApiIds = [...new Set(res.response.map((item) => item.player.id))];
    const teamApiIds = [...new Set(res.response.map((item) => item.team.id))];
    const fixtureApiIds = [...new Set(res.response.map((item) => item.fixture.id))];
    const leagueApiIds = [...new Set(res.response.map((item) => item.league.id))];

    const [players, teams, fixtures, leagues] = await Promise.all([
      playerApiIds.length > 0
        ? this.prisma.player.findMany({
            where: { apiFootballId: { in: playerApiIds } },
            select: { id: true, apiFootballId: true },
          })
        : Promise.resolve([]),
      teamApiIds.length > 0
        ? this.prisma.team.findMany({
            where: { apiFootballId: { in: teamApiIds } },
            select: { id: true, apiFootballId: true },
          })
        : Promise.resolve([]),
      fixtureApiIds.length > 0
        ? this.prisma.fixture.findMany({
            where: { apiFootballId: { in: fixtureApiIds } },
            select: { id: true, apiFootballId: true },
          })
        : Promise.resolve([]),
      leagueApiIds.length > 0
        ? this.prisma.league.findMany({
            where: { apiFootballId: { in: leagueApiIds } },
            select: { id: true, apiFootballId: true },
          })
        : Promise.resolve([]),
    ]);

    const playerByApiId = new Map(players.map((player) => [player.apiFootballId, player]));
    const teamByApiId = new Map(teams.map((team) => [team.apiFootballId, team]));
    const fixtureByApiId = new Map(fixtures.map((fixture) => [fixture.apiFootballId, fixture]));
    const leagueByApiId = new Map(leagues.map((league) => [league.apiFootballId, league]));

    let inserted = 0;
    let skipped = 0;

    for (const item of res.response) {
      const player = playerByApiId.get(item.player.id);
      const team = teamByApiId.get(item.team.id);
      const fixture = fixtureByApiId.get(item.fixture.id);
      const league = leagueByApiId.get(item.league.id);

      if (!fixture || !league || !team) {
        skipped++;
        continue;
      }

      // Auto-create player if not exists (injuries may reference players not yet collected)
      const playerId = player
        ? player.id
        : (
            await this.prisma.player.create({
              data: {
                apiFootballId: item.player.id,
                name: decodeHtml(item.player.name || `Unknown (${item.player.id})`),
                photo: item.player.photo,
              },
            })
          ).id;

      if (!player) {
        playerByApiId.set(item.player.id, { id: playerId, apiFootballId: item.player.id });
      }

      try {
        await this.prisma.injury.upsert({
          where: { playerId_fixtureId: { playerId, fixtureId: fixture.id } },
          create: {
            playerId,
            teamId: team.id,
            leagueId: league.id,
            fixtureId: fixture.id,
            season,
            type: item.player.type,
            reason: item.player.reason || 'Unknown',
            fixtureDate: new Date(item.fixture.date),
          },
          update: {
            type: item.player.type,
            reason: item.player.reason || 'Unknown',
          },
        });
        inserted++;
      } catch {
        skipped++;
      }
    }

    console.log(`  ✓ ${inserted} injuries (${skipped} skipped)`);
    return inserted;
  }
}
