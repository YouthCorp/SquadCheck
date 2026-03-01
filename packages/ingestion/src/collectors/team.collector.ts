import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiTeam {
  team: { id: number; name: string; code: string | null; country: string; founded: number | null; national: boolean; logo: string };
  venue: { id: number; name: string; city: string; capacity: number; surface: string; image: string } | null;
}

export class TeamCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(leagueApiId: number, season: number): Promise<void> {
    console.log(`[TeamCollector] Collecting teams for league=${leagueApiId} season=${season}`);

    const res = await this.api.request<ApiTeam>('/teams', { league: leagueApiId, season });

    for (const item of res.response) {
      await this.prisma.team.upsert({
        where: { apiFootballId: item.team.id },
        create: {
          apiFootballId: item.team.id,
          name: item.team.name,
          code: item.team.code,
          country: item.team.country,
          founded: item.team.founded,
          logo: item.team.logo,
          venueName: item.venue?.name,
          venueCity: item.venue?.city,
          venueCapacity: item.venue?.capacity,
          venueImage: item.venue?.image,
        },
        update: {
          name: item.team.name,
          code: item.team.code,
          logo: item.team.logo,
          venueName: item.venue?.name,
          venueCity: item.venue?.city,
          venueCapacity: item.venue?.capacity,
        },
      });
    }

    console.log(`  ✓ ${res.results} teams`);
  }
}
