import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { encrypt, decrypt, testSmtpConnection, sendEmail } from '@coldstack/mailer';
import { warmupQueue } from '@coldstack/queue';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const router = Router();
router.use(authenticate);

// ─── Schemas ──────────────────────────────────────────────

const updateInboxSchema = z.object({
  emailAddress: z.string().email().optional(),
  fromName: z.string().optional(),
  dailySendLimit: z.number().int().min(1).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────

/**
 * GET /api/inboxes — List all inboxes (with warmup status)
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const inboxes = await prisma.inbox.findMany({
      where: {
        domain: { userId: req.userId! },
      },
      include: {
        domain: {
          select: { domainName: true },
        },
        _count: {
          select: { emailLogs: true },
        },
        warmupLogs: {
          select: { date: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      inboxes.map((i: any) => {
        const uniqueDays = new Set(i.warmupLogs.map((log: any) => log.date.toISOString().slice(0, 10)));
        const todayStr = new Date().toISOString().slice(0, 10);
        const sentToday = uniqueDays.has(todayStr);
        const currentDay = i.warmupStatus === 'idle' ? 0 : (uniqueDays.size + (sentToday ? 0 : 1));

        return {
          ...i,
          smtpPass: '***',
          domainName: i.domain.domainName,
          currentDay,
          warmupLogs: undefined, // remove raw logs from the response payload
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

// ─── Bulk Warmup Controls ─────────────────────────────────

/**
 * POST /api/inboxes/bulk/pause-warmup — Pause warmup for ALL inboxes
 */
router.post('/bulk/pause-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inboxes = await prisma.inbox.findMany({
      where: { domain: { userId: req.userId! }, warmupStatus: 'warming' },
    });

    for (const inbox of inboxes) {
      const repeatableJobs = await warmupQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === `warmup-${inbox.id}`) {
          await warmupQueue.removeRepeatableByKey(job.key);
        }
      }
      await prisma.inbox.update({
        where: { id: inbox.id },
        data: { warmupStatus: 'paused' },
      });
    }

    res.json({ message: `Paused warmup for ${inboxes.length} inboxes`, count: inboxes.length });
  } catch (error) { next(error); }
});

/**
 * POST /api/inboxes/bulk/resume-warmup — Resume warmup for ALL paused inboxes
 */
router.post('/bulk/resume-warmup', async (req: AuthRequest, res, next) => {
  try {
    const WEEK_LIMITS = [2, 5, 10, 20, 30, 30];
    const inboxes = await prisma.inbox.findMany({
      where: { domain: { userId: req.userId! }, warmupStatus: 'paused' },
    });

    for (const inbox of inboxes) {
      const currentWeek = Math.max(inbox.warmupWeek, 1);
      const policyLimit = WEEK_LIMITS[currentWeek - 1] || 2;

      await prisma.inbox.update({
        where: { id: inbox.id },
        data: { warmupStatus: 'warming', weekApproved: true, dailySendLimit: policyLimit },
      });

      await warmupQueue.add(`warmup-${inbox.id}-immediate`, { inboxId: inbox.id });
      await warmupQueue.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
        repeat: { pattern: '0 9 * * *' },
      });
    }

    res.json({ message: `Resumed warmup for ${inboxes.length} inboxes`, count: inboxes.length });
  } catch (error) { next(error); }
});

/**
 * POST /api/inboxes/bulk/stop-warmup — Stop and reset warmup for ALL inboxes
 */
router.post('/bulk/stop-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inboxes = await prisma.inbox.findMany({
      where: { domain: { userId: req.userId! }, warmupStatus: { in: ['warming', 'paused'] } },
    });

    for (const inbox of inboxes) {
      const repeatableJobs = await warmupQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === `warmup-${inbox.id}`) {
          await warmupQueue.removeRepeatableByKey(job.key);
        }
      }

      await prisma.inbox.update({
        where: { id: inbox.id },
        data: {
          warmupStatus: 'idle',
          warmupScore: 0,
          warmupWeek: 0,
          weekApproved: false,
          dailySendLimit: 2,
          totalSent: 0,
          totalBounced: 0,
          totalReplied: 0,
          totalSpam: 0,
        },
      });

      await prisma.warmupLog.deleteMany({ where: { inboxId: inbox.id } });
    }

    res.json({ message: `Stopped and reset warmup for ${inboxes.length} inboxes`, count: inboxes.length });
  } catch (error) { next(error); }
});

/**
 * GET /api/inboxes/:id — Inbox detail with warmup graph data
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: {
        id: req.params.id,
        domain: { userId: req.userId! },
      },
      include: {
        domain: { select: { domainName: true } },
        warmupLogs: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    res.json({
      ...inbox,
      smtpPass: '***',
      domainName: inbox.domain.domainName,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/inboxes/:id — Update SMTP settings
 */
