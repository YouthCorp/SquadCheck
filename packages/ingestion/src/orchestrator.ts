import { PrismaClient, IngestionStatus } from "@prisma/client";
import { ApiFootballClient } from "./client/api-football";
import { LeagueCollector } from "./collectors/league.collector";
import { TeamCollector } from "./collectors/team.collector";
import { FixtureCollector } from "./collectors/fixture.collector";
import { InjuryCollector } from "./collectors/injury.collector";
import { PlayerCollector } from "./collectors/player.collector";
import { FixtureDetailCollector } from "./collectors/fixture-detail.collector";

const TARGET_LEAGUES = [39, 140, 135, 78, 61];
const TARGET_SEASONS = [2023, 2024, 2025];

interface SeedOptions {
  leagues?: number[];
  seasons?: number[];
  skipPhases?: string[];
}

export class Orchestrator {
  private leagueCollector: LeagueCollector;
  private teamCollector: TeamCollector;
  private fixtureCollector: FixtureCollector;
  private injuryCollector: InjuryCollector;
  private playerCollector: PlayerCollector;
  private fixtureDetailCollector: FixtureDetailCollector;

  constructor(
    private api: ApiFootballClient,
    private prisma: PrismaClient,
  ) {
    this.leagueCollector = new LeagueCollector(api, prisma);
    this.teamCollector = new TeamCollector(api, prisma);
    this.fixtureCollector = new FixtureCollector(api, prisma);
    this.injuryCollector = new InjuryCollector(api, prisma);
    this.playerCollector = new PlayerCollector(api, prisma);
    this.fixtureDetailCollector = new FixtureDetailCollector(api, prisma);
  }

