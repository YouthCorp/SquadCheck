import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildDbUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url || url.includes('connection_limit')) return url;
  // Vercel serverless: keep pool tiny to avoid exhausting Railway connections
  return url + (url.includes('?') ? '&' : '?') + 'connection_limit=2';
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ datasources: { db: { url: buildDbUrl() } } });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
