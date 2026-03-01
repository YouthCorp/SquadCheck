import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { cached } from './cache';

export function getPrisma(req: Request): PrismaClient {
  return (req as any).prisma;
}

/**
 * Resolve the season year to use.
 * If the caller supplied ?season=XXXX, use that.
 * Otherwise, look up the current season (current=true) in the DB.
 * Falls back to current calendar year if nothing is marked current.
 */
export async function resolveSeason(
  prisma: PrismaClient,
  querySeason: string | undefined,
): Promise<number> {
  if (querySeason) {
    const parsed = parseInt(querySeason);
    if (!isNaN(parsed)) return parsed;
  }

  return cached('meta:current-season', 600, async () => {
    const current = await prisma.season.findFirst({
      where: { current: true },
      select: { year: true },
      orderBy: { year: 'desc' },
    });
    return current?.year ?? new Date().getFullYear();
  });
}
