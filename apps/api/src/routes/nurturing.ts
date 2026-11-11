import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const funnelStepSchema = z.object({
  funnel: z.enum(['tofu', 'mofu', 'bofu']),
  step: z.number().int().min(1).max(10),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  delayDays: z.number().int().min(1).optional(),
});

/**
 * GET /api/nurturing — Get all nurturing steps configured in the system
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const steps = await prisma.funnelStep.findMany({
      orderBy: [
        { funnel: 'asc' },
        { step: 'asc' }
      ]
    });
    res.json(steps);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/nurturing — Configure or save a nurturing step
 */
router.post('/', validate(funnelStepSchema), async (req: AuthRequest, res, next) => {
  try {
    const { funnel, step, subject, bodyHtml, bodyText, delayDays } = req.body;

    const stepConfig = await prisma.funnelStep.upsert({
      where: {
        funnel_step: {
          funnel: funnel as any,
          step,
        }
      },
      update: {
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        delayDays: delayDays || 3,
      },
      create: {
        funnel: funnel as any,
        step,
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        delayDays: delayDays || 3,
      }
    });

    res.json({ message: 'Nurturing step saved successfully', step: stepConfig });
  } catch (error) {
    next(error);
  }
});

export default router;
