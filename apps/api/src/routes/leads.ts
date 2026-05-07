import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// GET / — All leads, filterable
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { stage, campaignId, search, page: p, limit: l } = req.query as any;
    const page = parseInt(p) || 1;
    const limit = parseInt(l) || 25;
    const where: any = { campaign: { userId: req.userId! } };
    if (stage) where.stage = stage;
    if (campaignId) where.campaignId = campaignId;
    if (search) {
      where.contact = { OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]};
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          contact: { select: { email: true, firstName: true, lastName: true, company: true, title: true } },
          campaign: { select: { name: true } },
          inbox: { select: { emailAddress: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);
    res.json({ leads, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

// GET /pipeline — Kanban data grouped by stage
router.get('/pipeline', async (req: AuthRequest, res, next) => {
  try {
    const campaignId = req.query.campaignId as string;
    const where: any = { campaign: { userId: req.userId! } };
    if (campaignId) where.campaignId = campaignId;

    const leads = await prisma.lead.findMany({
      where,
      include: {
        contact: { select: { email: true, firstName: true, lastName: true, company: true, title: true } },
        campaign: { select: { name: true } },
        emailLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { sentAt: true, openedAt: true, repliedAt: true, status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const stages = ['new_lead','contacted','opened','clicked','replied','interested','demo_scheduled','converted','lost','unsubscribed'];
    const pipeline: Record<string, any[]> = {};
    for (const s of stages) pipeline[s] = [];
    for (const lead of leads) pipeline[lead.stage]?.push(lead);

    res.json(pipeline);
  } catch (error) { next(error); }
});

// GET /:id — Lead detail with activity timeline
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, campaign: { userId: req.userId! } },
      include: {
        contact: true,
        campaign: { select: { name: true } },
        inbox: { select: { emailAddress: true } },
        emailLogs: { orderBy: { createdAt: 'desc' }, include: { sequence: { select: { stepNumber: true, subject: true } } } },
        leadNotes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) { next(error); }
});

// PUT /:id — Update stage, notes, assignee
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, campaign: { userId: req.userId! } } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const { stage, notes, assignedTo, nextFollowUpAt } = req.body;
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { stage, notes, assignedTo, nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined },
    });
    res.json(updated);
  } catch (error) { next(error); }
});

// POST /:id/note — Add a note
router.post('/:id/note', async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, campaign: { userId: req.userId! } } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const note = await prisma.leadNote.create({ data: { leadId: lead.id, content: req.body.content } });
    res.status(201).json(note);
  } catch (error) { next(error); }
});

// POST /:id/task — Schedule a follow-up
router.post('/:id/task', async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, campaign: { userId: req.userId! } } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: new Date(req.body.followUpAt) },
    });
    res.json(updated);
  } catch (error) { next(error); }
});

export default router;
