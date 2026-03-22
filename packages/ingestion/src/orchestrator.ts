import { PrismaClient, IngestionStatus } from "@prisma/client";
import { ApiFootballClient } from "./client/api-football";
import { LeagueCollector } from "./collectors/league.collector";
import { TeamCollector } from "./collectors/team.collector";
import { FixtureCollector } from "./collectors/fixture.collector";
import { InjuryCollector } from "./collectors/injury.collector";
import { PlayerCollector } from "./collectors/player.collector";
import { FixtureDetailCollector } from "./collectors/fixture-detail.collector";
import { RecoverySignalCollector } from "./collectors/recovery-signal.collector";
import { WebCrawlCollector } from "./collectors/web-crawl.collector";
import { computePlayerAvailability } from "./aggregators/availability-aggregator";
import { collectInjuryStatuses } from "./collectors/injury-status.collector";
import { notifyWatchlistChanges } from "./watchers/watchlist-notifier";

const LEAGUE_LEAGUES = [39, 140, 135, 78, 61]; // EPL, La Liga, Serie A, Bundesliga, Ligue 1
// prettier-ignore
export const CUP_LEAGUES = [2, 3, 848, 45, 48, 143, 137, 81, 65]; // UCL, UEL, Conference, FA Cup, EFL Cup, Copa del Rey, Coppa Italia, DFB-Pokal, Coupe de France
const TARGET_LEAGUES = LEAGUE_LEAGUES; // default: league-only (cups seeded separately via CLI)
const TARGET_SEASONS = [2023, 2024, 2025];

interface SeedOptions {
  leagues?: number[];
  seasons?: number[];
  skipPhases?: string[];
  forcePhases?: string[]; // Re-run even if already COMPLETED
}

