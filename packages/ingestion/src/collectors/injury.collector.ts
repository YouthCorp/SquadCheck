import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
  fixture: { id: number; timezone: string; date: string; timestamp: number };
  league: { id: number; season: number; name: string };
}

export class InjuryCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(leagueApiId: number, season: number): Promise<number> {
    console.log(`[InjuryCollector] Collecting injuries for league=${leagueApiId} season=${season}`);

    const res = await this.api.request<ApiInjury>('/injuries', { league: leagueApiId, season });
    let inserted = 0;
    let skipped = 0;

    for (const item of res.response) {
      const player = await this.prisma.player.findUnique({ where: { apiFootballId: item.player.id } });
      const team = await this.prisma.team.findUnique({ where: { apiFootballId: item.team.id } });
      const fixture = await this.prisma.fixture.findUnique({ where: { apiFootballId: item.fixture.id } });
      const league = await this.prisma.league.findUnique({ where: { apiFootballId: item.league.id } });

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
                name: item.player.name || `Unknown (${item.player.id})`,
                photo: item.player.photo,
              },
            })
          ).id;

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
