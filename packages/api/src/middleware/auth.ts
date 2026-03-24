import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const API_TOKEN_ISSUER = 'squadcheck-frontend';
const API_TOKEN_AUDIENCE = 'squadcheck-api';

// Extends Express Request with auth fields populated by requireAuth
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userTier?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error('[Auth] AUTH_SECRET not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ['HS256'],
        issuer: API_TOKEN_ISSUER,
        audience: API_TOKEN_AUDIENCE,
      },
    );

    const userId = payload['userId'];
    if (typeof userId !== 'string' || userId.length === 0) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const prisma = (req as Request & { prisma?: PrismaClient }).prisma;
    if (!prisma) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tier: true },
    });

    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.userId = userId;
    req.userTier = currentUser.tier;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
