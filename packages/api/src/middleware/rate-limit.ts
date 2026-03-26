import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const ONE_MINUTE_MS = 60 * 1000;

const API_BASE_LIMIT = 120;
const ANALYSIS_LIMIT = 30;
const WATCHLIST_READ_LIMIT = 60;
const WATCHLIST_WRITE_LIMIT = 20;

function sendRateLimitResponse(_req: Request, res: Response): void {
  res.status(429).json({
    error: 'RATE_LIMITED',
    message: 'Too many requests',
  });
}

function createLimiter(limit: number) {
  return rateLimit({
    windowMs: ONE_MINUTE_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
    handler: sendRateLimitResponse,
  });
}

export const apiBaseLimiter = createLimiter(API_BASE_LIMIT);
export const analysisLimiter = createLimiter(ANALYSIS_LIMIT);
export const watchlistReadLimiter = createLimiter(WATCHLIST_READ_LIMIT);
export const watchlistWriteLimiter = createLimiter(WATCHLIST_WRITE_LIMIT);