export class Orchestrator {
  private leagueCollector: LeagueCollector;
  private teamCollector: TeamCollector;
  private fixtureCollector: FixtureCollector;
  private injuryCollector: InjuryCollector;
  private playerCollector: PlayerCollector;
  private fixtureDetailCollector: FixtureDetailCollector;
  private recoverySignalCollector: RecoverySignalCollector;
  private webCrawlCollector: WebCrawlCollector;

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
    this.recoverySignalCollector = new RecoverySignalCollector(prisma);
    this.webCrawlCollector = new WebCrawlCollector(prisma);
  }

  async fullSeed(options: SeedOptions = {}): Promise<void> {
    const leagues = options.leagues || TARGET_LEAGUES;
    const seasons = options.seasons || TARGET_SEASONS;
    const skip = new Set(options.skipPhases || []);
    const force = new Set(options.forcePhases || []);

    console.log("═══════════════════════════════════════════");
    console.log(" SquadCheck Full Seed");
    console.log(`  Leagues: ${leagues.join(", ")}`);
    console.log(`  Seasons: ${seasons.join(", ")}`);
    console.log("═══════════════════════════════════════════\n");

    // Phase 1: Leagues & Seasons
    if (!skip.has("leagues")) {
      await this.runPhase(
        "leagues",
        null,
        null,
        force.has("leagues"),
        async () => {
          await this.leagueCollector.collect(leagues);
        },
      );
    }

    // Phase 2: Teams (per league+season)
    if (!skip.has("teams")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase(
            "teams",
            leagueId,
            season,
            force.has("teams"),
            async () => {
              await this.teamCollector.collect(leagueId, season);
            },
          );
        }
      }
    }

    // Phase 3: Standings
    if (!skip.has("standings")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase(
            "standings",
            leagueId,
            season,
            force.has("standings"),
            async () => {
              await this.collectStandings(leagueId, season);
            },
          );
        }
      }
    }

    // Phase 4: Fixtures
    if (!skip.has("fixtures")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase(
            "fixtures",
            leagueId,
            season,
            force.has("fixtures"),
            async () => {
              await this.fixtureCollector.collect(leagueId, season);
            },
          );
        }
      }
    }

    // Phase 5: Injuries
    if (!skip.has("injuries")) {
      for (const leagueId of leagues) {
        for (const season of seasons) {
          await this.runPhase(
            "injuries",
            leagueId,
            season,
            force.has("injuries"),
            async () => {
              await this.injuryCollector.collect(leagueId, season);
            },
          );
        }
      }
    }

    // Phase 6: Players (paginated — per team)
    if (!skip.has("players")) {
      for (const leagueApiId of leagues) {
        for (const season of seasons) {
          await this.runPhase(
            "players",
            leagueApiId,
            season,
            force.has("players"),
            async () => {
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
            },
          );
        }
      }
    }

    // Phase 7–10: Fixture details (statistics, lineups, events, player_stats)
    if (!skip.has("fixture_details")) {
      await this.collectAllFixtureDetails(
        leagues,
        seasons,
        force.has("fixture_details"),
      );
    }

    // Phase 11: Aggregate team season stats
    if (!skip.has("aggregates")) {
      await this.runPhase(
        "aggregates",
        null,
        null,
        force.has("aggregates"),
        async () => {
          await this.computeTeamSeasonStats(leagues, seasons);
        },
      );
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

    // Pre-populate injury status from existing DB data so API endpoints are
    // never empty while the full sync is still running (important on first deploy).
    const preSyncYear =
      currentSeasons.length > 0
        ? Math.max(...currentSeasons.map((s) => s.year))
        : 2025;
    await collectInjuryStatuses(this.prisma, preSyncYear);

    for (const season of currentSeasons) {
      const leagueApiId = season.league.apiFootballId;
      const year = season.year;

      console.log(`\n[Sync] ${season.league.name} ${year}`);

      // Refresh fixtures (picks up new results)
      await this.fixtureCollector.collect(leagueApiId, year);

      // Refresh injuries
      await this.injuryCollector.collect(leagueApiId, year);

      // Collect details for recently finished fixtures not yet processed.
      // Also re-processes fixtures where lineup rows exist but have no players
      // (partial sync: lineup shell created but player insert failed or API returned empty).
      const recentFixtures = await this.prisma.fixture.findMany({
        where: {
          leagueId: season.leagueId,
          season: year,
          status: { in: ["FT", "AET", "PEN"] },
          OR: [
            // Never processed (some competitions never return statistics so only lineups checked)
            {
              statistics: { none: {} },
              lineups: { none: {} },
            },
            // Partial sync: lineup row exists but has no players — re-sync
            { lineups: { some: { players: { none: {} } } } },
          ],
        },
        select: {
          id: true,
          apiFootballId: true,
          homeTeam: { select: { apiFootballId: true } },
          awayTeam: { select: { apiFootballId: true } },
        },
        orderBy: { date: "desc" },
        take: 8,
      });

      for (const f of recentFixtures) {
        console.log(`  [Sync] Fixture details for ${f.apiFootballId}`);
        try {
          await this.fixtureDetailCollector.collectStatistics(
            f.apiFootballId,
            f.id,
          );
          await this.fixtureDetailCollector.collectLineups(
            f.apiFootballId,
            f.id,
          );
          await this.fixtureDetailCollector.collectEvents(
            f.apiFootballId,
            f.id,
          );
          await this.fixtureDetailCollector.collectPlayerStats(
            f.apiFootballId,
            f.id,
          );
        } catch (err) {
          console.error(`  [Sync] Error on fixture ${f.apiFootballId}:`, err);
        }
      }

      // Refresh playerSeasonStats for:
      // 1. Teams that played in newly-synced fixtures (picks up fresh match data)
      // 2. Teams with active injuries (injury-impact analysis needs current lineups/appearances
      //    to avoid showing "시즌 전체 결장" for players who have actually played this season)
      const teamApiIdsToRefresh = new Set<number>();
      for (const f of recentFixtures) {
        teamApiIdsToRefresh.add(f.homeTeam.apiFootballId);
        teamApiIdsToRefresh.add(f.awayTeam.apiFootballId);
      }
      const injuredTeams = await this.prisma.playerInjuryStatus.findMany({
        where: { leagueApiId, season: year, isActive: true },
        select: { team: { select: { apiFootballId: true } } },
        distinct: ['teamId'],
      });
      for (const { team } of injuredTeams) {
        teamApiIdsToRefresh.add(team.apiFootballId);
      }

      for (const teamApiId of teamApiIdsToRefresh) {
        console.log(`  [Sync] Refreshing player stats for team ${teamApiId}`);
        try {
          await this.playerCollector.collect(teamApiId, year, leagueApiId);
        } catch (err) {
          console.warn(`  [Sync] Player stats refresh failed for team ${teamApiId}:`, err);
        }
      }

      // Refresh standings only if coverage is available (UCL/UEL/Conference have league phase standings; domestic cups do not)
      if (season.covStandings) {
        await this.collectStandings(leagueApiId, year);
      }
    }

    // Re-aggregate team season stats to pick up newly completed fixtures
    const syncLeagueIds = [
      ...new Set(currentSeasons.map((s) => s.league.apiFootballId)),
    ];
    const syncYears = [...new Set(currentSeasons.map((s) => s.year))];
    await this.computeTeamSeasonStats(syncLeagueIds, syncYears);

    // Mark expired PlayerAvailability rows for fixtures that are now completed
    await this.expireCompletedFixtureAvailability();

    // Refresh cached injury status table — single source of truth for all display endpoints
    const syncSeason = syncYears.length > 0 ? Math.max(...syncYears) : 2025;
    await collectInjuryStatuses(this.prisma, syncSeason);

    // Notify watchlist users of any changes detected during this sync cycle
    await notifyWatchlistChanges(this.prisma, syncSeason);

    console.log("\n[Sync] Incremental sync complete");
  }

  /**
   * Standalone recovery signal collection cycle.
   * Called independently from the signal scheduler (odd-hour cron).
   * Does NOT consume Football API quota.
   */
  /** Syncs RSS feed sources (upsert on every startup — idempotent).
   *  All URLs verified working as of 2026-03. Re-test before adding new ones.
   */
  private async ensureRssSources(): Promise<void> {
    const sources = [
      // ── Tier 1: Major national outlets ──
      {
        name: "BBC Sport Football",
        url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
        reliability: 0.9,
        active: true,
      },
      {
        name: "Guardian Football",
        url: "https://www.theguardian.com/football/rss",
        reliability: 0.85,
        active: true,
      },
      {
        name: "Sky Sports Football",
        url: "https://www.skysports.com/rss/12040",
        reliability: 0.82,
        active: true,
      },
      {
        name: "ESPN FC Soccer",
        url: "https://www.espn.com/espn/rss/soccer/news",
        reliability: 0.8,
        active: true,
      },
      {
        name: "The Independent Football",
        url: "https://www.independent.co.uk/sport/football/rss",
        reliability: 0.8,
        active: true,
      },
      {
        name: "Evening Standard Football",
        url: "https://www.standard.co.uk/sport/football/rss",
        reliability: 0.78,
        active: true,
      },
      {
        name: "Daily Mail Football",
        url: "https://www.dailymail.co.uk/sport/football/index.rss",
        reliability: 0.72,
        active: true,
      },
      {
        name: "iNews Football",
        url: "https://inews.co.uk/category/sport/football/feed",
        reliability: 0.72,
        active: true,
      },

      // ── Tier 2: Football-specialist outlets ──
      {
        name: "FourFourTwo",
        url: "https://www.fourfourtwo.com/rss",
        reliability: 0.78,
        active: true,
      },
      {
        name: "Football365",
        url: "https://www.football365.com/rss",
        reliability: 0.74,
        active: true,
      },
      {
        name: "Sports Mole Football",
        url: "https://sportsmole.co.uk/football/feed.xml",
        reliability: 0.72,
        active: true,
      },
      {
        name: "CaughtOffside",
        url: "https://www.caughtoffside.com/feed/",
        reliability: 0.68,
        active: true,
      },
      {
        name: "Planet Football",
        url: "https://www.planetfootball.com/rss",
        reliability: 0.65,
        active: true,
      },

      // ── Tier 3: League-specific outlets ──
      {
        name: "Bundesliga Official",
        url: "https://www.bundesliga.com/en/bundesliga/news.rss",
        reliability: 0.8,
        active: true,
      },
      {
        name: "Football Italia",
        url: "https://www.football-italia.net/rss.xml",
        reliability: 0.75,
        active: true,
      },

      // ── Disabled: no public RSS ──
      {
        name: "The Athletic Football",
        url: "https://theathletic.com/rss/feed/?sport=football",
        reliability: 0.9,
        active: false,
      },
    ];
    for (const s of sources) {
      await this.prisma.rssFeedSource.upsert({
        where: { url: s.url },
        create: { ...s, language: "en" },
        update: { reliability: s.reliability, active: s.active },
      });
    }
  }

  async collectSignals(): Promise<void> {
    console.log("[Signals] Starting recovery signal collection...");

    // Expire completed fixtures first so availability is not recomputed for finished matches.
    // (expireCompletedFixtureAvailability also runs at the end of incrementalSync, but
    // collectSignals runs independently on odd hours and must not lag behind.)
    await this.expireCompletedFixtureAvailability();

    await this.ensureRssSources();
    await this.ensureWebCrawlSources();

    const currentSeasons = await this.prisma.season.findMany({
      where: { current: true },
      select: { year: true },
    });

    // Collect signals for the most recent current season year
    const seasonYear =
      currentSeasons.length > 0
        ? Math.max(...currentSeasons.map((s) => s.year))
        : 2025;

    const rssInserted = await this.recoverySignalCollector.collect(seasonYear);
    const crawlInserted = await this.webCrawlCollector.collect(seasonYear);

    // After inserting new signals, recompute availability for affected players
    if (rssInserted + crawlInserted > 0) {
      await this.recomputeAvailabilityFromRecentSignals(seasonYear);
    }

    // Notify watchlist users of signal changes
    await notifyWatchlistChanges(this.prisma, seasonYear);

    console.log("[Signals] Recovery signal collection complete");
  }

  /** Upserts EPL club official news pages as crawl sources (idempotent). */
  private async ensureWebCrawlSources(): Promise<void> {
    const sources = [
      // Premier League official
      {
        name: "PL Official News",
        url: "https://www.premierleague.com/latest-player-injuries",
        reliability: 0.9,
      },
      // EPL 2025/26 clubs
      {
        name: "Arsenal News",
        url: "https://www.arsenal.com/news",
        reliability: 0.88,
      },
      {
        name: "Chelsea News",
        url: "https://www.chelseafc.com/en/news",
        reliability: 0.88,
      },
      {
        name: "Liverpool News",
        url: "https://www.liverpoolfc.com/news",
        reliability: 0.88,
      },
      {
        name: "Man City News",
        url: "https://www.mancity.com/news",
        reliability: 0.88,
      },
      {
        name: "Man United News",
        url: "https://www.manutd.com/en/news",
        reliability: 0.88,
      },
      {
        name: "Tottenham News",
        url: "https://www.tottenhamhotspur.com/news/",
        reliability: 0.88,
      },
      {
        name: "Aston Villa News",
        url: "https://www.avfc.co.uk/news",
        reliability: 0.85,
      },
      {
        name: "Brighton News",
        url: "https://www.brightonandhovealbion.com/news",
        reliability: 0.85,
      },
      {
        name: "Newcastle News",
        url: "https://www.nufc.co.uk/news",
        reliability: 0.85,
      },
      {
        name: "Wolves News",
        url: "https://www.wolves.co.uk/news",
        reliability: 0.85,
      },
      {
        name: "Brentford News",
        url: "https://www.brentfordfc.com/en/news",
        reliability: 0.83,
      },
      {
        name: "Crystal Palace News",
        url: "https://www.cpfc.co.uk/news",
        reliability: 0.83,
      },
      {
        name: "Everton News",
        url: "https://www.evertonfc.com/news",
        reliability: 0.83,
      },
      {
        name: "Fulham News",
        url: "https://www.fulhamfc.com/news",
        reliability: 0.83,
      },
      {
        name: "West Ham News",
        url: "https://www.whufc.com/news",
        reliability: 0.83,
      },
      {
        name: "Bournemouth News",
        url: "https://www.afcb.co.uk/news",
        reliability: 0.83,
      },
      {
        name: "Nottm Forest News",
        url: "https://www.nottinghamforest.co.uk/news",
        reliability: 0.83,
      },
      {
        name: "Leeds News",
        url: "https://www.leedsunited.com/news",
        reliability: 0.83,
      },
      {
        name: "Burnley News",
        url: "https://www.burnleyfc.com/news",
        reliability: 0.83,
      },
      {
        name: "Sunderland News",
        url: "https://www.safc.com/news",
        reliability: 0.83,
      },
    ];
    for (const s of sources) {
      await this.prisma.rssFeedSource.upsert({
        where: { url: s.url },
        create: { ...s, language: "en", sourceType: "crawl", active: true },
        update: { reliability: s.reliability },
      });
    }
  }

  /**
   * Recomputes PlayerAvailability for players who received new signals recently.
   */
  private async recomputeAvailabilityFromRecentSignals(
    season: number,
  ): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentSignals = await this.prisma.recoverySignal.findMany({
      where: { createdAt: { gte: fiveMinutesAgo } },
      select: { playerId: true, teamId: true },
      distinct: ["playerId"],
    });

    for (const { playerId, teamId } of recentSignals) {
      try {
        await computePlayerAvailability(this.prisma, playerId, teamId, season);
      } catch (err) {
        console.warn(
          `[Signals] Availability recompute failed for player ${playerId}:`,
          err,
        );
      }
    }
  }

  /**
   * Marks PlayerAvailability rows as expired when their target fixture has completed.
   * Called at the end of each incremental sync.
   */
  private async expireCompletedFixtureAvailability(): Promise<void> {
    await this.prisma.playerAvailability.updateMany({
      where: {
        expired: false,
        fixture: { status: { in: ["FT", "AET", "PEN"] } },
      },
      data: { expired: true },
    });
  }

  // ── Phase runner with IngestionJob tracking ──────────────────

  private async runPhase(
    jobType: string,
    leagueApiId: number | null,
    season: number | null,
    forceRun: boolean,
    fn: () => Promise<void>,
  ): Promise<void> {
    // Check if already completed (skip unless forced)
    const existing = await this.prisma.ingestionJob.findFirst({
      where: {
        jobType,
        leagueApiId,
        season,
        status: IngestionStatus.COMPLETED,
      },
    });

    if (existing && !forceRun) {
      console.log(
        `[Skip] ${jobType} league=${leagueApiId} season=${season} — already completed`,
      );
      return;
    }

    if (existing && forceRun) {
      console.log(
        `[Force] ${jobType} league=${leagueApiId} season=${season} — re-running`,
      );
      await this.prisma.ingestionJob.delete({ where: { id: existing.id } });
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
    forceRun = false,
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
        if (existingJob && !forceRun) {
          console.log(
            `[Skip] fixture_details league=${leagueApiId} season=${season} — already completed`,
          );
          continue;
        }
        if (existingJob && forceRun) {
          console.log(
            `[Force] fixture_details league=${leagueApiId} season=${season} — re-running`,
          );
          await this.prisma.ingestionJob.delete({
            where: { id: existingJob.id },
          });
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
            await this.fixtureDetailCollector.collectStatistics(
              f.apiFootballId,
              f.id,
            );
            await this.fixtureDetailCollector.collectLineups(
              f.apiFootballId,
              f.id,
            );
            await this.fixtureDetailCollector.collectEvents(
              f.apiFootballId,
              f.id,
            );
            await this.fixtureDetailCollector.collectPlayerStats(
              f.apiFootballId,
              f.id,
            );
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

        const avg = (arr: (number | null)[]) => {
          const valid = arr.filter((v): v is number => v !== null);
          return valid.length > 0
            ? valid.reduce((a, b) => a + b, 0) / valid.length
            : null;
        };

        for (const { teamId } of teams) {
          // Own fixture statistics (avgXg, possession, shots, etc.)
          const stats = await this.prisma.fixtureStatistics.findMany({
            where: {
              teamId,
              fixture: { leagueId: league.id, season },
            },
          });

          if (stats.length === 0) continue;

          // Completed fixtures: goals scored/conceded + opponent xG
          const fixtures = await this.prisma.fixture.findMany({
            where: {
              leagueId: league.id,
              season,
              status: { in: ["FT", "AET", "PEN", "AWD", "WO"] },
              OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            },
            select: {
              id: true,
              homeTeamId: true,
              goalsHome: true,
              goalsAway: true,
            },
          });

          let totalGoals = 0;
          let totalConceded = 0;
          for (const f of fixtures) {
            const isHome = f.homeTeamId === teamId;
            totalGoals += isHome ? (f.goalsHome ?? 0) : (f.goalsAway ?? 0);
            totalConceded += isHome ? (f.goalsAway ?? 0) : (f.goalsHome ?? 0);
          }

          // avgXgAgainst: opponent's expectedGoals in fixtures our team played
          const fixtureIds = fixtures.map((f) => f.id);
          const opponentStats =
            fixtureIds.length > 0
              ? await this.prisma.fixtureStatistics.findMany({
                  where: { fixtureId: { in: fixtureIds }, NOT: { teamId } },
                  select: { expectedGoals: true },
                })
              : [];

          const aggData = {
            avgPossession: avg(stats.map((s) => s.possession)),
            avgXg: avg(stats.map((s) => s.expectedGoals)),
            avgXgAgainst: avg(opponentStats.map((s) => s.expectedGoals)),
            avgShots: avg(stats.map((s) => s.totalShots)),
            avgShotsOnTarget: avg(stats.map((s) => s.shotsOnGoal)),
            avgPasses: avg(stats.map((s) => s.totalPasses)),
            avgPassAccuracy: avg(stats.map((s) => s.passPercent)),
            totalGoals: fixtures.length > 0 ? totalGoals : null,
            totalConceded: fixtures.length > 0 ? totalConceded : null,
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
