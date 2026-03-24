import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { leaguesRouter } from './routes/leagues';
import { teamsRouter } from './routes/teams';
import { playersRouter } from './routes/players';
import { fixturesRouter } from './routes/fixtures';
import { injuriesRouter } from './routes/injuries';
import { standingsRouter } from './routes/standings';
import { analysisRouter } from './routes/analysis';
import { adminRouter } from './routes/admin';
import { watchlistRouter } from './routes/watchlist';
import { requireAuth } from './middleware/auth';
import { analysisLimiter, apiBaseLimiter } from './middleware/rate-limit';

// Cap the connection pool to avoid "too many clients" on Railway's shared PostgreSQL.
// Appended to DATABASE_URL so it works with Railway's internal URL format.
function buildDbUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url || url.includes('connection_limit')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'connection_limit=5';
}

const prisma = new PrismaClient({ datasources: { db: { url: buildDbUrl() } } });
const app = express();

const PORT = parseInt(process.env.PORT || '4000');
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());
app.use('/api', apiBaseLimiter);

// HTTP Basic Auth guard for admin routes
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return next(); // No password set → open (local dev)

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
    if (password === pw) return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="SquadCheck Admin"');
  res.status(401).send('Unauthorized');
}

// Attach prisma to request
app.use((req, _res, next) => {
  (req as any).prisma = prisma;
  next();
});

// Routes
app.use('/api/leagues', leaguesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);
app.use('/api/fixtures', fixturesRouter);
app.use('/api/injuries', injuriesRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/analysis', analysisLimiter, analysisRouter);
app.use('/api/admin', adminAuth, adminRouter);
app.use('/api/watchlist', requireAuth, watchlistRouter);

// Admin dashboard — serves the standalone HTML page
app.get('/admin', adminAuth, (_req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'admin', 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Admin page not found');
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.1', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`SquadCheck API running on http://localhost:${PORT}`);
});

// Graceful shutdown — Railway sends SIGTERM before killing the container.
// Closing the server + disconnecting Prisma ensures DB connections are released
// before the process exits, preventing "too many clients" during restart cycles.
process.on('SIGTERM', async () => {
  console.log('[API] SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
