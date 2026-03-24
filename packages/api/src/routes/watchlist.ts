import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../lib/prisma';
import {
  watchlistReadLimiter,
  watchlistWriteLimiter,
} from '../middleware/rate-limit';

const router = Router();

const CURRENT_SEASON = 2025;
const FREE_TIER_LIMIT = 5;

router.use((req, res, next) => {
  const limiter = req.method === 'GET'
    ? watchlistReadLimiter
    : watchlistWriteLimiter;
  limiter(req, res, next);
});

// ─── GET /api/watchlist/players ──────────────────────────────────────────────
// Returns the user's watchlist with injury status + latest signal per player
router.get('/players', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);

  try {
    const entries = await prisma.watchlistPlayer.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        player: {
          include: {
            injuryStatuses: {
              where: { isActive: true, season: CURRENT_SEASON },
              include: { team: { select: { id: true, name: true, logo: true } } },
              take: 1,
            },
            playerAvailabilities: {
              where: { expired: false },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            seasonStats: {
              where: { leagueApiId: { in: [39, 140, 135, 78, 61] } },
              orderBy: { appearances: 'desc' },
              take: 1,
              include: { season: { select: { year: true } } },
            },
          },
        },
      },
    });

    const players = entries.map((e) => {
      const injuryStatus = e.player.injuryStatuses[0] ?? null;
      const availability = e.player.playerAvailabilities[0] ?? null;
      const team = injuryStatus?.team ?? null;

      return {
        id: e.id,
        addedAt: e.addedAt,
        player: {
          id: e.player.id,
          name: e.player.name,
          photo: e.player.photo,
          position: e.player.position,
        },
        team: team ? { id: team.id, name: team.name, logo: team.logo } : null,
        injuryStatus: injuryStatus
          ? {
              isActive: injuryStatus.isActive,
              reason: injuryStatus.reason,
              type: injuryStatus.type,
              injuredSince: injuryStatus.injuredSince,
              leagueApiId: injuryStatus.leagueApiId,
            }
          : null,
        latestSignal: availability
          ? {
              predictedAvailability: availability.predictedAvailability,
              signalStage: availability.latestSignalStage,
              lastSignalAt: availability.lastSignalAt,
            }
          : null,
      };
    });

    res.json({ players });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/watchlist/players ─────────────────────────────────────────────
// Add a player to watchlist (5-slot limit for free tier)
router.post('/players', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const userTier = req.userTier ?? 'free';
  const prisma = getPrisma(req);

  const playerId = parseInt(req.body?.playerId);
  if (!playerId || isNaN(playerId)) {
    res.status(400).json({ error: 'Invalid playerId' });
    return;
  }

  try {
    // Verify player exists
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Slot limit check
    if (userTier === 'free') {
      const count = await prisma.watchlistPlayer.count({ where: { userId } });
      if (count >= FREE_TIER_LIMIT) {
        res.status(403).json({ error: 'WATCHLIST_FULL', limit: FREE_TIER_LIMIT });
        return;
      }
    }

    const entry = await prisma.watchlistPlayer.create({
      data: { userId, playerId },
      select: { id: true, playerId: true, addedAt: true },
    });

    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Already watching this player' });
      return;
    }
    next(err);
  }
});

// ─── DELETE /api/watchlist/players/:playerId ──────────────────────────────────
// Remove by playerId (Int) — simpler than cuid for frontend
router.delete('/players/:playerId', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);

  const playerId = parseInt(String(req.params.playerId));
  if (isNaN(playerId)) {
    res.status(400).json({ error: 'Invalid playerId' });
    return;
  }

  try {
    const { count } = await prisma.watchlistPlayer.deleteMany({
      where: { userId, playerId },
    });
    if (count === 0) {
      res.status(404).json({ error: 'Watchlist entry not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/watchlist/alerts ───────────────────────────────────────────────
// Paginated alerts list
router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);

  const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'))));
  const skip = (page - 1) * limit;

  try {
    const [alerts, total, unreadCount] = await Promise.all([
      prisma.watchlistAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
        },
      }),
      prisma.watchlistAlert.count({ where: { userId } }),
      prisma.watchlistAlert.count({ where: { userId, readAt: null } }),
    ]);

    res.json({ alerts, unreadCount, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/watchlist/alerts/:id/read ────────────────────────────────────
// Mark alert as read (idempotent)
router.patch('/alerts/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);
  const id = String(req.params.id);

  try {
    const { count } = await prisma.watchlistAlert.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (count === 0) {
      // Either not found, wrong user, or already read — fetch to distinguish
      const alert = await prisma.watchlistAlert.findFirst({ where: { id, userId }, select: { id: true, readAt: true } });
      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      // Already read — idempotent, return current state
      res.json(alert);
      return;
    }

    // Return the readAt we just set — no extra query needed
    res.json({ id, readAt: new Date() });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/watchlist/alerts/read-all ────────────────────────────────────
// Mark all unread alerts as read
router.patch('/alerts/read-all', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);

  try {
    const { count } = await prisma.watchlistAlert.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/watchlist/push-subscription ───────────────────────────────────
// Save VAPID push subscription
router.post('/push-subscription', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);
  const { subscription } = req.body ?? {};

  if (!subscription?.endpoint || !subscription?.keys) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { pushSubscription: subscription },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/watchlist/settings ───────────────────────────────────────────
// Update emailAlerts and/or locale
router.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId!;
  const prisma = getPrisma(req);
  const { emailAlerts, locale } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (typeof emailAlerts === 'boolean') data.emailAlerts = emailAlerts;
  if (locale === 'en' || locale === 'ko') data.locale = locale;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { emailAlerts: true, locale: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export { router as watchlistRouter };
