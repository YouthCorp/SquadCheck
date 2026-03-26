import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue: { name: string; city: string } | null;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; season: number; round: string };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export class FixtureCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(leagueApiId: number, season: number): Promise<number> {
    console.log(`[FixtureCollector] Collecting fixtures for league=${leagueApiId} season=${season}`);

    const league = await this.prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
    if (!league) throw new Error(`League ${leagueApiId} not found in DB`);

    const res = await this.api.request<ApiFixture>('/fixtures', { league: leagueApiId, season });
    const teamApiIds = [...new Set(
      res.response.flatMap((item) => [item.teams.home.id, item.teams.away.id]),
    )];
    const teams = teamApiIds.length > 0
      ? await this.prisma.team.findMany({
          where: { apiFootballId: { in: teamApiIds } },
          select: { id: true, apiFootballId: true },
        })
      : [];
    const teamByApiId = new Map(teams.map((team) => [team.apiFootballId, team]));

    let count = 0;

    for (const item of res.response) {
      const homeTeam = teamByApiId.get(item.teams.home.id);
      const awayTeam = teamByApiId.get(item.teams.away.id);

      if (!homeTeam || !awayTeam) {
        console.warn(`  Skipping fixture ${item.fixture.id}: missing team(s)`);
        continue;
      }

      await this.prisma.fixture.upsert({
        where: { apiFootballId: item.fixture.id },
        create: {
          apiFootballId: item.fixture.id,
          leagueId: league.id,
          season,
          round: item.league.round,
          date: new Date(item.fixture.date),
          timestamp: item.fixture.timestamp,
          referee: item.fixture.referee,
          status: item.fixture.status.short,
          statusLong: item.fixture.status.long,
          elapsed: item.fixture.status.elapsed,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          goalsHome: item.goals.home,
          goalsAway: item.goals.away,
          goalsHtHome: item.score.halftime.home,
          goalsHtAway: item.score.halftime.away,
          venueName: item.fixture.venue?.name,
          venueCity: item.fixture.venue?.city,
        },
        update: {
          status: item.fixture.status.short,
          statusLong: item.fixture.status.long,
          elapsed: item.fixture.status.elapsed,
          goalsHome: item.goals.home,
          goalsAway: item.goals.away,
          goalsHtHome: item.score.halftime.home,
          goalsHtAway: item.score.halftime.away,
        },
      });
      count++;
    }

    console.log(`  ✓ ${count} fixtures`);
    return count;
  }
}
