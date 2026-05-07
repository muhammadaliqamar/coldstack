import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

/**
 * JWT authentication middleware.
 * Extracts user ID from Bearer token and attaches to req.userId.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.userId = payload.userId;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Generate JWT access token (15 min) and refresh token (7 days).
 */
export function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify a refresh token and return the user ID.
 */
export function verifyRefreshToken(token: string): string {
  const payload = jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key'
  ) as { userId: string; type: string };

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload.userId;
}
