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
    let templates = await prisma.emailTemplate.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });

    // If no templates exist, auto-seed the 15 industry-standard high-converting templates
    if (templates.length === 0) {
      console.log(`[Templates] Auto-seeding 15 premium templates for user: ${req.userId}`);
      const defaultTemplates = [
        {
          name: 'Cold Outreach: Intro Email',
          subject: 'Quick question for {{firstName|"there"}}',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI noticed that you are expanding your business at {{company|"your company"}}. Our tool helps companies streamline their operations. Do you have 10 minutes for a quick chat next week?',
          bodyText: 'Hi {{firstName}},\n\nI noticed that you are expanding your business at {{company}}. Our tool helps companies streamline their operations. Do you have 10 minutes for a quick chat next week?',
        },
        {
          name: 'Cold Outreach: Follow-up',
          subject: 'RE: Quick question for {{firstName|"there"}}',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI wanted to circle back on my previous email. I know you are busy. If you have a moment, I\'d love to show you how we can add value to {{company|"your company"}}.',
          bodyText: 'Hi {{firstName}},\n\nI wanted to circle back on my previous email. I know you are busy. If you have a moment, I\'d love to show you how we can add value to {{company}}.',
        },
        {
          name: 'Cold Outreach: Breakup Email',
          subject: 'Moving on...',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI haven\'t heard back from you, so I\'ll assume the timing isn\'t right. This is my last email to you. If you ever want to chat about growing {{company|"your company"}}, feel free to reach out.',
          bodyText: 'Hi {{firstName}},\n\nI haven\'t heard back from you, so I\'ll assume the timing isn\'t right. This is my last email to you. If you ever want to chat about growing {{company}}, feel free to reach out.',
        },
        {
          name: 'Nurture: Welcome Series',
          subject: 'Welcome to the family!',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nWelcome to our community! We are excited to have you. Over the next few weeks, we will share some best practices to help you get the most out of our platform.',
          bodyText: 'Hi {{firstName}},\n\nWelcome to our community! We are excited to have you. Over the next few weeks, we will share some best practices to help you get the most out of our platform.',
        },
        {
          name: 'Nurture: Educational Content',
          subject: '3 ways to optimize {{company|"your team"}}',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nHere are 3 tips to boost efficiency:\n1. Automate repetitive tasks.\n2. Standardize communication.\n3. Track weekly rollups. Hope this helps!',
          bodyText: 'Hi {{firstName}},\n\nHere are 3 tips to boost efficiency:\n1. Automate repetitive tasks.\n2. Standardize communication.\n3. Track weekly rollups. Hope this helps!',
        },
        {
          name: 'Nurture: Case Study Share',
          subject: 'How we helped a similar team grow by 40%',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI thought you might find this interesting. We recently worked with a company in your space and helped them scale their outreach. Read the full case study here.',
          bodyText: 'Hi {{firstName}},\n\nI thought you might find this interesting. We recently worked with a company in your space and helped them scale their outreach. Read the full case study here.',
        },
        {
          name: 'Sales: Demo Request',
          subject: 'Let\'s schedule a demo',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI\'d love to walk you through a personalized demo of our platform and show you exactly how it can help {{company|"your company"}}. Let me know what date works best.',
          bodyText: 'Hi {{firstName}},\n\nI\'d love to walk you through a personalized demo of our platform and show you exactly how it can help {{company}}. Let me know what date works best.',
        },
        {
          name: 'Sales: Proposal Follow-up',
          subject: 'Thoughts on the proposal?',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI\'m following up on the proposal I sent over. Do you have any questions? I\'m happy to jump on a call to review the details together.',
          bodyText: 'Hi {{firstName}},\n\nI\'m following up on the proposal I sent over. Do you have any questions? I\'m happy to jump on a call to review the details together.',
        },
        {
          name: 'Sales: Pricing Quote',
          subject: 'Your customized pricing quote',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nAs requested, here is the customized quote for {{company|"your company"}}. Let me know if you would like to proceed with the next steps.',
          bodyText: 'Hi {{firstName}},\n\nAs requested, here is the customized quote for {{company}}. Let me know if you would like to proceed with the next steps.',
        },
        {
          name: 'Re-engagement: Win-back',
          subject: 'We miss you!',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nWe noticed you haven\'t logged in lately. We\'ve added a ton of new features that we think you\'ll love. Click here to check them out.',
          bodyText: 'Hi {{firstName}},\n\nWe noticed you haven\'t logged in lately. We\'ve added a ton of new features that we think you\'ll love. Click here to check them out.',
        },
        {
          name: 'Re-engagement: Feedback Request',
          subject: 'Quick feedback question',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nWe are always trying to improve. Do you have 2 minutes to share your feedback on your experience with us? We\'d highly appreciate it.',
          bodyText: 'Hi {{firstName}},\n\nWe are always trying to improve. Do you have 2 minutes to share your feedback on your experience with us? We\'d highly appreciate it.',
        },
        {
          name: 'Re-engagement: Check-in',
          subject: 'Just checking in',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nI wanted to see how everything is going at {{company|"your company"}}. Let me know if there is anything we can do to support you.',
          bodyText: 'Hi {{firstName}},\n\nI wanted to see how everything is going at {{company}}. Let me know if there is anything we can do to support you.',
        },
        {
          name: 'Transactional: Onboarding',
          subject: 'Complete your setup',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nYou\'re almost ready! Click the link below to complete your onboarding and start sending campaigns today.',
          bodyText: 'Hi {{firstName}},\n\nYou\'re almost ready! Click the link below to complete your onboarding and start sending campaigns today.',
        },
        {
          name: 'Transactional: Payment Receipt',
          subject: 'Your receipt for this month',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nThank you for your payment. Your invoice is attached. If you have any billing questions, please reply directly to this email.',
          bodyText: 'Hi {{firstName}},\n\nThank you for your payment. Your invoice is attached. If you have any billing questions, please reply directly to this email.',
        },
        {
          name: 'Transactional: Account Update',
          subject: 'Important account notification',
          bodyHtml: 'Hi {{firstName|"there"}},\n\nThis is a quick notification that your account details have been updated. If you did not make this change, please contact support immediately.',
          bodyText: 'Hi {{firstName}},\n\nThis is a quick notification that your account details have been updated. If you did not make this change, please contact support immediately.',
        },
      ];

      // Perform bulk create
      await prisma.emailTemplate.createMany({
        data: defaultTemplates.map(t => ({
          userId: req.userId!,
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText,
        })),
      });

      templates = await prisma.emailTemplate.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
      });
    }

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
