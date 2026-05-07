import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { campaignScheduleQueue } from '@coldstack/queue';

const router = Router();
router.use(authenticate);

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  emailListId: z.string().optional(),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  dailyLimit: z.number().int().min(1).max(1000).default(50),
  timezone: z.string().default('UTC'),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  unsubFooter: z.string().optional(),
  inboxIds: z.array(z.string()).optional(),
  sequences: z.array(z.object({
    stepNumber: z.number().int().min(1),
    subject: z.string().min(1),
    bodyHtml: z.string().min(1),
    bodyText: z.string().optional(),
    delayDays: z.number().int().min(0).default(0),
    condition: z.enum(['always', 'not_opened', 'not_replied', 'opened_not_replied']).default('always'),
  })).optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

// POST / — Create campaign
router.post('/', validate(createCampaignSchema), async (req: AuthRequest, res, next) => {
  try {
    const { inboxIds, sequences, scheduleStart, scheduleEnd, ...data } = req.body;
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        userId: req.userId!,
        scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
        scheduleEnd: scheduleEnd ? new Date(scheduleEnd) : null,
        campaignInboxes: inboxIds?.length ? { create: inboxIds.map((inboxId: string) => ({ inboxId })) } : undefined,
        sequences: sequences?.length ? { create: sequences } : undefined,
      },
      include: { sequences: true, campaignInboxes: { include: { inbox: { select: { emailAddress: true, warmupScore: true } } } }, emailList: { select: { name: true, totalContacts: true } } },
    });
    res.status(201).json(campaign);
  } catch (error) { next(error); }
});

// GET / — List campaigns
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const status = req.query.status as string;
    const where: any = { userId: req.userId! };
    if (status) where.status = status;
    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        emailList: { select: { name: true, totalContacts: true } },
        _count: { select: { leads: true, sequences: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach stats
    const result = await Promise.all(campaigns.map(async (c) => {
      const stats = await prisma.emailLog.aggregate({
        where: { lead: { campaignId: c.id } },
        _count: { id: true },
      });
      const opened = await prisma.emailLog.count({ where: { lead: { campaignId: c.id }, openedAt: { not: null } } });
      const replied = await prisma.emailLog.count({ where: { lead: { campaignId: c.id }, repliedAt: { not: null } } });
      return { ...c, stats: { sent: stats._count.id, opened, replied, openRate: stats._count.id ? opened / stats._count.id : 0, replyRate: stats._count.id ? replied / stats._count.id : 0 } };
    }));
    res.json(result);
  } catch (error) { next(error); }
});

// GET /:id — Campaign detail
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: {
        sequences: { orderBy: { stepNumber: 'asc' } },
        campaignInboxes: { include: { inbox: { select: { id: true, emailAddress: true, warmupScore: true, warmupStatus: true } } } },
        emailList: { select: { id: true, name: true, totalContacts: true } },
        _count: { select: { leads: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    // Per-sequence stats
    const seqStats = await Promise.all(campaign.sequences.map(async (s) => {
      const total = await prisma.emailLog.count({ where: { sequenceId: s.id } });
      const opened = await prisma.emailLog.count({ where: { sequenceId: s.id, openedAt: { not: null } } });
      const replied = await prisma.emailLog.count({ where: { sequenceId: s.id, repliedAt: { not: null } } });
      return { ...s, stats: { sent: total, opened, replied } };
    }));
    res.json({ ...campaign, sequences: seqStats });
  } catch (error) { next(error); }
});

// PUT /:id
router.put('/:id', validate(updateCampaignSchema), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    const { inboxIds, sequences, scheduleStart, scheduleEnd, ...data } = req.body;
    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data: { ...data, scheduleStart: scheduleStart ? new Date(scheduleStart) : undefined, scheduleEnd: scheduleEnd ? new Date(scheduleEnd) : undefined },
    });
    if (inboxIds) {
      await prisma.campaignInbox.deleteMany({ where: { campaignId: existing.id } });
      await prisma.campaignInbox.createMany({ data: inboxIds.map((inboxId: string) => ({ campaignId: existing.id, inboxId })) });
    }
    if (sequences) {
      await prisma.sequence.deleteMany({ where: { campaignId: existing.id } });
      await prisma.sequence.createMany({ data: sequences.map((s: any) => ({ ...s, campaignId: existing.id })) });
    }
    res.json(updated);
  } catch (error) { next(error); }
});

// DELETE /:id
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    await prisma.campaign.delete({ where: { id: c.id } });
    res.json({ message: 'Campaign deleted' });
  } catch (error) { next(error); }
});

// POST /:id/start
router.post('/:id/start', async (req: AuthRequest, res, next) => {
  try {
    const c = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { sequences: true, campaignInboxes: true, emailList: true },
    });
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    if (!c.emailListId) return res.status(400).json({ error: 'No email list attached' });
    if (!c.sequences.length) return res.status(400).json({ error: 'No sequences defined' });
    if (!c.campaignInboxes.length) return res.status(400).json({ error: 'No inboxes assigned' });

    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'running' } });
    await campaignScheduleQueue.add(`schedule-${c.id}`, { campaignId: c.id }, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
    });
    res.json({ message: 'Campaign started', status: 'running' });
  } catch (error) { next(error); }
});

// POST /:id/pause
router.post('/:id/pause', async (req: AuthRequest, res, next) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'paused' } });
    res.json({ message: 'Campaign paused' });
  } catch (error) { next(error); }
});

// POST /:id/resume
router.post('/:id/resume', async (req: AuthRequest, res, next) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'running' } });
    await campaignScheduleQueue.add(`schedule-${c.id}`, { campaignId: c.id }, {
      repeat: { pattern: '*/15 * * * *' },
    });
    res.json({ message: 'Campaign resumed' });
  } catch (error) { next(error); }
});

// POST /:id/stop
router.post('/:id/stop', async (req: AuthRequest, res, next) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'completed' } });
    const jobs = await campaignScheduleQueue.getRepeatableJobs();
    for (const j of jobs) {
      if (j.name === `schedule-${c.id}`) await campaignScheduleQueue.removeRepeatableByKey(j.key);
    }
    res.json({ message: 'Campaign stopped' });
  } catch (error) { next(error); }
});

export default router;
