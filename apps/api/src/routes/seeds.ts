import { Router } from 'express';
import { prisma } from '@coldstack/db';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '@coldstack/mailer/encryption';

const router = Router();
router.use(authenticate);

const seedSchema = z.object({
  email: z.string().email(),
  provider: z.enum(['gmail', 'outlook', 'custom']),
  type: z.enum(['seed', 'real']),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
});

/**
 * GET /api/seeds
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const seeds = await prisma.seedAccount.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    
    // Do not return actual passwords to the frontend
    const sanitized = seeds.map(s => ({
      ...s,
      smtpPass: '***',
      imapPass: s.imapPass ? '***' : null,
    }));
    
    res.json(sanitized);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/seeds
 */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = seedSchema.parse(req.body);
    
    // Check if email already exists
    const existing = await prisma.seedAccount.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ error: 'Seed account with this email already exists' });
    }

    const seed = await prisma.seedAccount.create({
      data: {
        ...data,
        userId: req.userId!,
        smtpPass: encrypt(data.smtpPass),
        imapPass: data.imapPass ? encrypt(data.imapPass) : null,
      },
    });

    res.status(201).json({ ...seed, smtpPass: '***', imapPass: seed.imapPass ? '***' : null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    next(err);
  }
});

/**
 * PUT /api/seeds/:id/toggle
 */
router.put('/:id/toggle', async (req: AuthRequest, res, next) => {
  try {
    const seed = await prisma.seedAccount.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!seed) return res.status(404).json({ error: 'Seed account not found' });

    const updated = await prisma.seedAccount.update({
      where: { id: seed.id },
      data: { isActive: !seed.isActive },
    });

    res.json({ ...updated, smtpPass: '***', imapPass: updated.imapPass ? '***' : null });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/seeds/:id
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const seed = await prisma.seedAccount.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!seed) return res.status(404).json({ error: 'Seed account not found' });

    await prisma.seedAccount.delete({ where: { id: seed.id } });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
