/**
 * Creates a bare Express app for integration testing (no server.listen).
 * Reuses the exact same middleware/route setup as src/index.ts.
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { leaguesRouter } from '../src/routes/leagues';
import { teamsRouter } from '../src/routes/teams';
import { playersRouter } from '../src/routes/players';
import { fixturesRouter } from '../src/routes/fixtures';
import { injuriesRouter } from '../src/routes/injuries';
import { standingsRouter } from '../src/routes/standings';
import { analysisRouter } from '../src/routes/analysis';
import { watchlistRouter } from '../src/routes/watchlist';
import { analysisLimiter, apiBaseLimiter } from '../src/middleware/rate-limit';
import { requireAuth } from '../src/middleware/auth';

export function createTestApp() {
  const prisma = new PrismaClient();
  const app = express();

  app.use(express.json());
  app.use('/api', apiBaseLimiter);

  app.use((req, _res, next) => {
    (req as any).prisma = prisma;
    next();
  });

  app.use('/api/leagues', leaguesRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/fixtures', fixturesRouter);
  app.use('/api/injuries', injuriesRouter);
  app.use('/api/standings', standingsRouter);
  app.use('/api/analysis', analysisLimiter, analysisRouter);
  app.use('/api/watchlist', requireAuth, watchlistRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, prisma };
}