  async fullSeed(options: SeedOptions = {}): Promise<void> {
    const leagues = options.leagues || TARGET_LEAGUES;
    const seasons = options.seasons || TARGET_SEASONS;
    const skip = new Set(options.skipPhases || []);

    console.log("═══════════════════════════════════════════");
    console.log(" SquadCheck Full Seed");
    console.log(`  Leagues: ${leagues.join(", ")}`);
    console.log(`  Seasons: ${seasons.join(", ")}`);
    console.log("═══════════════════════════════════════════\n");

    // Phase 1: Leagues & Seasons
    if (!skip.has("leagues")) {
      await this.runPhase("leagues", null, null, async () => {
        await this.leagueCollector.collect();
      });
    }

    // Phase 2: Teams (per league+season)
    if (!skip.has("teams")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase("teams", leagueId, season, async () => {
            await this.teamCollector.collect(leagueId, season);
          });
        }
      }
    }

    // Phase 3: Standings
    if (!skip.has("standings")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase("standings", leagueId, season, async () => {
            await this.collectStandings(leagueId, season);
          });
        }
      }
    }

    // Phase 4: Fixtures
    if (!skip.has("fixtures")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase("fixtures", leagueId, season, async () => {
            await this.fixtureCollector.collect(leagueId, season);
          });
        }
      }
    }

    // Phase 5: Injuries
    if (!skip.has("injuries")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase("injuries", leagueId, season, async () => {
            await this.injuryCollector.collect(leagueId, season);
          });
        }
      }
    }

    // Phase 6: Players (paginated — per team)
    if (!skip.has("players")) {
      for (const leagueApiId of leagues) {
        for (const season of seasons) {
          await this.runPhase("players", leagueApiId, season, async () => {
            const league = await this.prisma.league.findUnique({
              where: { apiFootballId: leagueApiId },
            });
            if (!league) return;

            const seasonRecord = await this.prisma.season.findUnique({
              where: { leagueId_year: { leagueId: league.id, year: season } },
            });
            if (!seasonRecord) return;

            // Get all teams that played in this league+season
            const teams = await this.prisma.team.findMany({
              where: {
                OR: [
                  { homeFixtures: { some: { leagueId: league.id, season } } },
                  { awayFixtures: { some: { leagueId: league.id, season } } },
                ],
              },
            });

            for (const team of teams) {
              await this.playerCollector.collect(
                team.apiFootballId,
                season,
                leagueApiId,
              );
            }
          });
        }
      }
    }

    // Phase 7–10: Fixture details (statistics, lineups, events, player_stats)
    if (!skip.has("fixture_details")) {
      await this.collectAllFixtureDetails(leagues, seasons);
    }

    // Phase 11: Aggregate team season stats
    if (!skip.has("aggregates")) {
      await this.runPhase("aggregates", null, null, async () => {
        await this.computeTeamSeasonStats(leagues, seasons);
      });
    }

    console.log("\n═══════════════════════════════════════════");
    console.log(" Full Seed Complete!");
    console.log(
      `  API remaining: ${this.api.remaining.daily} daily / ${this.api.remaining.minute} per-min`,
    );
    console.log("═══════════════════════════════════════════");
  }

  async incrementalSync(): Promise<void> {
    console.log("[Sync] Starting incremental sync...");

    const currentSeasons = await this.prisma.season.findMany({
      where: { current: true },
      include: { league: true },
    });

    for (const season of currentSeasons) {
      const leagueApiId = season.league.apiFootballId;
      const year = season.year;

      console.log(`\n[Sync] ${season.league.name} ${year}`);

      // Refresh fixtures (picks up new results)
      await this.fixtureCollector.collect(leagueApiId, year);

      // Refresh injuries
      await this.injuryCollector.collect(leagueApiId, year);

      // Collect details for recently finished fixtures without stats
      const recentFixtures = await this.prisma.fixture.findMany({
        where: {
          leagueId: season.leagueId,
          season: year,
          status: "FT",
          statistics: { none: {} },
        },
        select: { id: true, apiFootballId: true },
        orderBy: { date: "desc" },
        take: 50,
      });

      for (const f of recentFixtures) {
        console.log(`  [Sync] Fixture details for ${f.apiFootballId}`);
        try {
          await this.fixtureDetailCollector.collectStatistics(f.apiFootballId, f.id);
          await this.fixtureDetailCollector.collectLineups(f.apiFootballId, f.id);
          await this.fixtureDetailCollector.collectEvents(f.apiFootballId, f.id);
          await this.fixtureDetailCollector.collectPlayerStats(f.apiFootballId, f.id);
        } catch (err) {
          console.error(`  [Sync] Error on fixture ${f.apiFootballId}:`, err);
        }
      }

      // Refresh standings
      await this.collectStandings(leagueApiId, year);
    }

    console.log("\n[Sync] Incremental sync complete");
  }

  // ── Phase runner with IngestionJob tracking ──────────────────

  private async runPhase(
    jobType: string,
    leagueApiId: number | null,
    season: number | null,
    fn: () => Promise<void>,
  ): Promise<void> {
    // Check if already completed
    const existing = await this.prisma.ingestionJob.findFirst({
      where: {
        jobType,
        leagueApiId,
        season,
        status: IngestionStatus.COMPLETED,
      },
    });

    if (existing) {
      console.log(
        `[Skip] ${jobType} league=${leagueApiId} season=${season} — already completed`,
      );
      return;
    }

    const job = await this.prisma.ingestionJob.create({
      data: {
        jobType,
        leagueApiId,
        season,
        status: IngestionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      await fn();

      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[FAILED] ${jobType} league=${leagueApiId} season=${season}: ${message}`,
      );

      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionStatus.FAILED,
          errorMessage: message.slice(0, 1000),
          completedAt: new Date(),
        },
      });

      // Re-throw DailyLimitError to stop the entire seed
      if (message.includes("Daily API limit")) {
        throw err;
      }
    }
  }

  // ── Fixture Details (checkpoint per fixture) ─────────────────

  private async collectAllFixtureDetails(
    leagues: number[],
    seasons: number[],
  ): Promise<void> {
    for (const leagueApiId of leagues) {
      const league = await this.prisma.league.findUnique({
        where: { apiFootballId: leagueApiId },
      });
      if (!league) continue;

      for (const season of seasons) {
        const jobType = "fixture_details";

        // Check checkpoint
        const existingJob = await this.prisma.ingestionJob.findFirst({
          where: {
            jobType,
            leagueApiId,
            season,
            status: IngestionStatus.COMPLETED,
          },
        });
        if (existingJob) {
          console.log(
            `[Skip] fixture_details league=${leagueApiId} season=${season} — already completed`,
          );
          continue;
        }

        // Find last checkpoint for resume
        const failedJob = await this.prisma.ingestionJob.findFirst({
          where: {
            jobType,
            leagueApiId,
            season,
            status: { in: [IngestionStatus.FAILED, IngestionStatus.RUNNING] },
          },
          orderBy: { createdAt: "desc" },
        });
        const lastProcessedId = failedJob?.lastProcessedId
          ? parseInt(failedJob.lastProcessedId)
          : 0;

        const fixtures = await this.prisma.fixture.findMany({
          where: {
            leagueId: league.id,
            season,
            status: { in: ["FT", "AET", "PEN"] },
            apiFootballId: { gt: lastProcessedId },
          },
          select: { id: true, apiFootballId: true },
          orderBy: { apiFootballId: "asc" },
        });

        if (fixtures.length === 0) {
          console.log(
            `[Skip] fixture_details league=${leagueApiId} season=${season} — no fixtures to process`,
          );
          continue;
        }

        const job = await this.prisma.ingestionJob.create({
          data: {
            jobType,
            leagueApiId,
            season,
            status: IngestionStatus.RUNNING,
            startedAt: new Date(),
            totalItems: fixtures.length,
          },
        });

        console.log(
          `\n[FixtureDetails] league=${leagueApiId} season=${season}: ${fixtures.length} fixtures (resume from ${lastProcessedId})`,
        );

        let processed = 0;
        for (const f of fixtures) {
          try {
            await this.fixtureDetailCollector.collectStatistics(f.apiFootballId, f.id);
            await this.fixtureDetailCollector.collectLineups(f.apiFootballId, f.id);
            await this.fixtureDetailCollector.collectEvents(f.apiFootballId, f.id);
            await this.fixtureDetailCollector.collectPlayerStats(f.apiFootballId, f.id);
            processed++;

            // Update checkpoint every 10 fixtures
            if (processed % 10 === 0) {
              await this.prisma.ingestionJob.update({
                where: { id: job.id },
                data: {
                  processedItems: processed,
                  lastProcessedId: String(f.apiFootballId),
                },
              });
              console.log(
                `  [${processed}/${fixtures.length}] fixture ${f.apiFootballId} — API remaining: ${this.api.remaining.daily}`,
              );
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            await this.prisma.ingestionJob.update({
              where: { id: job.id },
              data: {
                status: IngestionStatus.FAILED,
                processedItems: processed,
                lastProcessedId: String(f.apiFootballId),
                errorMessage: message.slice(0, 1000),
                completedAt: new Date(),
              },
            });

            if (message.includes("Daily API limit")) {
              throw err;
            }
            console.error(`  [Error] fixture ${f.apiFootballId}: ${message}`);
            continue;
          }
        }

        await this.prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: IngestionStatus.COMPLETED,
            processedItems: processed,
            completedAt: new Date(),
          },
        });

        console.log(
          `  ✓ fixture_details league=${leagueApiId} season=${season}: ${processed} fixtures done`,
        );
      }
    }
  }

  // ── Standings ──────────────────────────────────────────────────

  private async collectStandings(
    leagueApiId: number,
    season: number,
  ): Promise<void> {
    console.log(`[Standings] league=${leagueApiId} season=${season}`);

    const league = await this.prisma.league.findUnique({
      where: { apiFootballId: leagueApiId },
    });
    if (!league) return;

    const res = await this.api.request<{
      league: {
        standings: Array<
          Array<{
            rank: number;
            team: { id: number; name: string };
            points: number;
            goalsDiff: number;
            form: string | null;
            description: string | null;
            all: {
              played: number;
              win: number;
              draw: number;
              lose: number;
              goals: { for: number; against: number };
            };
            home: {
              played: number;
              win: number;
              draw: number;
              lose: number;
              goals: { for: number; against: number };
            };
            away: {
              played: number;
              win: number;
              draw: number;
              lose: number;
              goals: { for: number; against: number };
            };
          }>
        >;
      };
    }>("/standings", { league: leagueApiId, season });

    if (res.results === 0) return;

    const standingsData = res.response[0].league.standings[0];
    if (!standingsData) return;

    const seasonRecord = await this.prisma.season.findUnique({
      where: { leagueId_year: { leagueId: league.id, year: season } },
    });
    if (!seasonRecord) return;

    const standing = await this.prisma.standing.upsert({
      where: { leagueId_season: { leagueId: league.id, season } },
      create: { leagueId: league.id, season },
      update: {},
    });

    for (const entry of standingsData) {
      const team = await this.prisma.team.findUnique({
        where: { apiFootballId: entry.team.id },
      });
      if (!team) continue;

      const entryData = {
        rank: entry.rank,
        points: entry.points,
        goalsDiff: entry.goalsDiff,
        form: entry.form,
        description: entry.description,
        played: entry.all.played,
        wins: entry.all.win,
        draws: entry.all.draw,
        losses: entry.all.lose,
        goalsFor: entry.all.goals.for,
        goalsAgainst: entry.all.goals.against,
        homePlayed: entry.home.played,
        homeWins: entry.home.win,
        homeDraws: entry.home.draw,
        homeLosses: entry.home.lose,
        homeGoalsFor: entry.home.goals.for,
        homeGoalsAgainst: entry.home.goals.against,
        awayPlayed: entry.away.played,
        awayWins: entry.away.win,
        awayDraws: entry.away.draw,
        awayLosses: entry.away.lose,
        awayGoalsFor: entry.away.goals.for,
        awayGoalsAgainst: entry.away.goals.against,
      };

      await this.prisma.standingEntry.upsert({
        where: {
          standingId_teamId: { standingId: standing.id, teamId: team.id },
        },
        create: {
          standingId: standing.id,
          teamId: team.id,
          seasonId: seasonRecord.id,
          ...entryData,
        },
        update: entryData,
      });
    }

    console.log(`  ✓ ${standingsData.length} entries`);
  }

  // ── Team Season Stats (local aggregation, no API calls) ──────

  private async computeTeamSeasonStats(
    leagues: number[],
    seasons: number[],
  ): Promise<void> {
    console.log("[Aggregates] Computing team season stats...");

    for (const leagueApiId of leagues) {
      const league = await this.prisma.league.findUnique({
        where: { apiFootballId: leagueApiId },
      });
      if (!league) continue;

      for (const season of seasons) {
        const teams = await this.prisma.standingEntry.findMany({
          where: { standing: { leagueId: league.id, season } },
          select: { teamId: true },
        });

        const seasonRecord = await this.prisma.season.findUnique({
          where: { leagueId_year: { leagueId: league.id, year: season } },
        });
        if (!seasonRecord) continue;

        for (const { teamId } of teams) {
          const stats = await this.prisma.fixtureStatistics.findMany({
            where: {
              teamId,
              fixture: { leagueId: league.id, season },
            },
          });

          if (stats.length === 0) continue;

          const avg = (arr: (number | null)[]) => {
            const valid = arr.filter((v): v is number => v !== null);
            return valid.length > 0
              ? valid.reduce((a, b) => a + b, 0) / valid.length
              : null;
          };

          const sum = (arr: (number | null)[]) => {
            const valid = arr.filter((v): v is number => v !== null);
            return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
          };

          const aggData = {
            avgPossession: avg(stats.map((s) => s.possession)),
            avgXg: avg(stats.map((s) => s.expectedGoals)),
            avgShots: avg(stats.map((s) => s.totalShots)),
            avgShotsOnTarget: avg(stats.map((s) => s.shotsOnGoal)),
            avgPasses: avg(stats.map((s) => s.totalPasses)),
            avgPassAccuracy: avg(stats.map((s) => s.passPercent)),
          };

          await this.prisma.teamSeasonStats.upsert({
            where: { teamId_seasonId: { teamId, seasonId: seasonRecord.id } },
            create: {
              teamId,
              seasonId: seasonRecord.id,
              ...aggData,
            },
            update: aggData,
          });
        }

        console.log(
          `  ✓ ${league.name} ${season}: ${teams.length} teams aggregated`,
        );
      }
    }
  }
}
