import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';
import { buildLatestAppearanceMap } from '@squadcheck/analysis';

export const injuriesRouter = Router();

const TOP5_LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
const FEED_TABS = ['injuries', 'recovery'] as const;
const FEED_STATUS = ['all', 'active_only', 'returned_only', 'signal', 'returned'] as const;

type FeedTab = (typeof FEED_TABS)[number];
type FeedStatus = (typeof FEED_STATUS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseFeedTab(input: unknown): FeedTab {
  return input === 'recovery' ? 'recovery' : 'injuries';
}

function parseFeedStatus(input: unknown, tab: FeedTab): FeedStatus {
  if (typeof input !== 'string') return 'all';
  if (!FEED_STATUS.includes(input as FeedStatus)) throw new Error('INVALID_STATUS');
  if (tab === 'injuries' && ['all', 'active_only', 'returned_only'].includes(input)) return input as FeedStatus;
  if (tab === 'recovery' && ['all', 'signal', 'returned'].includes(input)) return input as FeedStatus;
  throw new Error('INVALID_STATUS');
}

function parsePositiveInt(input: unknown, fallback: number, max?: number): number {
  const parsed = typeof input === 'string' ? parseInt(input, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function getFeedEventTypes(tab: FeedTab, status: FeedStatus): string[] {
  if (tab === 'injuries') {
    if (status === 'active_only') return ['new_injury'];
    if (status === 'returned_only') return ['returned_to_squad'];
    return ['new_injury', 'returned_to_squad'];
  }

  if (status === 'signal') return ['recovery_signal_started', 'recovery_signal_upgraded'];
  if (status === 'returned') return ['returned_to_squad'];
  return ['recovery_signal_started', 'recovery_signal_upgraded', 'returned_to_squad'];
}

function mapFeedEventToResponse(event: any) {
  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const articleTitle = typeof metadata.articleTitle === 'string' ? metadata.articleTitle : null;
  const articleUrl = typeof metadata.articleUrl === 'string' ? metadata.articleUrl : null;
  const sourceName = typeof metadata.sourceName === 'string' ? metadata.sourceName : null;
  const resolvedAt = typeof metadata.resolvedAt === 'string' ? metadata.resolvedAt : null;

  return {
    id: event.id,
    eventType: event.eventType,
    eventTime: event.eventTime,
    player: event.player,
    team: event.team,
    leagueApiFootballId: event.leagueApiId,
    title: event.title,
    summary: event.summary,
    injury: metadata.injuryReason || metadata.injuryType
      ? {
          reason: typeof metadata.injuryReason === 'string' ? metadata.injuryReason : null,
          type: typeof metadata.injuryType === 'string' ? metadata.injuryType : null,
        }
      : null,
    recovery: typeof metadata.predictedAvailability === 'number'
      ? {
          predictedAvailability: metadata.predictedAvailability,
          confidenceLevel: typeof metadata.confidenceLevel === 'number' ? metadata.confidenceLevel : 0,
          latestSignalStage: typeof metadata.latestSignalStage === 'string' ? metadata.latestSignalStage : null,
          signalCount: typeof metadata.signalCount === 'number' ? metadata.signalCount : 0,
        }
      : null,
    returnStatus: {
      isReturned: event.eventType === 'returned_to_squad',
      returnedAt: event.eventType === 'returned_to_squad' ? resolvedAt ?? event.eventTime : null,
    },
    article: articleTitle || articleUrl || sourceName
      ? {
          title: articleTitle,
          url: articleUrl,
          sourceName,
        }
      : null,
  };
}

// GET /api/injuries?league=39&season=2024&page=1&limit=50
injuriesRouter.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = req.query.league ? parseInt(req.query.league as string) : undefined;
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (leagueApiId) {
      const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
      if (league) where.leagueId = league.id;
    }
    if (season) where.season = season;

    const [injuries, total] = await Promise.all([
      prisma.injury.findMany({
        where,
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          team: { select: { id: true, name: true, logo: true } },
          fixture: { select: { id: true, date: true, round: true } },
        },
        orderBy: { fixtureDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.injury.count({ where }),
    ]);

    res.json({
      data: injuries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/feed?tab=injuries|recovery&page=1&limit=30
injuriesRouter.get('/feed', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const season = await resolveSeason(prisma, req.query.season as string);
    const tab = parseFeedTab(req.query.tab);
    const status = parseFeedStatus(req.query.status, tab);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 30, 100);
    const skip = (page - 1) * limit;
    const leagueApiId = req.query.league ? parseInt(req.query.league as string, 10) : null;
    const teamId = req.query.teamId ? parseInt(req.query.teamId as string, 10) : null;

    if (req.query.tab && !FEED_TABS.includes(req.query.tab as FeedTab)) {
      return res.status(400).json({ error: 'Invalid tab' });
    }
    if ((req.query.league && Number.isNaN(leagueApiId)) || (req.query.teamId && Number.isNaN(teamId))) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const cacheKey = `injuries:feed:${season}:${tab}:${status}:${page}:${limit}:${leagueApiId ?? 'all'}:${teamId ?? 'all'}`;

    const result = await cached(cacheKey, 60, async () => {
      const eventTypes = getFeedEventTypes(tab, status);
      const where: any = {
        season,
        eventType: { in: eventTypes },
      };
      if (leagueApiId) where.leagueApiId = leagueApiId;
      if (teamId) where.teamId = teamId;

      const [items, total] = await Promise.all([
        prisma.injuryFeedEvent.findMany({
          where,
          include: {
            player: { select: { id: true, name: true, photo: true, position: true } },
            team: { select: { id: true, name: true, logo: true } },
          },
          orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.injuryFeedEvent.count({ where }),
      ]);

      return {
        items: items.map(mapFeedEventToResponse),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        appliedFilters: {
          tab,
          status,
          season,
          league: leagueApiId,
          teamId,
        },
      };
    });

    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_STATUS') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    next(err);
  }
});

// GET /api/injuries/feed/filters
injuriesRouter.get('/feed/filters', async (_req, res, next) => {
  try {
    const prisma = getPrisma(_req);
    const cacheKey = 'injuries:feed:filters:top5';
    const result = await cached(cacheKey, 300, async () => {
      const leagues = await prisma.league.findMany({
        where: { apiFootballId: { in: [...TOP5_LEAGUE_IDS] } },
        select: { apiFootballId: true, name: true, logo: true },
        orderBy: { apiFootballId: 'asc' },
      });
      return { leagues };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/feed/:playerId/history
injuriesRouter.get('/feed/:playerId/history', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.playerId, 10);
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid playerId' });
    }

    const cacheKey = `injuries:feed:history:${playerId}`;
    const result = await cached(cacheKey, 60, async () => {
      const items = await prisma.injuryFeedEvent.findMany({
        where: { playerId },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          team: { select: { id: true, name: true, logo: true } },
        },
        orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
        take: 50,
      });
      return { items: items.map(mapFeedEventToResponse) };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/live-updates?season=2025
injuriesRouter.get('/live-updates', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `injuries:live-updates:${season}`;

    const result = await cached(cacheKey, 60, async () => {
      const now = new Date();
      const cutoff = new Date(Date.now() - 45 * 86_400_000);
      const SQUAD_STATUS_REASONS = ['inactive', 'loan agreement'];

      const [rawInjuries, leagues] = await Promise.all([
        prisma.playerInjuryStatus.findMany({
          where: {
            leagueApiId: { in: [...TOP5_LEAGUE_IDS] },
            season,
            isActive: true,
            injuredSince: { gte: cutoff, lte: now },
            NOT: { reason: { in: SQUAD_STATUS_REASONS, mode: 'insensitive' } },
          },
          include: {
            player: { select: { id: true, name: true, photo: true, position: true } },
            team: { select: { id: true, name: true, logo: true } },
          },
          orderBy: { injuredSince: 'desc' },
          take: 60,
        }),
        prisma.league.findMany({
          where: { apiFootballId: { in: [...TOP5_LEAGUE_IDS] } },
          select: { id: true, name: true, logo: true, apiFootballId: true },
        }),
      ]);

      type LeagueInfo = { id: number; name: string; logo: string | null; apiFootballId: number };
      const leagueMap = new Map<number, LeagueInfo>((leagues as LeagueInfo[]).map((league) => [league.apiFootballId, league]));

      const injuredPlayerIds = rawInjuries.map((injury: { playerId: number }) => injury.playerId);
      const appearances = await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: injuredPlayerIds },
          lineup: { fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } } },
        },
        select: {
          playerId: true,
          lineup: { select: { fixture: { select: { date: true } } } },
        },
      });
      const lastAppearanceDateMap = buildLatestAppearanceMap(appearances);

      type RawInjury = {
        id: number;
        playerId: number;
        type: string | null;
        reason: string | null;
        injuredSince: Date | null;
        leagueApiId: number;
        player: { id: number; name: string; photo: string | null; position: string | null };
        team: { id: number; name: string; logo: string | null };
      };
      type MappedInjury = {
        id: number;
        type: string;
        reason: string;
        fixtureDate: string;
        lastAppearanceFixtureDate: string | null;
        player: RawInjury['player'];
        team: RawInjury['team'];
        league: { id: number; name: string; logo: string | null; apiFootballId: number };
      };

      const recentInjuries = (rawInjuries as RawInjury[])
        .filter((injury) => lastAppearanceDateMap.has(injury.playerId))
        .map((injury): MappedInjury => ({
          id: injury.id,
          type: injury.type ?? '',
          reason: injury.reason ?? '',
          fixtureDate: injury.injuredSince?.toISOString() ?? new Date(0).toISOString(),
          lastAppearanceFixtureDate: lastAppearanceDateMap.get(injury.playerId)?.toISOString() ?? null,
          player: injury.player,
          team: injury.team,
          league: leagueMap.get(injury.leagueApiId) ?? { id: 0, name: '', logo: null, apiFootballId: injury.leagueApiId },
        }))
        .sort((a, b) => {
          const dateA = a.lastAppearanceFixtureDate ?? a.fixtureDate;
          const dateB = b.lastAppearanceFixtureDate ?? b.fixtureDate;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
        .slice(0, 20);

      const allSignals = await prisma.playerAvailability.findMany({
        where: { expired: false, signalCount: { gt: 0 } },
        orderBy: { lastSignalAt: 'desc' },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          fixture: {
            select: {
              id: true,
              date: true,
              homeTeam: { select: { id: true, name: true, logo: true } },
              awayTeam: { select: { id: true, name: true, logo: true } },
            },
          },
        },
        take: 200,
      });

      const activelyInjuredPlayerIds = new Set(
        (rawInjuries as RawInjury[]).map((injury) => injury.playerId),
      );

      const seenSignal = new Set<number>();
      const dedupedSignals = allSignals
        .filter((availability) => activelyInjuredPlayerIds.has(availability.playerId))
        .filter((availability) => {
          if (seenSignal.has(availability.playerId)) return false;
          seenSignal.add(availability.playerId);
          return true;
        })
        .slice(0, 20);

      const teamIds = [...new Set(dedupedSignals.map((signal) => signal.teamId))];
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true, logo: true },
      });
      const teamMap = new Map(teams.map((team) => [team.id, team]));

      const signalLeagueApiIdMap = new Map<number, number>(
        (rawInjuries as RawInjury[]).map((injury) => [injury.playerId, injury.leagueApiId]),
      );

      const recentSignals = dedupedSignals.map((availability) => ({
        playerId: availability.playerId,
        player: availability.player,
        team: teamMap.get(availability.teamId) ?? null,
        leagueApiFootballId: signalLeagueApiIdMap.get(availability.playerId) ?? null,
        predictedAvailability: availability.predictedAvailability,
        confidenceLevel: availability.confidenceLevel,
        latestSignalStage: availability.latestSignalStage,
        lastSignalAt: availability.lastSignalAt,
        signalCount: availability.signalCount,
        officialStatus: availability.officialStatus,
        upcomingFixture: availability.fixture ? {
          id: availability.fixture.id,
          date: availability.fixture.date,
          homeTeam: {
            id: availability.fixture.homeTeam.id,
            name: availability.fixture.homeTeam.name,
            logo: availability.fixture.homeTeam.logo,
          },
          awayTeam: {
            id: availability.fixture.awayTeam.id,
            name: availability.fixture.awayTeam.name,
            logo: availability.fixture.awayTeam.logo,
          },
        } : null,
      }));

      return { recentInjuries, recentSignals };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/summary?league=39&season=2024
injuriesRouter.get('/summary', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = req.query.league ? parseInt(req.query.league as string) : undefined;
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `injuries:summary:${leagueApiId}:${season}`;

    const summary = await cached(cacheKey, 300, async () => {
      const where: any = { season };
      if (leagueApiId) {
        const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
        if (league) where.leagueId = league.id;
      }

      const grouped = await prisma.injury.groupBy({
        by: ['teamId'],
        where,
        _count: { id: true },
      });

      const teams = await prisma.team.findMany({
        where: { id: { in: grouped.map((group) => group.teamId) } },
        select: { id: true, name: true, logo: true },
      });

      const teamMap = new Map(teams.map((team) => [team.id, team]));

      return grouped
        .map((group) => ({
          team: teamMap.get(group.teamId),
          injuryCount: group._count.id,
        }))
        .sort((a, b) => b.injuryCount - a.injuryCount);
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});
