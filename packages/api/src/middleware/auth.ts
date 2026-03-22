import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

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
    );
    req.userId = payload['userId'] as string;
    req.userTier = (payload['tier'] as string) ?? 'free';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
