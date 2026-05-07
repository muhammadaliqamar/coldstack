import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// ─── Schemas ──────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────

/**
 * GET /api/templates — List all templates for the user
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates — Create a new template
 */
router.post('/', validate(templateSchema), async (req: AuthRequest, res, next) => {
  try {
    const { name, subject, bodyHtml, bodyText } = req.body;
    const template = await prisma.emailTemplate.create({
      data: {
        userId: req.userId!,
        name,
        subject,
        bodyHtml,
        bodyText,
      },
    });
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id — Update an existing template
 */
router.put('/:id', validate(templateSchema), async (req: AuthRequest, res, next) => {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { name, subject, bodyHtml, bodyText } = req.body;
    const updated = await prisma.emailTemplate.update({
      where: { id: template.id },
      data: { name, subject, bodyHtml, bodyText },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id — Delete a template
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.emailTemplate.delete({ where: { id: template.id } });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