router.put('/:id', validate(updateInboxSchema), async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const updateData: any = {};
    if (req.body.emailAddress) updateData.emailAddress = req.body.emailAddress;
    if (req.body.fromName !== undefined) updateData.fromName = req.body.fromName;
    if (req.body.dailySendLimit !== undefined) updateData.dailySendLimit = req.body.dailySendLimit;
    if (req.body.smtpHost) updateData.smtpHost = req.body.smtpHost;
    if (req.body.smtpPort) updateData.smtpPort = req.body.smtpPort;
    if (req.body.smtpUser) updateData.smtpUser = req.body.smtpUser;
    if (req.body.smtpPass) updateData.smtpPass = encrypt(req.body.smtpPass);
    if (req.body.imapHost !== undefined) updateData.imapHost = req.body.imapHost;
    if (req.body.imapPort !== undefined) updateData.imapPort = req.body.imapPort;
    if (req.body.imapUser !== undefined) updateData.imapUser = req.body.imapUser;
    if (req.body.imapPass !== undefined && req.body.imapPass !== '') updateData.imapPass = encrypt(req.body.imapPass);

    const updated = await prisma.inbox.update({
      where: { id: inbox.id },
      data: updateData,
    });

    res.json({ ...updated, smtpPass: '***' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/start-warmup — Enqueue warmup job
 */
router.post('/:id/start-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    if (inbox.warmupStatus === 'warming') {
      return res.status(400).json({ error: 'Warmup is already running' });
    }

    const startingWeek = inbox.warmupWeek === 0 ? 1 : inbox.warmupWeek;
    const WEEK_LIMITS = [2, 5, 10, 20, 30, 30];
    const policyLimit = WEEK_LIMITS[startingWeek - 1] || 2;

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: { 
        warmupStatus: 'warming',
        warmupWeek: startingWeek,
        weekApproved: true,
        dailySendLimit: policyLimit,
      },
    });

    await warmupQueue.add(`warmup-${inbox.id}-immediate`, { inboxId: inbox.id });
    await warmupQueue.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
      repeat: {
        pattern: '0 9 * * *',
      },
    });

    res.json({ message: 'Warmup started', status: 'warming' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/resume-warmup — Alias for start-warmup
 */
router.post('/:id/resume-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    if (inbox.warmupStatus === 'warming') {
      return res.status(400).json({ error: 'Warmup is already running' });
    }

    const WEEK_LIMITS = [2, 5, 10, 20, 30, 30];
    const currentWeek = Math.max(inbox.warmupWeek, 1);
    const policyLimit = WEEK_LIMITS[currentWeek - 1] || 2;

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: { 
        warmupStatus: 'warming',
        weekApproved: true,
        dailySendLimit: policyLimit,
      },
    });

    await warmupQueue.add(`warmup-${inbox.id}-immediate`, { inboxId: inbox.id });
    await warmupQueue.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
      repeat: {
        pattern: '0 9 * * *',
      },
    });

    res.json({ message: 'Warmup resumed', status: 'warming' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/pause-warmup
 */
router.post('/:id/pause-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    // Remove repeatable warmup job
    const repeatableJobs = await warmupQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === `warmup-${inbox.id}`) {
        await warmupQueue.removeRepeatableByKey(job.key);
      }
    }

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: { warmupStatus: 'paused' },
    });

    res.json({ message: 'Warmup paused', status: 'paused' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/stop-warmup
 */
router.post('/:id/stop-warmup', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    // Remove repeatable warmup job
    const repeatableJobs = await warmupQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === `warmup-${inbox.id}`) {
        await warmupQueue.removeRepeatableByKey(job.key);
      }
    }

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: { 
        warmupStatus: 'idle',
        warmupScore: 0,
        warmupWeek: 0,
        weekApproved: false,
        dailySendLimit: 2,
        totalSent: 0,
        totalBounced: 0,
        totalReplied: 0
      },
    });
    
    // Optionally delete warmup logs so it starts completely fresh
    await prisma.warmupLog.deleteMany({
      where: { inboxId: inbox.id }
    });

    res.json({ message: 'Warmup stopped and reset', status: 'idle' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/approve-week — Approve warmup to proceed to next week
 */
router.post('/:id/approve-week', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    if (inbox.warmupStatus !== 'warming' && inbox.warmupStatus !== 'paused') {
      return res.status(400).json({ error: 'Inbox is not in a warmup state' });
    }

    const nextWeek = inbox.warmupWeek + 1;
    if (nextWeek > 6) {
      return res.status(400).json({ error: 'Warmup already completed all 6 weeks' });
    }

    const WEEK_LIMITS = [2, 5, 10, 20, 30, 30];
    const policyLimit = WEEK_LIMITS[nextWeek - 1] || 30;

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: {
        weekApproved: true,
        warmupWeek: nextWeek,
        warmupStatus: 'warming',
        dailySendLimit: policyLimit,
      },
    });

    // Re-add the repeatable warmup job if it was paused
    const repeatableJobs = await warmupQueue.getRepeatableJobs();
    const existing = repeatableJobs.find(j => j.name === `warmup-${inbox.id}`);
    if (!existing) {
      await warmupQueue.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
        repeat: { pattern: '0 9 * * *' },
      });
    }
    // Also run immediately upon approval
    await warmupQueue.add(`warmup-${inbox.id}-immediate`, { inboxId: inbox.id });

    res.json({ message: `Week ${nextWeek} approved — warmup continuing`, warmupWeek: nextWeek });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inboxes/:id/warmup-logs
 */
