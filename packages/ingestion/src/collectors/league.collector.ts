import { PrismaClient } from '@prisma/client';
import { ApiFootballClient } from '../client/api-football';

interface ApiLeague {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
    coverage: {
      fixtures: { events: boolean; lineups: boolean; statistics_fixtures: boolean; statistics_players: boolean };
      standings: boolean;
      players: boolean;
      top_scorers: boolean;
      injuries: boolean;
      predictions: boolean;
    };
  }>;
}

const TARGET_LEAGUES = [39, 140, 135, 78, 61]; // EPL, La Liga, Serie A, Bundesliga, Ligue 1
const TARGET_SEASONS = [2020, 2021, 2022, 2023, 2024, 2025];

export class LeagueCollector {
  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {}

  async collect(): Promise<void> {
    console.log('[LeagueCollector] Collecting leagues and seasons...');

    for (const leagueApiId of TARGET_LEAGUES) {
      const res = await this.api.request<ApiLeague>('/leagues', { id: leagueApiId });
      if (res.results === 0) {
        console.warn(`  League ${leagueApiId} not found, skipping`);
        continue;
      }

      const data = res.response[0];

      const league = await this.prisma.league.upsert({
        where: { apiFootballId: leagueApiId },
        create: {
          apiFootballId: leagueApiId,
          name: data.league.name,
          type: data.league.type,
          country: data.country.name,
          countryCode: data.country.code,
          logo: data.league.logo,
          flag: data.country.flag,
        },
        update: {
          name: data.league.name,
          logo: data.league.logo,
        },
      });

      for (const s of data.seasons) {
        if (!TARGET_SEASONS.includes(s.year)) continue;

        await this.prisma.season.upsert({
          where: { leagueId_year: { leagueId: league.id, year: s.year } },
          create: {
            leagueId: league.id,
            year: s.year,
            startDate: new Date(s.start),
            endDate: new Date(s.end),
            current: s.current,
            covFixtureEvents: s.coverage.fixtures.events,
            covFixtureLineups: s.coverage.fixtures.lineups,
            covFixtureStats: s.coverage.fixtures.statistics_fixtures,
            covFixturePlayerStats: s.coverage.fixtures.statistics_players,
            covStandings: s.coverage.standings,
            covPlayers: s.coverage.players,
            covInjuries: s.coverage.injuries,
            covPredictions: s.coverage.predictions,
          },
          update: {
            current: s.current,
            covFixtureEvents: s.coverage.fixtures.events,
            covFixtureLineups: s.coverage.fixtures.lineups,
            covFixtureStats: s.coverage.fixtures.statistics_fixtures,
            covFixturePlayerStats: s.coverage.fixtures.statistics_players,
            covInjuries: s.coverage.injuries,
          },
        });
      }

      console.log(`  ✓ ${data.league.name}: ${data.seasons.filter((s) => TARGET_SEASONS.includes(s.year)).length} seasons`);
    }

    console.log('[LeagueCollector] Done');
  }
}
