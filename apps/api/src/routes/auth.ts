import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// ─── Handlers ─────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;

    try {
      const userId = verifyRefreshToken(oldRefreshToken);
      
      // Optionally check if user still exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Placeholder for logout (client should discard tokens)
 */
router.post('/logout', (req, res) => {
  // In a real app with token blacklisting, we'd add the token to a blocklist here
  res.json({ message: 'Logged out successfully' });
});

export default router;