router.get('/:id/warmup-logs', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const logs = await prisma.warmupLog.findMany({
      where: { inboxId: inbox.id },
      orderBy: { date: 'desc' },
      take: 50,
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inboxes/:id/warmup-policy — Full policy state for the inbox
 */
router.get('/:id/warmup-policy', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
      include: { domain: true },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const WEEK_SCHEDULE = [
      { week: 1, goal: 'Establish sending pattern',     daily: 2,  internal: 2,  gmail: 0,  outlook: 0, real: 0, targetScore: 20  },
      { week: 2, goal: 'Introduce external seed accounts', daily: 5,  internal: 3,  gmail: 2,  outlook: 0, real: 0, targetScore: 35  },
      { week: 3, goal: 'Build momentum',                daily: 10, internal: 4,  gmail: 4,  outlook: 2, real: 0, targetScore: 50  },
      { week: 4, goal: 'Approach ready zone',            daily: 20, internal: 6,  gmail: 8,  outlook: 4, real: 2, targetScore: 70  },
      { week: 5, goal: 'Hit ready threshold',            daily: 30, internal: 8,  gmail: 12, outlook: 6, real: 4, targetScore: 85  },
      { week: 6, goal: 'Full warmup complete',           daily: 30, internal: 10, gmail: 10, outlook: 6, real: 4, targetScore: 100 },
    ];

    const currentWeek = Math.max(inbox.warmupWeek, 1);
    const weekConfig = WEEK_SCHEDULE[(currentWeek - 1)] || WEEK_SCHEDULE[5];

    // Calculate unique calendar days of logs for currentDay
    const logs = await prisma.warmupLog.findMany({
      where: { inboxId: inbox.id },
      select: { date: true },
    });
    const uniqueDays = new Set(logs.map(log => log.date.toISOString().slice(0, 10)));
    const todayStr = new Date().toISOString().slice(0, 10);
    const sentToday = uniqueDays.has(todayStr);
    const currentDay = inbox.warmupStatus === 'idle' ? 0 : (uniqueDays.size + (sentToday ? 0 : 1));

    // Today's send count
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todaySentCount = await prisma.warmupLog.count({
      where: { inboxId: inbox.id, date: { gte: todayStart } },
    });

    // Bounce rate
    const bounceRate = inbox.totalSent > 0 ? (inbox.totalBounced / inbox.totalSent) : 0;

    // Safety rule checks
    const now = new Date();
    const isFridayPrayerTime = now.getUTCDay() === 5 && now.getUTCHours() >= 8 && now.getUTCHours() < 10;
    const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;

    // Check for duplicate subjects this week
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);

    // Seed account counts
    const seeds = await prisma.seedAccount.findMany({
      where: { userId: inbox.domain.userId, isActive: true },
    });
    const gmailSeedCount = seeds.filter(s => s.provider === 'gmail' && s.type === 'seed').length;
    const outlookSeedCount = seeds.filter(s => s.provider === 'outlook' && s.type === 'seed').length;
    const realContactCount = seeds.filter(s => s.type === 'real').length;
    const internalInboxCount = await prisma.inbox.count({
      where: { domain: { userId: inbox.domain.userId }, id: { not: inbox.id } },
    });

    // Outreach readiness
    const outreachReady = inbox.warmupScore >= 80;
    const fullyReady = inbox.warmupScore >= 85 && currentWeek >= 6;

    res.json({
      weekSchedule: WEEK_SCHEDULE,
      currentWeek,
      currentWeekConfig: weekConfig,
      currentDay,
      todaySentCount,
      dailyLimit: inbox.dailySendLimit,
      bounceRate: parseFloat((bounceRate * 100).toFixed(1)),
      bounceRateOk: bounceRate < 0.02,
      isFridayPrayerTime,
      isWeekend,
      outreachReady,
      fullyReady,
      warmupScore: inbox.warmupScore,
      warmupStatus: inbox.warmupStatus,
      seedCounts: {
        internal: internalInboxCount,
        gmail: gmailSeedCount,
        outlook: outlookSeedCount,
        real: realContactCount,
      },
      // Recommendations
      recommendations: {
        needsGmailSeeds: currentWeek >= 2 && gmailSeedCount < weekConfig.gmail,
        needsOutlookSeeds: currentWeek >= 3 && outlookSeedCount < weekConfig.outlook,
        needsRealContacts: currentWeek >= 4 && realContactCount < weekConfig.real,
        needsMoreInboxes: internalInboxCount < 2,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/inboxes/:id
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    // Clean up repeatable warmup jobs if any exist
    const repeatableJobs = await warmupQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === `warmup-${inbox.id}`) {
        await warmupQueue.removeRepeatableByKey(job.key);
      }
    }

    await prisma.inbox.delete({ where: { id: inbox.id } });
    res.json({ message: 'Inbox deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/test — Test SMTP connection
 */
router.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const result = await testSmtpConnection({
      host: inbox.smtpHost,
      port: inbox.smtpPort,
      user: inbox.smtpUser,
      pass: inbox.smtpPass,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inboxes/:id/send-test — Send a test email
 */
router.post('/:id/send-test', async (req: AuthRequest, res, next) => {
  try {
    const { toEmail, templateId } = req.body;

    if (!toEmail || !templateId) {
      return res.status(400).json({ error: 'toEmail and templateId are required' });
    }

    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, userId: req.userId! },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const result = await sendEmail(
      {
        id: inbox.id,
        emailAddress: inbox.emailAddress,
        smtpHost: inbox.smtpHost,
        smtpPort: inbox.smtpPort,
        smtpUser: inbox.smtpUser,
        smtpPass: inbox.smtpPass,
      },
      {
        to: toEmail,
        subject: template.subject,
        html: template.bodyHtml,
        text: template.bodyText || undefined,
      }
    );

    res.json({ message: 'Test email sent successfully', messageId: result.messageId });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send test email: ' + error.message });
  }
});

/**
 * GET /api/inboxes/:id/emails — List incoming emails via IMAP
 */
router.get('/:id/emails', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) return res.status(404).json({ error: 'Inbox not found' });

    const host = inbox.imapHost || inbox.smtpHost.replace('smtp', 'imap').replace('mail', 'imap');
    const port = inbox.imapPort || 993;

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: {
        user: inbox.imapUser || inbox.smtpUser,
        pass: inbox.imapPass ? decrypt(inbox.imapPass) : decrypt(inbox.smtpPass),
      },
      logger: false,
    });

    await client.connect();
    
    // Ensure we are connected
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages = [];
      // Fetch all emails (or last 50)
      for await (let msg of client.fetch('1:*', { envelope: true, uid: true })) {
        if (msg.envelope) {
          messages.push({
            uid: msg.uid,
            subject: msg.envelope.subject,
            from: msg.envelope.from?.[0]?.address || msg.envelope.from?.[0]?.name,
            date: msg.envelope.date,
          });
        }
      }
      res.json(messages.reverse().slice(0, 50));
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error: any) {
    console.error('IMAP fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch emails via IMAP: ' + error.message });
  }
});

/**
 * GET /api/inboxes/:id/emails/:uid — Get single email content via IMAP
 */
router.get('/:id/emails/:uid', async (req: AuthRequest, res, next) => {
  try {
    const inbox = await prisma.inbox.findFirst({
      where: { id: req.params.id, domain: { userId: req.userId! } },
    });

    if (!inbox) return res.status(404).json({ error: 'Inbox not found' });

    const host = inbox.imapHost || inbox.smtpHost.replace('smtp', 'imap').replace('mail', 'imap');
    const port = inbox.imapPort || 993;

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: {
        user: inbox.imapUser || inbox.smtpUser,
        pass: inbox.imapPass ? decrypt(inbox.imapPass) : decrypt(inbox.smtpPass),
      },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne(req.params.uid, { source: true }, { uid: true });
      if (!msg || !msg.source) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const parsed: any = await simpleParser(msg.source);
      
      const fromAddress = Array.isArray(parsed.from?.value) ? parsed.from?.value[0]?.address : undefined;
      const toAddress = Array.isArray(parsed.to?.value) ? parsed.to?.value[0]?.address : undefined;
      
      res.json({
        uid: req.params.uid,
        subject: parsed.subject,
        from: fromAddress || parsed.from?.text,
        to: toAddress || parsed.to?.text,
        date: parsed.date,
        html: parsed.html,
        text: parsed.text,
      });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error: any) {
    console.error('IMAP fetch single error:', error);
    res.status(500).json({ error: 'Failed to fetch email via IMAP: ' + error.message });
  }
});

export default router;
