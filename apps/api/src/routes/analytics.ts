import { Router } from 'express';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /overview — Last 30 days stats
router.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where = { lead: { campaign: { userId: req.userId! } }, createdAt: { gte: thirtyDaysAgo } };

    const [totalSent, totalOpened, totalReplied, totalBounced, totalClicked] = await Promise.all([
      prisma.emailLog.count({ where: { ...where, status: { not: 'failed' } } }),
      prisma.emailLog.count({ where: { ...where, openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, repliedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, bouncedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, clickedAt: { not: null } } }),
    ]);

    const conversions = await prisma.lead.count({
      where: { campaign: { userId: req.userId! }, stage: 'converted', updatedAt: { gte: thirtyDaysAgo } },
    });

    // Daily breakdown for charts
    const dailyStats = await prisma.$queryRawUnsafe(`
      SELECT DATE(el."sentAt") as date, COUNT(*) as sent,
        COUNT(CASE WHEN el."openedAt" IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN el."repliedAt" IS NOT NULL THEN 1 END) as replied
      FROM email_logs el
      JOIN leads l ON el."leadId" = l.id
      JOIN campaigns c ON l."campaignId" = c.id
      WHERE c."userId" = $1 AND el."sentAt" >= $2
      GROUP BY DATE(el."sentAt") ORDER BY date ASC
    `, req.userId!, thirtyDaysAgo);

    res.json({
      totalSent, totalOpened, totalReplied, totalBounced, totalClicked, conversions,
      openRate: totalSent ? totalOpened / totalSent : 0,
      replyRate: totalSent ? totalReplied / totalSent : 0,
      bounceRate: totalSent ? totalBounced / totalSent : 0,
      conversionRate: totalSent ? conversions / totalSent : 0,
      dailyStats,
    });
  } catch (error) { next(error); }
});

// GET /campaigns/:id — Per-campaign breakdown
router.get('/campaigns/:id', async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { sequences: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const sequenceStats = await Promise.all(campaign.sequences.map(async (s: any) => {
      const sent = await prisma.emailLog.count({ where: { sequenceId: s.id } });
      const opened = await prisma.emailLog.count({ where: { sequenceId: s.id, openedAt: { not: null } } });
      const clicked = await prisma.emailLog.count({ where: { sequenceId: s.id, clickedAt: { not: null } } });
      const replied = await prisma.emailLog.count({ where: { sequenceId: s.id, repliedAt: { not: null } } });
      const bounced = await prisma.emailLog.count({ where: { sequenceId: s.id, bouncedAt: { not: null } } });
      return { stepNumber: s.stepNumber, subject: s.subject, sent, opened, clicked, replied, bounced };
    }));

    res.json({ campaign: { id: campaign.id, name: campaign.name, status: campaign.status }, sequenceStats });
  } catch (error) { next(error); }
});

// GET /inboxes — Per-inbox health
router.get('/inboxes', async (req: AuthRequest, res, next) => {
  try {
    const inboxes = await prisma.inbox.findMany({
      where: { domain: { userId: req.userId! } },
      select: { id: true, emailAddress: true, warmupScore: true, warmupStatus: true, totalSent: true, totalBounced: true, totalReplied: true, dailySendLimit: true },
    });
    res.json(inboxes.map((i: any) => ({
      ...i,
      healthScore: i.warmupScore,
      replyRate: i.totalSent ? i.totalReplied / i.totalSent : 0,
      bounceRate: i.totalSent ? i.totalBounced / i.totalSent : 0,
    })));
  } catch (error) { next(error); }
});

// GET /funnel — Leads at each stage
router.get('/funnel', async (req: AuthRequest, res, next) => {
  try {
    const stages = ['new_lead','contacted','opened','clicked','replied','interested','demo_scheduled','converted','lost','unsubscribed'];
    const counts = await Promise.all(stages.map(async (stage) => ({
      stage,
      count: await prisma.lead.count({ where: { campaign: { userId: req.userId! }, stage: stage as any } }),
    })));
    res.json(counts);
  } catch (error) { next(error); }
});

// GET /warmup — Warmup-specific analytics with optional date filtering
router.get('/warmup', async (req: AuthRequest, res, next) => {
  try {
    const { date } = req.query;

    // Get all user's inboxes
    const inboxes = await prisma.inbox.findMany({
      where: { domain: { userId: req.userId! } },
      select: { id: true, emailAddress: true, warmupScore: true, warmupStatus: true, warmupWeek: true, totalSent: true, totalBounced: true, totalReplied: true, totalSpam: true, dailySendLimit: true },
    });

    const inboxIds = inboxes.map(i => i.id);

    // Build date filter
    let dateFilter: any = {};
    if (date && typeof date === 'string') {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      dateFilter = { date: { gte: dayStart, lte: dayEnd } };
    }

    // Aggregate warmup logs per inbox
    const inboxStats = await Promise.all(inboxes.map(async (inbox) => {
      const where = { inboxId: inbox.id, ...dateFilter };
      const [sent, replied, bounced] = await Promise.all([
        prisma.warmupLog.count({ where: { ...where, status: 'sent' } }),
        prisma.warmupLog.count({ where: { ...where, status: 'replied' } }),
        prisma.warmupLog.count({ where: { ...where, status: { in: ['bounced'] } } }),
      ]);
      const totalForPeriod = await prisma.warmupLog.count({ where });

      return {
        ...inbox,
        periodSent: sent,
        periodReplied: replied,
        periodBounced: bounced,
        periodTotal: totalForPeriod,
      };
    }));

    // Daily breakdown (last 30 days) — always returned for chart
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyStats = await prisma.warmupLog.groupBy({
      by: ['status'],
      where: { inboxId: { in: inboxIds }, date: { gte: thirtyDaysAgo } },
      _count: true,
    });

    // Per-day breakdown for chart
    const rawLogs = await prisma.warmupLog.findMany({
      where: { inboxId: { in: inboxIds }, date: { gte: thirtyDaysAgo } },
      select: { date: true, status: true },
      orderBy: { date: 'asc' },
    });

    // Group by date string
    const dailyBreakdown: Record<string, { date: string; sent: number; replied: number; bounced: number }> = {};
    for (const log of rawLogs) {
      const d = log.date.toISOString().slice(0, 10);
      if (!dailyBreakdown[d]) dailyBreakdown[d] = { date: d, sent: 0, replied: 0, bounced: 0 };
      if (log.status === 'sent') dailyBreakdown[d].sent++;
      else if (log.status === 'replied') dailyBreakdown[d].replied++;
      else if (log.status === 'bounced') dailyBreakdown[d].bounced++;
    }

    // Overall totals
    const totalSent = dailyStats.find(s => s.status === 'sent')?._count || 0;
    const totalReplied = dailyStats.find(s => s.status === 'replied')?._count || 0;
    const totalBounced = dailyStats.find(s => s.status === 'bounced')?._count || 0;

    res.json({
      inboxStats,
      totals: { totalSent, totalReplied, totalBounced },
      dailyBreakdown: Object.values(dailyBreakdown),
      filterDate: date || null,
    });
  } catch (error) { next(error); }
});

export default router;
