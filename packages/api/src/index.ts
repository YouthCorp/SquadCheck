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

const prisma = new PrismaClient();
const app = express();

const PORT = parseInt(process.env.PORT || '4000');
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

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
app.use('/api/analysis', analysisRouter);
app.use('/api/admin', adminAuth, adminRouter);

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

app.listen(PORT, () => {
  console.log(`SquadCheck API running on http://localhost:${PORT}`);
});
