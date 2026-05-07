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
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      inboxes.map((i: any) => ({
        ...i,
        smtpPass: '***',
        domainName: i.domain.domainName,
      }))
    );
  } catch (error) {
    next(error);
  }
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

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: { warmupStatus: 'warming' },
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

    await prisma.inbox.update({
      where: { id: inbox.id },
      data: {
        weekApproved: true,
        warmupWeek: nextWeek,
        warmupStatus: 'warming',
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
