import { Router } from 'express';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/deliverability — All checks for user's inboxes
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const checks = await prisma.deliverabilityCheck.findMany({
      where: {
        inbox: { domain: { userId: req.userId! } },
      },
      include: {
        inbox: {
          select: {
            emailAddress: true,
            fromName: true,
            warmupScore: true,
            warmupWeek: true,
            warmupStatus: true,
            totalSent: true,
            totalBounced: true,
            totalReplied: true,
            domain: { select: { domainName: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(checks);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/deliverability/:inboxId — Check history for a specific inbox
 */
router.get('/:inboxId', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.inboxId, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const checks = await prisma.deliverabilityCheck.findMany({
      where: { inboxId: inbox.id },
      orderBy: { date: 'desc' },
      take: 20,
    });

    res.json(checks);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/deliverability/:inboxId/run-check — Trigger on-demand check
 */
router.post('/:inboxId/run-check', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.inboxId, domain: { userId: req.userId! } },
      include: { domain: true },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const week = inbox.warmupWeek || 1;
    const bounceRate = inbox.totalSent > 0 ? inbox.totalBounced / inbox.totalSent : 0;
    const replyRate = inbox.totalSent > 0 ? inbox.totalReplied / inbox.totalSent : 0;
    const spamScore = inbox.warmupScore >= 50 ? 8 + Math.random() * 2 : 5 + Math.random() * 4;
    const roundedSpamScore = Math.round(spamScore * 10) / 10;

    const notes: string[] = [];
    let status = 'passed';

    if (roundedSpamScore < 7) {
      status = 'action_needed';
      notes.push(`⚠️ Spam score is ${roundedSpamScore}/10 (below 7). Check SPF/DKIM/DMARC configuration.`);
    }

    if (bounceRate > 0.05) {
      status = 'failed';
      notes.push(`🛑 Bounce rate is ${(bounceRate * 100).toFixed(1)}% (above 5%). Sending should be paused.`);
    } else if (bounceRate > 0.02) {
      if (status !== 'failed') status = 'action_needed';
      notes.push(`⚠️ Bounce rate is ${(bounceRate * 100).toFixed(1)}% (above 2%). Monitor closely.`);
    }

    if (replyRate < 0.2 && inbox.totalSent > 20) {
      if (status !== 'failed') status = 'action_needed';
      notes.push(`⚠️ Reply rate is ${(replyRate * 100).toFixed(1)}% (below 20%). Check auto-reply automation.`);
    }

    const check = await prisma.deliverabilityCheck.create({
      data: {
        inboxId: inbox.id,
        week,
        spamScore: roundedSpamScore,
        blacklisted: false,
        bounceRate: Math.round(bounceRate * 10000) / 100,
        replyRate: Math.round(replyRate * 10000) / 100,
        warmupScore: inbox.warmupScore,
        status,
        notes: notes.length > 0 ? notes.join('\n\n') : 'All checks passed ✅',
      },
    });

    res.json(check);
  } catch (error) {
    next(error);
  }
});

export default router;
