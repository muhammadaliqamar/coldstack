import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { encrypt, decrypt, testSmtpConnection } from '@coldstack/mailer';
import { warmupQueue } from '@coldstack/queue';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Schemas ──────────────────────────────────────────────

const addDomainSchema = z.object({
  domainName: z.string().min(3),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
});

const updateDomainSchema = z.object({
  domainName: z.string().min(3).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────

/**
 * POST /api/domains — Add a domain with SMTP credentials
 */
router.post('/', validate(addDomainSchema), async (req: AuthRequest, res, next) => {
  try {
    const { domainName, smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass } = req.body;

    const domain = await prisma.domain.create({
      data: {
        userId: req.userId!,
        domainName,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass: encrypt(smtpPass),
        imapHost,
        imapPort,
        imapUser,
        imapPass: imapPass ? encrypt(imapPass) : null,
      },
    });

    res.status(201).json({
      ...domain,
      smtpPass: '***',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/domains/:id — Update domain and SMTP credentials
 */
router.put('/:id', validate(updateDomainSchema), async (req: AuthRequest, res, next) => {
  try {
    const domain = await prisma.domain.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const { domainName, smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort, imapUser, imapPass } = req.body;
    const updateData: any = {};
    
    if (domainName) updateData.domainName = domainName;
    if (smtpHost) updateData.smtpHost = smtpHost;
    if (smtpPort) updateData.smtpPort = smtpPort;
    if (smtpUser) updateData.smtpUser = smtpUser;
    if (smtpPass) updateData.smtpPass = encrypt(smtpPass);
    if (imapHost !== undefined) updateData.imapHost = imapHost;
    if (imapPort !== undefined) updateData.imapPort = imapPort;
    if (imapUser !== undefined) updateData.imapUser = imapUser;
    if (imapPass !== undefined && imapPass !== '') updateData.imapPass = encrypt(imapPass);

    // If SMTP settings change, reset verified status
    if (smtpHost || smtpPort || smtpUser || smtpPass) {
      updateData.verified = false;
    }

    const updated = await prisma.domain.update({
      where: { id: domain.id },
      data: updateData,
    });

    res.json({
      ...updated,
      smtpPass: '***',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/domains — List user domains
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const domains = await prisma.domain.findMany({
      where: { userId: req.userId! },
      include: {
        inboxes: {
          select: {
            id: true,
            emailAddress: true,
            warmupStatus: true,
            warmupScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      domains.map((d: any) => ({
        ...d,
        smtpPass: '***',
        inboxCount: d.inboxes.length,
      }))
    );
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/domains/:id
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const domain = await prisma.domain.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    await prisma.domain.delete({ where: { id: req.params.id } });
    res.json({ message: 'Domain deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/domains/:id/verify — Test SMTP connection
 */
router.post('/:id/verify', async (req: AuthRequest, res, next) => {
  try {
    const domain = await prisma.domain.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const result = await testSmtpConnection({
      host: domain.smtpHost,
      port: domain.smtpPort,
      user: domain.smtpUser,
      pass: decrypt(domain.smtpPass),
    });

    if (result.success) {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { verified: true },
      });
    }

    res.json({
      verified: result.success,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/domains/:id/create-inboxes — Auto-generate 3 inboxes
 */
router.post('/:id/create-inboxes', async (req: AuthRequest, res, next) => {
  try {
    const domain = await prisma.domain.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { inboxes: true },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    let count = req.body.count ? parseInt(req.body.count as string) : (3 - domain.inboxes.length);
    if (isNaN(count) || count < 1) {
      count = 3 - domain.inboxes.length;
    }

    if (domain.inboxes.length + count > 3) {
      return res.status(400).json({ error: 'Cannot exceed max limit of 3 inboxes per domain' });
    }

    const existingEmails = new Set(domain.inboxes.map((i: any) => i.emailAddress));

    const newInboxes = [];
    let prefixIndex = 1;
    while (newInboxes.length < count && prefixIndex <= 20) {
      const emailAddress = `outreach${prefixIndex}@${domain.domainName}`;
      prefixIndex++;
      
      if (existingEmails.has(emailAddress)) continue;

      // Derive a friendly "From Name" from the prefix
      const prefix = `outreach${prefixIndex - 1}`;
      const fromName = prefix.replace(/(\d+)/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

      const inbox = await prisma.inbox.create({
        data: {
          domainId: domain.id,
          emailAddress,
          fromName,
          smtpHost: domain.smtpHost,
          smtpPort: domain.smtpPort,
          smtpUser: domain.smtpUser,
          smtpPass: domain.smtpPass,
          imapHost: domain.imapHost,
          imapPort: domain.imapPort,
          imapUser: domain.imapUser,
          imapPass: domain.imapPass,
          warmupWeek: 1,
          weekApproved: true, // First week auto-approved
        },
      });
      newInboxes.push(inbox);

      // Start warmup for each new inbox
      await warmupQueue.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
        repeat: {
          pattern: '0 9 * * *', // Every day at 9 AM
        },
      });

      await prisma.inbox.update({
        where: { id: inbox.id },
        data: { warmupStatus: 'warming' },
      });
    }

    res.status(201).json({
      message: `Created ${newInboxes.length} inboxes`,
      inboxes: newInboxes.map((i) => ({ ...i, smtpPass: '***' })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
